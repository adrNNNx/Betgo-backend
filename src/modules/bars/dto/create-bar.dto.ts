// src/modules/bars/dto/create-bar.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBarDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del bar es requerido' })
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9+\-\s]+$/, { message: 'Formato de teléfono inválido' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  freePlaysPerDay?: number = 3;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  barPercentage?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  poolPercentage?: number = 30;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  platformPercentage?: number = 20;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
