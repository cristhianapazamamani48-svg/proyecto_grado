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
  EstadoGeneral,
  TipoPlan,
  EstadoMembresia,
} from '@prisma/client';

const LIMITES_PREDETERMINADOS: Record<TipoPlan, {
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
export class SuperadminService {
  private readonly logger = new Logger(SuperadminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  // HELPER AUDITORÍA
  // ─────────────────────────────────────────────────────────────────
  async registrarAuditoria(
    idUsuario: number,
    accion: string,
    recursoAfectado: string,
    idRecurso?: string,
    valoresAnteriores?: any,
    valoresNuevos?: any,
    ipOrigen?: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.auditoriaAdministrativa.create({
        data: {
          idUsuario,
          accion,
          recursoAfectado,
          idRecurso: idRecurso ? String(idRecurso) : null,
          valoresAnteriores: valoresAnteriores ? JSON.stringify(valoresAnteriores) : null,
          valoresNuevos: valoresNuevos ? JSON.stringify(valoresNuevos) : null,
          ipOrigen,
          userAgent,
        },
      });
    } catch (err) {
      this.logger.error('Error registrando auditoría administrativa:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // DASHBOARD DE SUPERUSUARIO
  // ─────────────────────────────────────────────────────────────────
  async obtenerResumenDashboard() {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [
      totalInstituciones,
      institucionesActivas,
      institucionesSuspendidas,
      totalUsuarios,
      totalDocentes,
      totalEstudiantes,
      totalEvaluaciones,
      sesionesActivas,
      correccionesIaMes,
      instituciones,
    ] = await Promise.all([
      this.prisma.organizacion.count(),
      this.prisma.organizacion.count({ where: { estado: EstadoGeneral.ACTIVO } }),
      this.prisma.organizacion.count({ where: { estado: EstadoGeneral.INACTIVO } }),
      this.prisma.usuario.count(),
      this.prisma.usuario.count({ where: { rol: RolUsuario.DOCENTE } }),
      this.prisma.estudiante.count(),
      this.prisma.evaluacion.count(),
      this.prisma.sesion.count({ where: { estado: 'ACTIVA' } }),
      this.prisma.usoIaLog.count({ where: { fecha: { gte: inicioMes } } }),
      this.prisma.organizacion.findMany({
        select: {
          idOrganizacion: true,
          nombre: true,
          plan: true,
          limiteDocentes: true,
          limiteEstudiantes: true,
          limiteEvaluaciones: true,
          limiteCorreccionesIaMes: true,
          _count: {
            select: {
              membresias: true,
              evaluaciones: true,
              estudiantes: true,
            },
          },
        },
      }),
    ]);

    // Calcular instituciones cercanas a sus límites (>= 80%)
    const institucionesAlerta: any[] = [];
    for (const org of instituciones) {
      const usadasIa = await this.prisma.usoIaLog.count({
        where: { idOrganizacion: org.idOrganizacion, fecha: { gte: inicioMes } },
      });

      const pctDocentes = org.limiteDocentes > 0 ? (org._count.membresias / org.limiteDocentes) * 100 : 0;
      const pctEvaluaciones = org.limiteEvaluaciones > 0 ? (org._count.evaluaciones / org.limiteEvaluaciones) * 100 : 0;
      const pctIa = org.limiteCorreccionesIaMes > 0 ? (usadasIa / org.limiteCorreccionesIaMes) * 100 : 0;

      if (pctDocentes >= 80 || pctEvaluaciones >= 80 || pctIa >= 80) {
        institucionesAlerta.push({
          idOrganizacion: org.idOrganizacion,
          nombre: org.nombre,
          plan: org.plan,
          pctDocentes: Math.round(pctDocentes),
          pctEvaluaciones: Math.round(pctEvaluaciones),
          pctIa: Math.round(pctIa),
        });
      }
    }

    return {
      instituciones: {
        total: totalInstituciones,
        activas: institucionesActivas,
        suspendidas: institucionesSuspendidas,
      },
      usuarios: {
        total: totalUsuarios,
        docentes: totalDocentes,
        estudiantes: totalEstudiantes,
      },
      evaluaciones: {
        total: totalEvaluaciones,
        sesionesActivas,
      },
      ia: {
        correccionesEsteMes: correccionesIaMes,
        proveedorActual: process.env.AI_PROVIDER || 'mock',
        modeloActual: process.env.AI_MODEL || 'mock-v1',
      },
      alertas: institucionesAlerta,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // GESTIÓN DE INSTITUCIONES
  // ─────────────────────────────────────────────────────────────────
  async listarInstituciones(query?: { q?: string; estado?: EstadoGeneral; plan?: TipoPlan }) {
    const where: any = {};

    if (query?.q) {
      where.OR = [
        { nombre: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query?.estado) where.estado = query.estado;
    if (query?.plan) where.plan = query.plan;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const instituciones = await this.prisma.organizacion.findMany({
      where,
      include: {
        _count: {
          select: {
            membresias: true,
            evaluaciones: true,
            estudiantes: true,
          },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    });

    const resultado = await Promise.all(
      instituciones.map(async (org) => {
        const usadasIa = await this.prisma.usoIaLog.count({
          where: { idOrganizacion: org.idOrganizacion, fecha: { gte: inicioMes } },
        });

        return {
          idOrganizacion: org.idOrganizacion,
          nombre: org.nombre,
          slug: org.slug,
          estado: org.estado,
          plan: org.plan,
          limiteDocentes: org.limiteDocentes,
          limiteEstudiantes: org.limiteEstudiantes,
          limiteEvaluaciones: org.limiteEvaluaciones,
          limiteCorreccionesIaMes: org.limiteCorreccionesIaMes,
          iaHabilitada: org.iaHabilitada,
          codigoAcceso: org.codigoAcceso,
          codigoAccesoActivo: org.codigoAccesoActivo,
          aprobacionRequerida: org.aprobacionRequerida,
          totalDocentes: org._count.membresias,
          totalEstudiantes: org._count.estudiantes,
          totalEvaluaciones: org._count.evaluaciones,
          usoIaMes: usadasIa,
          fechaCreacion: org.fechaCreacion,
        };
      }),
    );

    return resultado;
  }

  async crearInstitucion(
    idSuperAdmin: number,
    data: {
      nombre: string;
      slug: string;
      plan?: TipoPlan;
      limiteDocentes?: number;
      limiteEstudiantes?: number;
      limiteEvaluaciones?: number;
      limiteCorreccionesIaMes?: number;
      iaHabilitada?: boolean;
      codigoAccesoActivo?: boolean;
      aprobacionRequerida?: boolean;
    },
    ip?: string,
    ua?: string,
  ) {
    const slugNormalizado = data.slug.toLowerCase().trim();
    const existe = await this.prisma.organizacion.findUnique({
      where: { slug: slugNormalizado },
    });
    if (existe) {
      throw new ConflictException(`Ya existe una institución educativa con el slug '${slugNormalizado}'.`);
    }

    const planElegido = data.plan || TipoPlan.GRATUITO;
    const limitesDefecto = LIMITES_PREDETERMINADOS[planElegido];

    const org = await this.prisma.organizacion.create({
      data: {
        nombre: data.nombre.trim(),
        slug: slugNormalizado,
        plan: planElegido,
        limiteDocentes: data.limiteDocentes ?? limitesDefecto.limiteDocentes,
        limiteEstudiantes: data.limiteEstudiantes ?? limitesDefecto.limiteEstudiantes,
        limiteEvaluaciones: data.limiteEvaluaciones ?? limitesDefecto.limiteEvaluaciones,
        limiteCorreccionesIaMes:
          data.limiteCorreccionesIaMes ?? limitesDefecto.limiteCorreccionesIaMes,
        iaHabilitada: data.iaHabilitada ?? true,
        codigoAccesoActivo: data.codigoAccesoActivo ?? false,
        aprobacionRequerida: data.aprobacionRequerida ?? true,
      },
    });

    await this.registrarAuditoria(
      idSuperAdmin,
      'CREAR_INSTITUCION',
      'Organizacion',
      String(org.idOrganizacion),
      null,
      org,
      ip,
      ua,
    );

    return org;
  }

  async obtenerDetalleInstitucion(idOrganizacion: number) {
    const org = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
      include: {
        membresias: {
          include: {
            usuario: {
              select: {
                idUsuario: true,
                nombre: true,
                apellido: true,
                correo: true,
                rol: true,
                estado: true,
              },
            },
          },
        },
        evaluaciones: {
          take: 10,
          orderBy: { fechaCreacion: 'desc' },
          select: {
            idEvaluacion: true,
            nombre: true,
            estado: true,
            fechaCreacion: true,
          },
        },
        _count: {
          select: {
            membresias: true,
            evaluaciones: true,
            estudiantes: true,
            invitaciones: true,
          },
        },
      },
    });

    if (!org) throw new NotFoundException('Institución educativa no encontrada.');

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const usoIaMes = await this.prisma.usoIaLog.count({
      where: { idOrganizacion, fecha: { gte: inicioMes } },
    });

    return {
      ...org,
      usoIa: {
        usadas: usoIaMes,
        limite: org.limiteCorreccionesIaMes,
        disponibles: Math.max(0, org.limiteCorreccionesIaMes - usoIaMes),
        iaHabilitada: org.iaHabilitada,
      },
    };
  }

  async actualizarInstitucion(
    idSuperAdmin: number,
    idOrganizacion: number,
    data: {
      nombre?: string;
      slug?: string;
      limiteDocentes?: number;
      limiteEstudiantes?: number;
      limiteEvaluaciones?: number;
      limiteCorreccionesIaMes?: number;
      iaHabilitada?: boolean;
      codigoAccesoActivo?: boolean;
      aprobacionRequerida?: boolean;
    },
    ip?: string,
    ua?: string,
  ) {
    const orgAnterior = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
    });
    if (!orgAnterior) throw new NotFoundException('Institución educativa no encontrada.');

    if (data.slug && data.slug.toLowerCase().trim() !== orgAnterior.slug) {
      const existeSlug = await this.prisma.organizacion.findUnique({
        where: { slug: data.slug.toLowerCase().trim() },
      });
      if (existeSlug) {
        throw new ConflictException(`El slug '${data.slug}' ya está en uso.`);
      }
    }

    const orgActualizada = await this.prisma.organizacion.update({
      where: { idOrganizacion },
      data: {
        ...(data.nombre && { nombre: data.nombre.trim() }),
        ...(data.slug && { slug: data.slug.toLowerCase().trim() }),
        ...(data.limiteDocentes !== undefined && { limiteDocentes: data.limiteDocentes }),
        ...(data.limiteEstudiantes !== undefined && { limiteEstudiantes: data.limiteEstudiantes }),
        ...(data.limiteEvaluaciones !== undefined && { limiteEvaluaciones: data.limiteEvaluaciones }),
        ...(data.limiteCorreccionesIaMes !== undefined && {
          limiteCorreccionesIaMes: data.limiteCorreccionesIaMes,
        }),
        ...(data.iaHabilitada !== undefined && { iaHabilitada: data.iaHabilitada }),
        ...(data.codigoAccesoActivo !== undefined && { codigoAccesoActivo: data.codigoAccesoActivo }),
        ...(data.aprobacionRequerida !== undefined && {
          aprobacionRequerida: data.aprobacionRequerida,
        }),
      },
    });

    await this.registrarAuditoria(
      idSuperAdmin,
      'EDITAR_INSTITUCION',
      'Organizacion',
      String(idOrganizacion),
      orgAnterior,
      orgActualizada,
      ip,
      ua,
    );

    return orgActualizada;
  }

  async cambiarEstadoInstitucion(
    idSuperAdmin: number,
    idOrganizacion: number,
    estado: EstadoGeneral,
    ip?: string,
    ua?: string,
  ) {
    const orgAnterior = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
    });
    if (!orgAnterior) throw new NotFoundException('Institución educativa no encontrada.');

    const orgActualizada = await this.prisma.organizacion.update({
      where: { idOrganizacion },
      data: { estado },
    });

    await this.registrarAuditoria(
      idSuperAdmin,
      estado === EstadoGeneral.INACTIVO ? 'SUSPENDER_INSTITUCION' : 'ACTIVAR_INSTITUCION',
      'Organizacion',
      String(idOrganizacion),
      { estado: orgAnterior.estado },
      { estado: orgActualizada.estado },
      ip,
      ua,
    );

    return orgActualizada;
  }

  async cambiarPlanInstitucion(
    idSuperAdmin: number,
    idOrganizacion: number,
    plan: TipoPlan,
    ajustarLimitesDefault = true,
    ip?: string,
    ua?: string,
  ) {
    const orgAnterior = await this.prisma.organizacion.findUnique({
      where: { idOrganizacion },
    });
    if (!orgAnterior) throw new NotFoundException('Institución educativa no encontrada.');

    const limites = LIMITES_PREDETERMINADOS[plan];

    const orgActualizada = await this.prisma.organizacion.update({
      where: { idOrganizacion },
      data: {
        plan,
        ...(ajustarLimitesDefault && {
          limiteDocentes: limites.limiteDocentes,
          limiteEstudiantes: limites.limiteEstudiantes,
          limiteEvaluaciones: limites.limiteEvaluaciones,
          limiteCorreccionesIaMes: limites.limiteCorreccionesIaMes,
        }),
      },
    });

    await this.registrarAuditoria(
      idSuperAdmin,
      'CAMBIAR_PLAN_INSTITUCION',
      'Organizacion',
      String(idOrganizacion),
      { plan: orgAnterior.plan, limites: orgAnterior.limiteDocentes },
      { plan: orgActualizada.plan, limites: orgActualizada.limiteDocentes },
      ip,
      ua,
    );

    return orgActualizada;
  }

  // ─────────────────────────────────────────────────────────────────
  // GESTIÓN DE USUARIOS Y MEMBRESÍAS
  // ─────────────────────────────────────────────────────────────────
  async listarUsuariosGlobal(query?: {
    q?: string;
    idOrganizacion?: number;
    rol?: RolUsuario;
    estado?: EstadoGeneral;
  }) {
    const where: any = {};

    if (query?.q) {
      where.OR = [
        { nombre: { contains: query.q, mode: 'insensitive' } },
        { apellido: { contains: query.q, mode: 'insensitive' } },
        { correo: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query?.rol) where.rol = query.rol;
    if (query?.estado) where.estado = query.estado;
    if (query?.idOrganizacion) {
      where.membresias = {
        some: { idOrganizacion: Number(query.idOrganizacion) },
      };
    }

    return this.prisma.usuario.findMany({
      where,
      include: {
        membresias: {
          include: {
            organizacion: { select: { idOrganizacion: true, nombre: true, slug: true } },
          },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async cambiarEstadoUsuario(
    idSuperAdmin: number,
    idUsuario: number,
    estado: EstadoGeneral,
    ip?: string,
    ua?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { idUsuario } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    if (usuario.rol === RolUsuario.SUPER_ADMIN && estado === EstadoGeneral.INACTIVO) {
      const superAdminsActivos = await this.prisma.usuario.count({
        where: { rol: RolUsuario.SUPER_ADMIN, estado: EstadoGeneral.ACTIVO },
      });
      if (superAdminsActivos <= 1) {
        throw new ForbiddenException(
          'No se puede desactivar al único Superusuario activo del sistema.',
        );
      }
    }

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { idUsuario },
      data: { estado },
    });

    await this.registrarAuditoria(
      idSuperAdmin,
      'CAMBIAR_ESTADO_USUARIO',
      'Usuario',
      String(idUsuario),
      { estado: usuario.estado },
      { estado: usuarioActualizado.estado },
      ip,
      ua,
    );

    return usuarioActualizado;
  }

  async cambiarRolUsuario(
    idSuperAdmin: number,
    idUsuario: number,
    nuevoRol: RolUsuario,
    ip?: string,
    ua?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { idUsuario } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    // Proteger no degradar al único SUPER_ADMIN
    if (usuario.rol === RolUsuario.SUPER_ADMIN && nuevoRol !== RolUsuario.SUPER_ADMIN) {
      const otrosSuperAdmins = await this.prisma.usuario.count({
        where: { rol: RolUsuario.SUPER_ADMIN, estado: EstadoGeneral.ACTIVO },
      });
      if (otrosSuperAdmins <= 1) {
        throw new ForbiddenException(
          'No se puede degradar o eliminar el rol del único Superusuario del sistema.',
        );
      }
    }

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { idUsuario },
      data: { rol: nuevoRol },
    });

    await this.registrarAuditoria(
      idSuperAdmin,
      'CAMBIAR_ROL_USUARIO',
      'Usuario',
      String(idUsuario),
      { rol: usuario.rol },
      { rol: usuarioActualizado.rol },
      ip,
      ua,
    );

    return usuarioActualizado;
  }

  async asignarUsuarioInstitucion(
    idSuperAdmin: number,
    idUsuario: number,
    idOrganizacion: number,
    rol: RolUsuario = RolUsuario.DOCENTE,
    ip?: string,
    ua?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { idUsuario } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    const org = await this.prisma.organizacion.findUnique({ where: { idOrganizacion } });
    if (!org) throw new NotFoundException('Institución no encontrada.');

    const membresia = await this.prisma.membresia.upsert({
      where: {
        idUsuario_idOrganizacion: {
          idUsuario,
          idOrganizacion,
        },
      },
      create: {
        idUsuario,
        idOrganizacion,
        rol,
        estado: EstadoMembresia.ACTIVO,
        metodoIngreso: 'SUPERADMIN_ASIGNACION',
      },
      update: {
        rol,
        estado: EstadoMembresia.ACTIVO,
      },
    });

    if (!usuario.idOrganizacionActual) {
      await this.prisma.usuario.update({
        where: { idUsuario },
        data: { idOrganizacionActual: idOrganizacion },
      });
    }

    await this.registrarAuditoria(
      idSuperAdmin,
      'ASIGNAR_MEMBRESIA_INSTITUCION',
      'Membresia',
      String(membresia.idMembresia),
      null,
      { idUsuario, idOrganizacion, rol },
      ip,
      ua,
    );

    return membresia;
  }

  async retirarUsuarioInstitucion(
    idSuperAdmin: number,
    idUsuario: number,
    idOrganizacion: number,
    ip?: string,
    ua?: string,
  ) {
    const membresia = await this.prisma.membresia.findUnique({
      where: {
        idUsuario_idOrganizacion: {
          idUsuario,
          idOrganizacion,
        },
      },
    });
    if (!membresia) throw new NotFoundException('Membresía no encontrada.');

    await this.prisma.membresia.delete({
      where: {
        idUsuario_idOrganizacion: {
          idUsuario,
          idOrganizacion,
        },
      },
    });

    await this.registrarAuditoria(
      idSuperAdmin,
      'RETIRAR_MEMBRESIA_INSTITUCION',
      'Membresia',
      String(membresia.idMembresia),
      membresia,
      null,
      ip,
      ua,
    );

    return { mensaje: 'Usuario retirado de la institución educativa.' };
  }

  // ─────────────────────────────────────────────────────────────────
  // CONSUMO DE IA GLOBAL
  // ─────────────────────────────────────────────────────────────────
  async obtenerConsumoIaGlobal() {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [totalHistorico, totalEsteMes, desglosadoPorOrg] = await Promise.all([
      this.prisma.usoIaLog.count(),
      this.prisma.usoIaLog.count({ where: { fecha: { gte: inicioMes } } }),
      this.prisma.usoIaLog.groupBy({
        by: ['idOrganizacion'],
        where: { fecha: { gte: inicioMes } },
        _count: { idLog: true },
        _sum: { tokensUtilizados: true },
      }),
    ]);

    const institucionesConDetalle = await Promise.all(
      desglosadoPorOrg.map(async (item) => {
        const org = await this.prisma.organizacion.findUnique({
          where: { idOrganizacion: item.idOrganizacion },
          select: { nombre: true, slug: true, plan: true, limiteCorreccionesIaMes: true },
        });

        return {
          idOrganizacion: item.idOrganizacion,
          nombre: org?.nombre || 'Desconocida',
          slug: org?.slug || '',
          plan: org?.plan || 'GRATUITO',
          usadasMes: item._count.idLog,
          limiteMes: org?.limiteCorreccionesIaMes || 50,
          tokens: item._sum.tokensUtilizados || 0,
        };
      }),
    );

    return {
      proveedorConfigurado: process.env.AI_PROVIDER || 'mock',
      modeloConfigurado: process.env.AI_MODEL || 'mock-v1',
      consumoMesActual: totalEsteMes,
      consumoHistorico: totalHistorico,
      desglosePorInstitucion: institucionesConDetalle,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // VISOR DE AUDITORÍA
  // ─────────────────────────────────────────────────────────────────
  async obtenerAuditoria(query?: { q?: string; idUsuario?: number }) {
    const where: any = {};
    if (query?.idUsuario) where.idUsuario = Number(query.idUsuario);
    if (query?.q) {
      where.OR = [
        { accion: { contains: query.q, mode: 'insensitive' } },
        { recursoAfectado: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.auditoriaAdministrativa.findMany({
      where,
      include: {
        usuario: { select: { nombre: true, apellido: true, correo: true, rol: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 100,
    });
  }
}
