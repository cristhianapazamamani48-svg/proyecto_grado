import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.rol !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Acceso restringido únicamente a usuarios con rol SUPER_ADMIN.');
    }

    return true;
  }
}
