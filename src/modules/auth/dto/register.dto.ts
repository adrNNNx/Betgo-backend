// src/modules/auth/dto/register.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

// Validador personalizado para confirmar contraseña
@ValidatorConstraint({ name: 'matchPasswords', async: false })
export class MatchPasswordsConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments) {
    const object = args.object as RegisterDto;
    return confirmPassword === object.password;
  }

  defaultMessage() {
    return AUTH_CONSTANTS.ERRORS.PASSWORDS_DO_NOT_MATCH;
  }
}

export class RegisterDto {
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

  @IsOptional()
  @IsEmail({}, { message: 'Ingrese un email válido' })
  @MaxLength(100, { message: 'El email no puede tener más de 100 caracteres' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50, {
    message: 'La contraseña no puede tener más de 50 caracteres',
  })
  @Matches(AUTH_CONSTANTS.PATTERNS.PASSWORD, {
    message:
      'La contraseña debe contener al menos: 1 mayúscula, 1 minúscula y 1 número',
  })
  password: string;

  @IsString({
    message: 'La confirmación de contraseña debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'La confirmación de contraseña es requerida' })
  @Validate(MatchPasswordsConstraint)
  confirmPassword: string;

  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  name?: string;
}
