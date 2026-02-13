// src/modules/auth/dto/login.dto.ts
import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

export class LoginDto {
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    let p = value.replace(/\s+/g, '');

    if (p.startsWith('+595')) p = p.substring(4);
    else if (p.startsWith('595')) p = p.substring(3);
    else if (p.startsWith('0')) p = p.substring(1);

    return p;
  })
  @Matches(AUTH_CONSTANTS.PATTERNS.PHONE, {
    message: 'El teléfono debe tener formato válido (ej: 0981123456)',
  })
  phone: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  // Opcional: información del dispositivo para tracking
  deviceInfo?: string;
}
