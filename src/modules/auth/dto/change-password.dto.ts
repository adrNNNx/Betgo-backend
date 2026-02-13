// src/modules/auth/dto/change-password.dto.ts
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  Validate,
} from 'class-validator';
import { AUTH_CONSTANTS } from '../constants/auth.constants';
import { MatchPasswordsConstraint } from './register.dto';

export class ChangePasswordDto {
  @IsString({ message: 'La contraseña actual debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  currentPassword: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede tener más de 50 caracteres' })
  @Matches(AUTH_CONSTANTS.PATTERNS.PASSWORD, {
    message: 'La contraseña debe contener al menos: 1 mayúscula, 1 minúscula y 1 número',
  })
  newPassword: string;

  @IsString({ message: 'La confirmación de contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La confirmación de contraseña es requerida' })
  @Validate(MatchPasswordsConstraint)
  confirmPassword: string;

  // Para la validación personalizada
  get password(): string {
    return this.newPassword;
  }
}
