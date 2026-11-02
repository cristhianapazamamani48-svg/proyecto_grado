import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ConfiguracionEvaluacionDto {
  @IsOptional()
  @Transform(({ value }): unknown =>
    value === null || value === undefined ? value : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(1440)
  tiempoTotal?: number | null;

  @IsOptional()
  @Transform(({ value }): unknown =>
    value === null || value === undefined ? value : Number(value),
  )
  @IsInt()
  @Min(5)
  @Max(86400)
  tiempoPorPregunta?: number | null;

  @IsOptional()
  @IsBoolean()
  permitirRetroceder?: boolean;

  @IsOptional()
  @IsBoolean()
  permitirModificar?: boolean;

  @IsOptional()
  @IsBoolean()
  permitirDejarEnBlanco?: boolean;

  @IsOptional()
  @IsBoolean()
  aleatorizarPreguntas?: boolean;

  @IsOptional()
  @IsBoolean()
  aleatorizarOpciones?: boolean;

  @IsOptional()
  @IsBoolean()
  detectarCambioPestana?: boolean;

  @IsOptional()
  @IsBoolean()
  detectarClickDerecho?: boolean;

  @IsOptional()
  @IsBoolean()
  detectarCopiar?: boolean;

  @IsOptional()
  @IsBoolean()
  detectarPegar?: boolean;

  @IsOptional()
  @IsBoolean()
  detectarRedimensionar?: boolean;
}
