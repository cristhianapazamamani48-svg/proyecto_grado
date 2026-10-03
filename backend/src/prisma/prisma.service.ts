import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, TipoPlan, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.asegurarOrganizacionPorDefecto();
    await this.asegurarSuperAdmin();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async asegurarOrganizacionPorDefecto() {
    try {
      let defaultOrg = await this.organizacion.findUnique({
        where: { slug: 'default-uub' },
      });

      if (!defaultOrg) {
        defaultOrg = await this.organizacion.create({
          data: {
            nombre: 'Organización Principal',
            slug: 'default-uub',
            plan: TipoPlan.INSTITUCIONAL,
            limiteDocentes: 100,
            limiteEstudiantes: 1000,
            limiteEvaluaciones: 500,
            limiteCorreccionesIaMes: 1000,
            iaHabilitada: true,
          },
        });
        this.logger.log(`Organización por defecto creada (ID: ${defaultOrg.idOrganizacion}).`);
      }

      // Migrar usuarios sin organización
      const usuariosSinOrg = await this.usuario.findMany({
        where: { idOrganizacionActual: null },
      });

      for (const u of usuariosSinOrg) {
        await this.usuario.update({
          where: { idUsuario: u.idUsuario },
          data: { idOrganizacionActual: defaultOrg.idOrganizacion },
        });

        await this.membresia.upsert({
          where: {
            idUsuario_idOrganizacion: {
              idUsuario: u.idUsuario,
              idOrganizacion: defaultOrg.idOrganizacion,
            },
          },
          update: {},
          create: {
            idUsuario: u.idUsuario,
            idOrganizacion: defaultOrg.idOrganizacion,
            rol: u.rol || RolUsuario.DOCENTE,
          },
        });
      }

      // Migrar evaluaciones sin organización
      await this.evaluacion.updateMany({
        where: { idOrganizacion: null },
        data: { idOrganizacion: defaultOrg.idOrganizacion },
      });

      // Migrar estudiantes sin organización
      await this.estudiante.updateMany({
        where: { idOrganizacion: null },
        data: { idOrganizacion: defaultOrg.idOrganizacion },
      });

      // Asegurar suscripción para todas las organizaciones existentes
      const orgs = await this.organizacion.findMany({
        include: { suscripcion: true },
      });

      for (const org of orgs) {
        if (!org.suscripcion) {
          await this.suscripcionOrganizacion.create({
            data: {
              idOrganizacion: org.idOrganizacion,
              plan: org.plan || TipoPlan.GRATUITO,
              monto: org.plan === TipoPlan.MAESTRO_PRO ? 7.25 : org.plan === TipoPlan.BASICO ? 29.00 : org.plan === TipoPlan.INSTITUCIONAL ? 99.00 : 0,
              montoLocal: org.plan === TipoPlan.MAESTRO_PRO ? 50.00 : 0,
              moneda: 'USD',
              monedaLocal: 'BOB',
              estado: 'ACTIVA',
              autoRenovar: true,
            },
          });
          this.logger.log(`Suscripción inicial creada para org '${org.nombre}' (ID: ${org.idOrganizacion}).`);
        }
      }
    } catch (err) {
      this.logger.error('Error al asegurar organización por defecto:', err);
    }
  }

  async asegurarSuperAdmin() {
    try {
      const superadminExistente = await this.usuario.findFirst({
        where: { rol: RolUsuario.SUPER_ADMIN },
      });

      if (!superadminExistente) {
        const correo = process.env.SUPERADMIN_EMAIL || 'superadmin@uub.edu.pe';
        const rawPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdminSecret2026!';
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        const superAdmin = await this.usuario.create({
          data: {
            nombre: 'Super',
            apellido: 'Administrador',
            correo: correo.toLowerCase(),
            password: passwordHash,
            rol: RolUsuario.SUPER_ADMIN,
          },
        });

        this.logger.log(`Superusuario inicial creado exitosamente (${superAdmin.correo}).`);
      }
    } catch (err) {
      this.logger.error('Error al asegurar Superusuario inicial:', err);
    }
  }
}
