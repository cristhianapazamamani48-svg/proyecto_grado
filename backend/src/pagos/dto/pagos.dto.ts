import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProveedorPago, TipoPlan } from '@prisma/client';

export class CrearCheckoutDto {
  @IsOptional()
  @IsEnum(TipoPlan)
  plan?: TipoPlan;

  @IsOptional()
  @IsEnum(ProveedorPago)
  proveedor?: ProveedorPago;
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
