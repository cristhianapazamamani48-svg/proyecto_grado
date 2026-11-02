import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TipoPregunta } from '@prisma/client';

export class GenerarEvaluacionDto {
  @Transform(({ value }): unknown => {
    if (typeof value !== 'string') return value;
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : value;
    } catch {
      return value;
    }
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsEnum(TipoPregunta, { each: true })
  tiposPregunta!: TipoPregunta[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  cantidadPreguntas!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idiomaConfirmado?: string;
}

export class GenerarEvaluacionPorTemaDto extends GenerarEvaluacionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  tema!: string;
}
