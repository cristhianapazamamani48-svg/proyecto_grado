import { Test, TestingModule } from '@nestjs/testing';
import { OrganizacionService } from './organizacion.service';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoMembresia, EstadoInvitacion, RolUsuario } from '@prisma/client';
import { NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';

describe('OrganizacionService', () => {
  let service: OrganizacionService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      organizacion: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      membresia: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      usuario: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      invitacionOrganizacion: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      usoIaLog: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizacionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<OrganizacionService>(OrganizacionService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('crearInvitacion', () => {
    it('debe lanzar ForbiddenException si se intenta invitar como SUPER_ADMIN', async () => {
      await expect(
        service.crearInvitacion(1, 10, 'docente@uub.edu', RolUsuario.SUPER_ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe crear una invitación correctamente con token único', async () => {
      prismaMock.organizacion.findUnique.mockResolvedValue({ idOrganizacion: 1, nombre: 'UUB Test' });
      prismaMock.usuario.findUnique.mockResolvedValue(null);
      prismaMock.invitacionOrganizacion.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.invitacionOrganizacion.create.mockImplementation(({ data }) => Promise.resolve({
        idInvitacion: 1,
        ...data,
      }));

      const res = await service.crearInvitacion(1, 10, 'docente@uub.edu', RolUsuario.DOCENTE);

      expect(res).toBeDefined();
      expect(res.correoInvitado).toBe('docente@uub.edu');
      expect(res.token).toHaveLength(96); // 48 hex bytes = 96 chars
    });
  });

  describe('unirseConCodigo', () => {
    it('debe lanzar NotFoundException si el código no existe', async () => {
      prismaMock.organizacion.findUnique.mockResolvedValue(null);
      await expect(service.unirseConCodigo('CODIGO_INVALIDO', 5)).rejects.toThrow(NotFoundException);
    });

    it('debe dejar la membresía PENDIENTE_APROBACION si aprobacionRequerida es true', async () => {
      prismaMock.organizacion.findUnique.mockResolvedValue({
        idOrganizacion: 1,
        nombre: 'UUB Org',
        codigoAcceso: 'ABC12345',
        codigoAccesoActivo: true,
        rolPredeterminadoCodigo: RolUsuario.DOCENTE,
        aprobacionRequerida: true,
      });
      prismaMock.membresia.findUnique.mockResolvedValue(null);
      prismaMock.membresia.upsert.mockResolvedValue({});

      const res = await service.unirseConCodigo('ABC12345', 5);

      expect(res.estadoMembresia).toBe(EstadoMembresia.PENDIENTE_APROBACION);
      expect(res.mensaje).toContain('pendiente de aprobación');
    });
  });
});
