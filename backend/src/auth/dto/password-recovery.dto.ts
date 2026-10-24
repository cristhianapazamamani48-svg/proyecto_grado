import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class OlvidePasswordDto {
  @IsEmail()
  correo: string;
}

export class RestablecerPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8)
  nuevaPassword: string;
}
