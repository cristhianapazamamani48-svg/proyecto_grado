import { Test, TestingModule } from '@nestjs/testing';
import { SesionesService } from './sesiones.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalificacionService } from '../calificacion/calificacion.service';
import { JwtService } from '@nestjs/jwt';
import { EvaluacionGateway } from '../realtime/evaluacion.gateway';
import { BadRequestException } from '@nestjs/common';
import { EstadoSesion, EstadoParticipante, TipoPregunta, TipoEventoMonitoreo } from '@prisma/client';

describe('SesionesService', () => {
  let service: SesionesService;
  let prisma: any;
  let gateway: any;

  beforeEach(async () => {
    prisma = {
      evaluacion: {
        findUnique: jest.fn(),
      },
      sesion: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      participante: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pregunta: {
        findFirst: jest.fn(),
      },
      respuesta: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      eventoMonitoreo: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    gateway = {
      notificarAvanzarPregunta: jest.fn(),
      notificarSesionFinalizada: jest.fn(),
      notificarEventoMonitoreo: jest.fn(),
      notificarParticipanteActualizado: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SesionesService,
        CalificacionService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('jwt-token-test'),
          },
        },
        {
          provide: EvaluacionGateway,
          useValue: gateway,
        },
      ],
    }).compile();

    service = module.get<SesionesService>(SesionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Anti-Tampering y Validación de Tiempo', () => {
    it('rechaza guardar respuesta si tiempoTotal ha expirado', async () => {
      // Participante ingresó hace 70 minutos en un examen de 60 minutos
      const fechaIngresoExpirada = new Date(Date.now() - 70 * 60 * 1000);

      prisma.participante.findUnique.mockResolvedValue({
        idParticipante: 1,
        estado: EstadoParticipante.EN_PROGRESO,
        fechaIngreso: fechaIngresoExpirada,
        sesion: {
          idSesion: 10,
          idEvaluacion: 5,
          estado: EstadoSesion.ACTIVA,
          evaluacion: {
            idEvaluacion: 5,
            tiempoTotal: 60, // 60 minutos
            permitirModificar: true,
          },
        },
      });

      await expect(
        service.guardarRespuesta(1, {
          intentoId: '1',
          preguntaId: '100',
          textoRespuesta: 'Mi respuesta',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza guardar respuesta si la sesión está FINALIZADA', async () => {
      prisma.participante.findUnique.mockResolvedValue({
        idParticipante: 1,
        estado: EstadoParticipante.EN_PROGRESO,
        sesion: {
          idSesion: 10,
          estado: EstadoSesion.FINALIZADA,
          evaluacion: {},
        },
      });

      await expect(
        service.guardarRespuesta(1, {
          intentoId: '1',
          preguntaId: '100',
          textoRespuesta: 'Respuesta',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Monitoreo de Infracciones', () => {
    it('registra evento y emite via Socket.IO gateway', async () => {
      prisma.participante.findUnique.mockResolvedValue({
        idParticipante: 1,
        nombre: 'Estudiante Test',
        estado: EstadoParticipante.EN_PROGRESO,
        sesion: {
          idSesion: 10,
          codigo: 'ABC123',
          estado: EstadoSesion.ACTIVA,
        },
      });

      prisma.eventoMonitoreo.findFirst.mockResolvedValue(null);
      prisma.eventoMonitoreo.create.mockResolvedValue({
        idEvento: 50,
        idParticipante: 1,
        tipo: TipoEventoMonitoreo.CAMBIO_PESTANA,
        detalle: 'Cambio de pestaña',
        fechaEvento: new Date(),
      });

      const res = await service.registrarEventoMonitoreo(1, {
        tipo: TipoEventoMonitoreo.CAMBIO_PESTANA,
        detalle: 'Cambio de pestaña',
      });

      expect(res.idEvento).toBe(50);
      expect(gateway.notificarEventoMonitoreo).toHaveBeenCalledWith(
        'ABC123',
        expect.objectContaining({
          idParticipante: 1,
          tipo: TipoEventoMonitoreo.CAMBIO_PESTANA,
        }),
      );
    });
  });

  describe('Corrección Manual de Respuestas Abiertas', () => {
    it('asigna puntaje, marca como corregido y recalcula porcentaje', async () => {
      prisma.respuesta.findUnique.mockResolvedValue({
        idRespuesta: 88,
        idParticipante: 1,
        pregunta: {
          puntaje: 10,
          evaluacion: { idUsuario: 99 },
        },
        participante: {
          idParticipante: 1,
          sesion: {
            evaluacion: {
              preguntas: [{ puntaje: 10 }, { puntaje: 10 }], // Max = 20 pts
            },
          },
        },
      });

      prisma.respuesta.update.mockResolvedValue({
        idRespuesta: 88,
        puntaje: 8,
        corregidoDocente: true,
      });

      prisma.respuesta.findMany.mockResolvedValue([
        { idRespuesta: 88, puntaje: 8 },
        { idRespuesta: 89, puntaje: 10 },
      ]); // Total = 18 / 20 = 90%

      prisma.participante.update.mockResolvedValue({
        idParticipante: 1,
        puntajeTotal: 18,
        porcentaje: 90,
      });

      const res = await service.calificarRespuestaAbierta(99, 88, {
        puntaje: 8,
        comentario: 'Buen desarrollo',
      });

      expect(res.respuesta.puntaje).toBe(8);
      expect(res.participante.puntajeTotal).toBe(18);
      expect(res.participante.porcentaje).toBe(90);
    });
  });
});
