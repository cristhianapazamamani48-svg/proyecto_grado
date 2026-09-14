import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizacionActivaGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Superusuarios no están bloqueados por suspensión de organización individual
    if (!user || user.rol === 'SUPER_ADMIN') {
      return true;
    }

    if (user.tipo === 'USUARIO') {
      const dbUser = await this.prisma.usuario.findUnique({
        where: { idUsuario: Number(user.sub) },
        select: { idOrganizacionActual: true },
      });

      if (dbUser?.idOrganizacionActual) {
        const org = await this.prisma.organizacion.findUnique({
          where: { idOrganizacion: dbUser.idOrganizacionActual },
          select: { estado: true },
        });

        if (org && org.estado === 'INACTIVO') {
          throw new ForbiddenException(
            'La institución educativa se encuentra suspendida temporalmente. Contacte al administrador de la plataforma.',
          );
        }
      }
    }

    return true;
  }
}
