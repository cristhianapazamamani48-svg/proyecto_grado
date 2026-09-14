import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RolUsuario,
  EstadoInvitacion,
  EstadoMembresia,
  TipoPlan,
} from '@prisma/client';
import * as crypto from 'crypto';

const LIMITES_POR_PLAN: Record<string, {
  limiteDocentes: number;
  limiteEstudiantes: number;
  limiteEvaluaciones: number;
  limiteCorreccionesIaMes: number;
}> = {
  GRATUITO: {
    limiteDocentes: 5,
    limiteEstudiantes: 100,
    limiteEvaluaciones: 20,
    limiteCorreccionesIaMes: 50,
  },
  BASICO: {
    limiteDocentes: 25,
    limiteEstudiantes: 500,
    limiteEvaluaciones: 200,
    limiteCorreccionesIaMes: 500,
  },
  INSTITUCIONAL: {
    limiteDocentes: 500,
    limiteEstudiantes: 10000,
    limiteEvaluaciones: 9999,
    limiteCorreccionesIaMes: 9999,
  },
};

@Injectable()
export class OrganizacionService {
  private readonly logger = new Logger(OrganizacionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  // OBTENER INFO DE ORGANIZACIÓN + USO DE IA
  // ─────────────────────────────────────────────────────────────────
  async obtenerOrganizacion(idOrganizacion: number) {
    const org = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
      include: {
        _count: {
          select: {
            membresias: true,
            evaluaciones: true,
            invitaciones: true,
          },
        },
      },
    });

    if (!org) throw new NotFoundException('Organización no encontrada.');

    const inicioMes = this.inicioDelMes();
    const correccionesEstesMes = await this.prisma.usoIaLog.count({
      where: {
        idOrganizacion,
        fecha: { gte: inicioMes },
      },
    });

    return {
      ...org,
      usosIa: {
        usadas: correccionesEstesMes,
        disponibles: Math.max(0, org.limiteCorreccionesIaMes - correccionesEstesMes),
        limite: org.limiteCorreccionesIaMes,
        reiniciaPeriodo: this.inicioSiguienteMes().toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // LISTAR MIEMBROS CON ESTADO
  // ─────────────────────────────────────────────────────────────────
  async listarMiembros(idOrganizacion: number) {
    return this.prisma.membresia.findMany({
      where: { idOrganizacion },
      include: {
        usuario: {
          select: {
            idUsuario: true,
            nombre: true,
            apellido: true,
            correo: true,
            estado: true,
            fechaCreacion: true,
          },
        },
      },
      orderBy: { fechaCreacion: 'asc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // APROBAR / RECHAZAR MEMBRESÍA PENDIENTE
  // ─────────────────────────────────────────────────────────────────
  async aprobarMembresia(idOrganizacion: number, idMembresia: number) {
    const membresia = await this.prisma.membresia.findFirst({
      where: { idMembresia, idOrganizacion },
    });
    if (!membresia) throw new NotFoundException('Membresía no encontrada.');
    if (membresia.estado !== EstadoMembresia.PENDIENTE_APROBACION) {
      throw new BadRequestException('La membresía no está pendiente de aprobación.');
    }

    return this.prisma.membresia.update({
      where: { idMembresia },
      data: { estado: EstadoMembresia.ACTIVO },
    });
  }

  async rechazarMembresia(idOrganizacion: number, idMembresia: number) {
    const membresia = await this.prisma.membresia.findFirst({
      where: { idMembresia, idOrganizacion },
    });
    if (!membresia) throw new NotFoundException('Membresía no encontrada.');

    return this.prisma.membresia.update({
      where: { idMembresia },
      data: { estado: EstadoMembresia.INACTIVO },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // INVITACIONES POR CORREO
  // ─────────────────────────────────────────────────────────────────
  async crearInvitacion(
    idOrganizacion: number,
    idInvitador: number,
    correoInvitado: string,
    rolAsignado: RolUsuario = RolUsuario.DOCENTE,
  ) {
    // No permitir invitaciones con rol SUPER_ADMIN a través de este flujo
    if (rolAsignado === RolUsuario.SUPER_ADMIN) {
      throw new ForbiddenException('No se puede invitar con el rol SUPER_ADMIN.');
    }

    const org = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');

    // Verificar si ya existe una membresía activa con ese correo
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { correo: correoInvitado },
    });

    if (usuarioExistente) {
      const membresiaExistente = await this.prisma.membresia.findUnique({
        where: {
          idUsuario_idOrganizacion: {
            idUsuario: usuarioExistente.idUsuario,
            idOrganizacion,
          },
        },
      });
      if (
        membresiaExistente &&
        membresiaExistente.estado !== EstadoMembresia.INACTIVO
      ) {
        throw new ConflictException('El usuario ya es miembro de esta organización.');
      }
    }

    // Revocar invitaciones pendientes anteriores al mismo correo
    await this.prisma.invitacionOrganizacion.updateMany({
      where: {
        idOrganizacion,
        correoInvitado,
        estado: EstadoInvitacion.PENDIENTE,
      },
      data: { estado: EstadoInvitacion.REVOCADA },
    });

    const token = crypto.randomBytes(48).toString('hex');
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7); // Expira en 7 días

    const invitacion = await this.prisma.invitacionOrganizacion.create({
      data: {
        idOrganizacion,
        idInvitador,
        correoInvitado: correoInvitado.toLowerCase().trim(),
        rolAsignado,
        token,
        fechaExpiracion,
      },
    });

    this.logger.log(
      `Invitación creada para '${correoInvitado}' en org ${idOrganizacion}. ` +
      `Token: ...${token.slice(-8)} (expira ${fechaExpiracion.toISOString()})`,
    );

    return {
      idInvitacion: invitacion.idInvitacion,
      correoInvitado: invitacion.correoInvitado,
      rolAsignado: invitacion.rolAsignado,
      fechaExpiracion: invitacion.fechaExpiracion,
      // En producción el token se enviaría por correo, aquí lo devolvemos para pruebas
      token: invitacion.token,
    };
  }

  async aceptarInvitacion(token: string, idUsuario: number) {
    const invitacion = await this.prisma.invitacionOrganizacion.findUnique({
      where: { token },
      include: { organizacion: true },
    });

    if (!invitacion) throw new NotFoundException('Invitación no encontrada o inválida.');
    if (invitacion.estado !== EstadoInvitacion.PENDIENTE) {
      throw new BadRequestException('Esta invitación ya fue utilizada, revocada o ha expirado.');
    }
    if (new Date() > invitacion.fechaExpiracion) {
      await this.prisma.invitacionOrganizacion.update({
        where: { token },
        data: { estado: EstadoInvitacion.EXPIRADA },
      });
      throw new BadRequestException('La invitación ha expirado. Solicita una nueva al administrador.');
    }

    // Verificar que el correo del token coincide con el usuario autenticado
    const usuario = await this.prisma.usuario.findUnique({ where: { idUsuario } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    if (usuario.correo.toLowerCase() !== invitacion.correoInvitado.toLowerCase()) {
      throw new ForbiddenException('Esta invitación corresponde a otro correo electrónico.');
    }

    // Crear/actualizar membresía
    await this.prisma.$transaction(async (tx) => {
      await tx.membresia.upsert({
        where: {
          idUsuario_idOrganizacion: {
            idUsuario,
            idOrganizacion: invitacion.idOrganizacion,
          },
        },
        create: {
          idUsuario,
          idOrganizacion: invitacion.idOrganizacion,
          rol: invitacion.rolAsignado,
          estado: EstadoMembresia.ACTIVO,
          metodoIngreso: 'INVITACION',
        },
        update: {
          rol: invitacion.rolAsignado,
          estado: EstadoMembresia.ACTIVO,
          metodoIngreso: 'INVITACION',
        },
      });

      // Si el usuario no tiene organización activa, asignar ésta
      if (!usuario.idOrganizacionActual) {
        await tx.usuario.update({
          where: { idUsuario },
          data: { idOrganizacionActual: invitacion.idOrganizacion },
        });
      }

      await tx.invitacionOrganizacion.update({
        where: { token },
        data: {
          estado: EstadoInvitacion.ACEPTADA,
          fechaUso: new Date(),
        },
      });
    });

    return {
      mensaje: `Te has unido a "${invitacion.organizacion.nombre}" como ${invitacion.rolAsignado}.`,
      idOrganizacion: invitacion.idOrganizacion,
      nombreOrganizacion: invitacion.organizacion.nombre,
    };
  }

  async revocarInvitacion(idOrganizacion: number, idInvitacion: number) {
    const invitacion = await this.prisma.invitacionOrganizacion.findFirst({
      where: { idInvitacion, idOrganizacion },
    });
    if (!invitacion) throw new NotFoundException('Invitación no encontrada.');
    if (invitacion.estado !== EstadoInvitacion.PENDIENTE) {
      throw new BadRequestException('Solo se pueden revocar invitaciones pendientes.');
    }

    return this.prisma.invitacionOrganizacion.update({
      where: { idInvitacion },
      data: { estado: EstadoInvitacion.REVOCADA },
    });
  }

  async listarInvitaciones(idOrganizacion: number) {
    return this.prisma.invitacionOrganizacion.findMany({
      where: { idOrganizacion },
      include: {
        invitador: { select: { nombre: true, apellido: true, correo: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // CÓDIGO DE ACCESO A ORGANIZACIÓN
  // ─────────────────────────────────────────────────────────────────
  async generarCodigoAcceso(idOrganizacion: number) {
    const org = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');

    // Generar código único alfanumérico de 8 caracteres
    const codigo = crypto.randomBytes(4).toString('hex').toUpperCase();

    return this.prisma.organizacion.update({
      where: { idOrganizacion },
      data: { codigoAcceso: codigo },
      select: {
        idOrganizacion: true,
        nombre: true,
        codigoAcceso: true,
        codigoAccesoActivo: true,
        rolPredeterminadoCodigo: true,
        aprobacionRequerida: true,
      },
    });
  }

  async configurarCodigoAcceso(
    idOrganizacion: number,
    configuracion: {
      activo?: boolean;
      rol?: RolUsuario;
      aprobacionRequerida?: boolean;
    },
  ) {
    if (configuracion.rol === RolUsuario.SUPER_ADMIN || configuracion.rol === RolUsuario.ADMIN_ORGANIZACION) {
      throw new ForbiddenException('El código de acceso no puede otorgar roles administrativos.');
    }

    return this.prisma.organizacion.update({
      where: { idOrganizacion },
      data: {
        ...(configuracion.activo !== undefined && { codigoAccesoActivo: configuracion.activo }),
        ...(configuracion.rol && { rolPredeterminadoCodigo: configuracion.rol }),
        ...(configuracion.aprobacionRequerida !== undefined && {
          aprobacionRequerida: configuracion.aprobacionRequerida,
        }),
      },
      select: {
        idOrganizacion: true,
        nombre: true,
        codigoAcceso: true,
        codigoAccesoActivo: true,
        rolPredeterminadoCodigo: true,
        aprobacionRequerida: true,
      },
    });
  }

  async unirseConCodigo(codigoAcceso: string, idUsuario: number) {
    const org = await this.prisma.organizacion.findUnique({
      where: { codigoAcceso: codigoAcceso.toUpperCase().trim() },
    });

    if (!org) throw new NotFoundException('Código de organización no válido.');
    if (!org.codigoAccesoActivo) {
      throw new BadRequestException('El código de acceso para esta organización no está activo actualmente.');
    }

    // Verificar si ya es miembro
    const membresiaExistente = await this.prisma.membresia.findUnique({
      where: {
        idUsuario_idOrganizacion: {
          idUsuario,
          idOrganizacion: org.idOrganizacion,
        },
      },
    });

    if (membresiaExistente && membresiaExistente.estado === EstadoMembresia.ACTIVO) {
      throw new ConflictException('Ya eres miembro activo de esta organización.');
    }

    const estadoMembresia = org.aprobacionRequerida
      ? EstadoMembresia.PENDIENTE_APROBACION
      : EstadoMembresia.ACTIVO;

    await this.prisma.membresia.upsert({
      where: {
        idUsuario_idOrganizacion: {
          idUsuario,
          idOrganizacion: org.idOrganizacion,
        },
      },
      create: {
        idUsuario,
        idOrganizacion: org.idOrganizacion,
        rol: org.rolPredeterminadoCodigo,
        estado: estadoMembresia,
        metodoIngreso: 'CODIGO_ACCESO',
      },
      update: {
        rol: org.rolPredeterminadoCodigo,
        estado: estadoMembresia,
        metodoIngreso: 'CODIGO_ACCESO',
      },
    });

    const mensaje = org.aprobacionRequerida
      ? `Tu solicitud para unirte a "${org.nombre}" está pendiente de aprobación por un administrador.`
      : `Te has unido a "${org.nombre}" exitosamente.`;

    return {
      mensaje,
      idOrganizacion: org.idOrganizacion,
      nombreOrganizacion: org.nombre,
      estadoMembresia,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ESTADÍSTICAS DE USO DE IA (PANEL ADMINISTRADOR)
  // ─────────────────────────────────────────────────────────────────
  async obtenerUsosIa(idOrganizacion: number) {
    const org = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
      select: {
        limiteCorreccionesIaMes: true,
        plan: true,
        iaHabilitada: true,
      },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');

    const inicioMes = this.inicioDelMes();
    const siguienteMes = this.inicioSiguienteMes();

    const [totalEstesMes, historialUltimos3Meses] = await Promise.all([
      this.prisma.usoIaLog.count({
        where: { idOrganizacion, fecha: { gte: inicioMes } },
      }),
      this.prisma.usoIaLog.groupBy({
        by: ['proveedor'],
        where: { idOrganizacion, fecha: { gte: inicioMes } },
        _count: { idLog: true },
      }),
    ]);

    return {
      plan: org.plan,
      iaHabilitada: org.iaHabilitada,
      limite: org.limiteCorreccionesIaMes,
      usadas: totalEstesMes,
      disponibles: Math.max(0, org.limiteCorreccionesIaMes - totalEstesMes),
      porcentajeUsado:
        org.limiteCorreccionesIaMes > 0
          ? Math.round((totalEstesMes / org.limiteCorreccionesIaMes) * 100)
          : 0,
      reiniciaPeriodo: siguienteMes.toISOString(),
      porProveedor: historialUltimos3Meses.map((h) => ({
        proveedor: h.proveedor,
        cantidad: h._count.idLog,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────
  private inicioDelMes(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private inicioSiguienteMes(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
