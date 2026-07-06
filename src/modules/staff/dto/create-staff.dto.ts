import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { StaffRole } from '../entities/staff.entity';
import { AUTH_CONSTANTS } from '../../auth/constants/auth.constants';
import { Transform } from 'class-transformer';

export class CreateStaffDto {
  // Identifica al usuario a vincular: UUID, email o teléfono.
  // Si no existe, se crea (requiere `password` y que identifier sea teléfono).
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsEnum(StaffRole, { message: 'Rol de staff inválido' })
  role: StaffRole;

  @IsOptional()
  @IsUUID()
  barId?: string;

  // Datos usados solo cuando hay que CREAR el usuario:
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Ingrese un email válido' })
  @MaxLength(100, { message: 'El email no puede tener más de 100 caracteres' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  // Mismos requisitos que el registro de usuario.
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50, {
    message: 'La contraseña no puede tener más de 50 caracteres',
  })
  @Matches(AUTH_CONSTANTS.PATTERNS.PASSWORD, {
    message:
      'La contraseña debe contener al menos: 1 mayúscula, 1 minúscula y 1 número',
  })
  password?: string;
}
