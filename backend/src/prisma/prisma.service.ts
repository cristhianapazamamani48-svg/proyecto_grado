import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, TipoPlan, RolUsuario } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.asegurarOrganizacionPorDefecto();
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
    } catch (err) {
      this.logger.error('Error al asegurar organización por defecto:', err);
    }
  }
}
