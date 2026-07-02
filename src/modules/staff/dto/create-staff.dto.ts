import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { StaffRole } from '../entities/staff.entity';

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
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password?: string;
}
