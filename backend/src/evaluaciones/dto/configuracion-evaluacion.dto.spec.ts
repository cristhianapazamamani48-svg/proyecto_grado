import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfiguracionEvaluacionDto } from './configuracion-evaluacion.dto';

describe('ConfiguracionEvaluacionDto', () => {
  it('accepts clearing time limits while validating boolean options', async () => {
    const dto = plainToInstance(ConfiguracionEvaluacionDto, {
      tiempoTotal: null,
      tiempoPorPregunta: null,
      permitirRetroceder: true,
      detectarCopiar: false,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.tiempoTotal).toBeNull();
    expect(dto.tiempoPorPregunta).toBeNull();
  });

  it('rejects time values outside the supported ranges', async () => {
    const dto = plainToInstance(ConfiguracionEvaluacionDto, {
      tiempoTotal: 0,
      tiempoPorPregunta: 2,
    });

    expect(await validate(dto)).toHaveLength(2);
  });
});
