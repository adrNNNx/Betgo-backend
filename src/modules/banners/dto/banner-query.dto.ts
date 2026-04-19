import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * Filtros para GET /banners (panel admin).
 */
export class BannerQueryDto {
  @IsOptional()
  @IsUUID()
  barId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isGlobal?: boolean;
}

/**
 * Filtros para GET /banners/active (consumido por el frontend público).
 * Si se envía barId, devuelve globales + del bar; si no, solo globales.
 */
export class ActiveBannerQueryDto {
  @IsOptional()
  @IsUUID()
  barId?: string;
}
