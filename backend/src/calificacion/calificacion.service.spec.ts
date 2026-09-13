import { Test, TestingModule } from '@nestjs/testing';
import { CalificacionService } from './calificacion.service';
import { TipoPregunta, ModoCalificacionEspacio } from '@prisma/client';

describe('CalificacionService', () => {
  let service: CalificacionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalificacionService],
    }).compile();

    service = module.get<CalificacionService>(CalificacionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calificarRespuestaObjetiva', () => {
    it('califica correctamente OPCION_MULTIPLE', () => {
      const opciones = [
        { idOpcion: 1, esCorrecta: true },
        { idOpcion: 2, esCorrecta: false },
      ];
      const resCorrecta = service.calificarRespuestaObjetiva(
        TipoPregunta.OPCION_MULTIPLE,
        10,
        opciones,
        [1],
        [],
      );
      expect(resCorrecta.esCorrecta).toBe(true);
      expect(resCorrecta.puntaje).toBe(10);

      const resIncorrecta = service.calificarRespuestaObjetiva(
        TipoPregunta.OPCION_MULTIPLE,
        10,
        opciones,
        [2],
        [],
      );
      expect(resIncorrecta.esCorrecta).toBe(false);
      expect(resIncorrecta.puntaje).toBe(0);
    });

    it('califica correctamente SELECCION_MULTIPLE', () => {
      const opciones = [
        { idOpcion: 1, esCorrecta: true },
        { idOpcion: 2, esCorrecta: true },
        { idOpcion: 3, esCorrecta: false },
      ];
      const resCorrecta = service.calificarRespuestaObjetiva(
        TipoPregunta.SELECCION_MULTIPLE,
        5,
        opciones,
        [1, 2],
        [],
      );
      expect(resCorrecta.esCorrecta).toBe(true);
      expect(resCorrecta.puntaje).toBe(5);

      const resIncompleta = service.calificarRespuestaObjetiva(
        TipoPregunta.SELECCION_MULTIPLE,
        5,
        opciones,
        [1],
        [],
      );
      expect(resIncompleta.esCorrecta).toBe(false);
      expect(resIncompleta.puntaje).toBe(0);
    });

    it('califica correctamente COMPLETAR con coincidencia EXACTA e ignorando mayúsculas', () => {
      const espacios = [
        {
          numeroEspacio: 1,
          respuestasValidas: ['París', 'Paris'],
          modoCalificacion: ModoCalificacionEspacio.EXACTA,
          ignorarMayusculas: true,
        },
        {
          numeroEspacio: 2,
          respuestasValidas: ['Roma'],
          modoCalificacion: ModoCalificacionEspacio.EXACTA,
          ignorarMayusculas: true,
        },
      ];

      const resCompleta = service.calificarRespuestaObjetiva(
        TipoPregunta.COMPLETAR,
        10,
        [],
        [],
        espacios,
        { '1': 'paris', '2': 'ROMA' },
      );
      expect(resCompleta.esCorrecta).toBe(true);
      expect(resCompleta.puntaje).toBe(10);

      const resParcial = service.calificarRespuestaObjetiva(
        TipoPregunta.COMPLETAR,
        10,
        [],
        [],
        espacios,
        { '1': 'paris', '2': 'madrid' },
      );
      expect(resParcial.esCorrecta).toBe(false);
      expect(resParcial.puntaje).toBe(5);
    });

    it('retorna autoCalificada = false para ABIERTA', () => {
      const res = service.calificarRespuestaObjetiva(
        TipoPregunta.ABIERTA,
        10,
        [],
        [],
        [],
      );
      expect(res.autoCalificada).toBe(false);
      expect(res.puntaje).toBe(0);
      expect(res.esCorrecta).toBeNull();
    });
  });
});
