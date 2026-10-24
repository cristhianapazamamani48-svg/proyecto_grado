import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProveedorPago, TipoPlan } from '@prisma/client';

export class CrearCheckoutDto {
  @IsOptional()
  @IsEnum(TipoPlan)
  plan?: TipoPlan;

  @IsOptional()
  @IsEnum(ProveedorPago)
  proveedor?: ProveedorPago;

  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 3, 12])
  periodoMeses?: number;
}

export class IdTransaccionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idTransaccion: number;
}

export class IdTransaccionExternaDto {
  @IsString()
  idTransaccionExterna: string;
}
