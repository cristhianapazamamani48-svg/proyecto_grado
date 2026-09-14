import { SuperadminGuard } from './guards/superadmin.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('SuperadminGuard', () => {
  let guard: SuperadminGuard;

  beforeEach(() => {
    guard = new SuperadminGuard();
  });

  it('debe permitir acceso si user.rol es SUPER_ADMIN', () => {
    const contextMock: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 1, correo: 'admin@uub.edu.pe', rol: 'SUPER_ADMIN' },
        }),
      }),
    };

    expect(guard.canActivate(contextMock)).toBe(true);
  });

  it('debe rechazar acceso con ForbiddenException si user.rol no es SUPER_ADMIN', () => {
    const contextMock: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 2, correo: 'docente@uub.edu.pe', rol: 'DOCENTE' },
        }),
      }),
    };

    expect(() => guard.canActivate(contextMock)).toThrow(ForbiddenException);
  });
});
