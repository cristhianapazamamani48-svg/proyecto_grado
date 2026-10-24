import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario, TipoPlan, EstadoSuscripcion } from '@prisma/client';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;
  let mail: MailService;

  beforeEach(async () => {
    const prismaMock = {
      usuario: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organizacion: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      membresia: {
        create: jest.fn(),
      },
      suscripcionOrganizacion: {
        create: jest.fn(),
      },
      tokenRecuperacion: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prismaMock.$transaction.mockImplementation((operacion) => operacion({
      usuario: prismaMock.usuario,
      tokenRecuperacion: prismaMock.tokenRecuperacion,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: MailService,
          useValue: {
            enviarRecuperacionPassword: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_jwt_token_123'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
    mail = module.get<MailService>(MailService);
  });

  describe('registrarDocente', () => {
    it('crea el usuario docente y le asigna su espacio personal individual', async () => {
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.usuario.create as jest.Mock).mockResolvedValueOnce({
        idUsuario: 1,
        nombre: 'Carlos',
        apellido: 'Pérez',
        correo: 'carlos@uub.edu',
        rol: RolUsuario.DOCENTE,
        idOrganizacionActual: null,
      });
      (prisma.organizacion.create as jest.Mock).mockResolvedValueOnce({
        idOrganizacion: 10,
        nombre: 'Espacio de Carlos',
        slug: 'docente-1-xyz',
        plan: TipoPlan.GRATUITO,
      });
      (prisma.membresia.create as jest.Mock).mockResolvedValueOnce({});
      (prisma.suscripcionOrganizacion.create as jest.Mock).mockResolvedValueOnce({});
      (prisma.usuario.update as jest.Mock).mockResolvedValueOnce({
        idUsuario: 1,
        idOrganizacionActual: 10,
      });

      const res = await service.registrarDocente('Carlos', 'Pérez', 'carlos@uub.edu', 'password123');

      expect(res.token).toBe('mock_jwt_token_123');
      expect(res.usuario.correo).toBe('carlos@uub.edu');
      expect(prisma.organizacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nombre: 'Espacio de Carlos',
          plan: TipoPlan.GRATUITO,
        }),
      });
      expect(prisma.membresia.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idUsuario: 1,
          idOrganizacion: 10,
          rol: RolUsuario.ADMIN_ORGANIZACION,
        }),
      });
    });

    it('rechaza si el correo ya está registrado', async () => {
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce({ idUsuario: 1 });
      await expect(service.registrarDocente('A', 'B', 'existe@uub.edu', '123')).rejects.toThrow(ConflictException);
    });
  });

  describe('loginDocente', () => {
    it('inicia sesión y asegura espacio personal si no lo tenía', async () => {
      const hash = await bcrypt.hash('clave123', 10);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce({
        idUsuario: 2,
        nombre: 'María',
        apellido: 'López',
        correo: 'maria@uub.edu',
        password: hash,
        rol: RolUsuario.DOCENTE,
        estado: 'ACTIVO',
        idOrganizacionActual: null,
      });
      (prisma.organizacion.create as jest.Mock).mockResolvedValueOnce({
        idOrganizacion: 20,
        nombre: 'Espacio de María',
        slug: 'docente-2-abc',
        plan: TipoPlan.GRATUITO,
      });
      (prisma.membresia.create as jest.Mock).mockResolvedValueOnce({});
      (prisma.suscripcionOrganizacion.create as jest.Mock).mockResolvedValueOnce({});
      (prisma.usuario.update as jest.Mock).mockResolvedValueOnce({
        idUsuario: 2,
        idOrganizacionActual: 20,
      });

      const res = await service.loginDocente('maria@uub.edu', 'clave123');

      expect(res.token).toBe('mock_jwt_token_123');
      expect(prisma.organizacion.create).toHaveBeenCalled();
    });

    it('rechaza con UnauthorizedException si la contraseña es incorrecta', async () => {
      const hash = await bcrypt.hash('correcta', 10);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce({
        idUsuario: 3,
        correo: 'profe@uub.edu',
        password: hash,
        estado: 'ACTIVO',
      });

      await expect(service.loginDocente('profe@uub.edu', 'incorrecta')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginConGoogle', () => {
    const payloadGoogle = {
      email: 'docente@uub.edu',
      email_verified: true,
      given_name: 'Ana',
      family_name: 'Docente',
    };

    const simularTokenGoogle = (payload: Record<string, unknown>) =>
      jest.spyOn(service as any, 'verificarTokenGoogle').mockResolvedValue(payload);

    it('rechaza un correo de Google no verificado', async () => {
      simularTokenGoogle({ ...payloadGoogle, email_verified: false });

      await expect(service.loginConGoogle('token')).rejects.toThrow('El correo de Google no está verificado.');
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it('rechaza un correo de Google sin verificación explícita', async () => {
      simularTokenGoogle({ email: payloadGoogle.email });

      await expect(service.loginConGoogle('token')).rejects.toThrow('El correo de Google no está verificado.');
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it('impide que un SUPER_ADMIN inicie sesión con Google', async () => {
      simularTokenGoogle(payloadGoogle);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce({
        idUsuario: 1,
        nombre: 'Admin',
        apellido: 'Principal',
        correo: payloadGoogle.email,
        estado: 'ACTIVO',
        rol: RolUsuario.SUPER_ADMIN,
        idOrganizacionActual: null,
      });

      await expect(service.loginConGoogle('token')).rejects.toThrow('Esta cuenta debe iniciar sesión con contraseña.');
    });

    it('rechaza a un docente cuya institución está INACTIVA', async () => {
      simularTokenGoogle(payloadGoogle);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce({
        idUsuario: 2,
        nombre: 'Ana',
        apellido: 'Docente',
        correo: payloadGoogle.email,
        estado: 'ACTIVO',
        rol: RolUsuario.DOCENTE,
        idOrganizacionActual: 12,
      });
      (prisma.organizacion.findUnique as jest.Mock).mockResolvedValueOnce({
        nombre: 'Colegio Suspendido',
        estado: 'INACTIVO',
      });

      await expect(service.loginConGoogle('token')).rejects.toThrow(
        'La institución educativa "Colegio Suspendido" se encuentra suspendida temporalmente. Contacte al administrador.',
      );
    });

    it('permite iniciar sesión a un docente existente de una institución activa', async () => {
      simularTokenGoogle(payloadGoogle);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce({
        idUsuario: 3,
        nombre: 'Ana',
        apellido: 'Docente',
        correo: payloadGoogle.email,
        estado: 'ACTIVO',
        rol: RolUsuario.DOCENTE,
        idOrganizacionActual: 13,
      });
      (prisma.organizacion.findUnique as jest.Mock).mockResolvedValueOnce({
        nombre: 'Colegio Activo',
        estado: 'ACTIVO',
      });

      const resultado = await service.loginConGoogle('token');

      expect(resultado.token).toBe('mock_jwt_token_123');
      expect(resultado.usuario.idUsuario).toBe(3);
    });

    it('crea y permite iniciar sesión a un docente nuevo', async () => {
      simularTokenGoogle(payloadGoogle);
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.usuario.create as jest.Mock).mockResolvedValueOnce({
        idUsuario: 4,
        nombre: 'Ana',
        apellido: 'Docente',
        correo: payloadGoogle.email,
        estado: 'ACTIVO',
        rol: RolUsuario.DOCENTE,
        idOrganizacionActual: null,
      });
      (prisma.organizacion.create as jest.Mock).mockResolvedValueOnce({
        idOrganizacion: 14,
        nombre: 'Espacio de Ana',
      });
      (prisma.membresia.create as jest.Mock).mockResolvedValueOnce({});
      (prisma.suscripcionOrganizacion.create as jest.Mock).mockResolvedValueOnce({});
      (prisma.usuario.update as jest.Mock).mockResolvedValueOnce({});
      (prisma.organizacion.findUnique as jest.Mock).mockResolvedValueOnce({
        nombre: 'Espacio de Ana',
        estado: 'ACTIVO',
      });

      const resultado = await service.loginConGoogle('token');

      expect(resultado.token).toBe('mock_jwt_token_123');
      expect(resultado.usuario.idUsuario).toBe(4);
      expect(prisma.organizacion.create).toHaveBeenCalled();
    });
  });

  describe('recuperacion de contrasena', () => {
    const correo = 'docente@uub.edu';
    const usuario = {
      idUsuario: 9,
      nombre: 'Ana',
      correo,
      rol: RolUsuario.DOCENTE,
    };

    it('guarda solo el hash del token y responde igual para un correo inexistente', async () => {
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce(usuario);
      (prisma.tokenRecuperacion.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
      (prisma.tokenRecuperacion.create as jest.Mock).mockResolvedValueOnce({});

      const existente = await service.solicitarRecuperacionPassword(correo);
      const enlace = (mail.enviarRecuperacionPassword as jest.Mock).mock.calls[0][0].enlace as string;
      const token = new URL(enlace).searchParams.get('token') as string;
      const tokenHash = (prisma.tokenRecuperacion.create as jest.Mock).mock.calls[0][0].data.tokenHash;

      (prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const inexistente = await service.solicitarRecuperacionPassword('nadie@uub.edu');

      expect(existente).toEqual(inexistente);
      expect(tokenHash).not.toBe(token);
      expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify((prisma.tokenRecuperacion.create as jest.Mock).mock.calls[0][0])).not.toContain(token);
    });

    it('restablece la contrasena con un token valido de un solo uso', async () => {
      (prisma.tokenRecuperacion.findUnique as jest.Mock).mockImplementation(({ where }) => Promise.resolve({
        idTokenRecuperacion: 3,
        idUsuario: usuario.idUsuario,
        tokenHash: where.tokenHash,
        expiraEn: new Date(Date.now() + 60 * 60 * 1000),
        usadoEn: null,
        usuario,
      }));
      (prisma.tokenRecuperacion.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
      (prisma.usuario.update as jest.Mock).mockResolvedValueOnce({});

      await expect(service.restablecerPassword('token-valido', 'nueva-clave')).resolves.toEqual({
        mensaje: 'Contrasena restablecida correctamente.',
      });
      const passwordHash = (prisma.usuario.update as jest.Mock).mock.calls[0][0].data.password;
      await expect(bcrypt.compare('nueva-clave', passwordHash)).resolves.toBe(true);
    });

    it.each([
      ['expirado', { expiraEn: new Date(Date.now() - 1000), usadoEn: null }],
      ['usado', { expiraEn: new Date(Date.now() + 1000), usadoEn: new Date() }],
      ['inexistente', null],
    ])('rechaza un token %s', async (_caso, datos) => {
      (prisma.tokenRecuperacion.findUnique as jest.Mock).mockResolvedValueOnce(
        datos && {
          idTokenRecuperacion: 3,
          idUsuario: usuario.idUsuario,
          usuario,
          ...datos,
        },
      );

      await expect(service.restablecerPassword('token-invalido', 'nueva-clave')).rejects.toThrow(
        'El enlace de recuperacion no es valido o ya vencio.',
      );
    });

    it('rechaza contrasenas de menos de ocho caracteres', async () => {
      await expect(service.restablecerPassword('token', 'corta')).rejects.toThrow(
        'La contrasena debe tener al menos 8 caracteres.',
      );
    });
  });
});
