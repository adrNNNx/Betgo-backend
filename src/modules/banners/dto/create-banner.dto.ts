import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsUrl,
  IsDate,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * DTO para crear un banner.
 * Se recibe como multipart/form-data junto con el archivo de imagen.
 *
 * La imagen viaja en el campo 'file' del form-data (gestionado por FileInterceptor).
 */
export class CreateBannerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /**
   * ID del bar al que pertenece.
   * - null/undefined → banner GLOBAL (visible para todos los bares)
   * - uuid → banner LOCAL del bar
   */
  @IsOptional()
  @IsUUID()
  barId?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  linkUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  /**
   * Programación opcional: fecha de inicio de visibilidad (ISO 8601).
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  /**
   * Programación opcional: fecha de fin de visibilidad (ISO 8601).
   * Útil para publicidad pagada por tiempo.
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;
}
