import { Test, TestingModule } from '@nestjs/testing';
import { SuperadminService } from './superadmin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario, EstadoGeneral, TipoPlan } from '@prisma/client';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';

describe('SuperadminService', () => {
  let service: SuperadminService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      organizacion: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      usuario: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      estudiante: {
        count: jest.fn(),
      },
      evaluacion: {
        count: jest.fn(),
      },
      sesionEvaluacion: {
        count: jest.fn(),
      },
      usoIaLog: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      auditoriaAdministrativa: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      membresia: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperadminService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SuperadminService>(SuperadminService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('crearInstitucion', () => {
    it('debe lanzar ConflictException si el slug ya existe', async () => {
      prismaMock.organizacion.findUnique.mockResolvedValue({ idOrganizacion: 1, slug: 'uub-colegio' });

      await expect(
        service.crearInstitucion(1, { nombre: 'Colegio UUB', slug: 'uub-colegio' }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe crear una institución correctamente con límites por defecto', async () => {
      prismaMock.organizacion.findUnique.mockResolvedValue(null);
      prismaMock.organizacion.create.mockImplementation(({ data }) => Promise.resolve({
        idOrganizacion: 10,
        ...data,
      }));

      const res = await service.crearInstitucion(1, {
        nombre: 'Universidad UUB Test',
        slug: 'universidad-uub-test',
        plan: TipoPlan.BASICO,
      });

      expect(res).toBeDefined();
      expect(res.limiteDocentes).toBe(25);
      expect(res.limiteEstudiantes).toBe(500);
      expect(prismaMock.auditoriaAdministrativa.create).toHaveBeenCalled();
    });
  });

  describe('cambiarRolUsuario', () => {
    it('debe prohibir degradar al único Superusuario activo', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({
        idUsuario: 1,
        rol: RolUsuario.SUPER_ADMIN,
        estado: EstadoGeneral.ACTIVO,
      });
      prismaMock.usuario.count.mockResolvedValue(1); // Solo 1 Superadmin

      await expect(
        service.cambiarRolUsuario(1, 1, RolUsuario.DOCENTE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe permitir cambiar el rol si hay más de un Superusuario', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({
        idUsuario: 2,
        rol: RolUsuario.SUPER_ADMIN,
        estado: EstadoGeneral.ACTIVO,
      });
      prismaMock.usuario.count.mockResolvedValue(2); // 2 Superadmins
      prismaMock.usuario.update.mockResolvedValue({
        idUsuario: 2,
        rol: RolUsuario.DOCENTE,
      });

      const res = await service.cambiarRolUsuario(1, 2, RolUsuario.DOCENTE);
      expect(res.rol).toBe(RolUsuario.DOCENTE);
    });
  });

  describe('cambiarEstadoInstitucion', () => {
    it('debe suspender la institución y registrar auditoría', async () => {
      prismaMock.organizacion.findUnique.mockResolvedValue({
        idOrganizacion: 5,
        estado: EstadoGeneral.ACTIVO,
      });
      prismaMock.organizacion.update.mockResolvedValue({
        idOrganizacion: 5,
        estado: EstadoGeneral.INACTIVO,
      });

      const res = await service.cambiarEstadoInstitucion(1, 5, EstadoGeneral.INACTIVO);
      expect(res.estado).toBe(EstadoGeneral.INACTIVO);
      expect(prismaMock.auditoriaAdministrativa.create).toHaveBeenCalled();
    });
  });
});
