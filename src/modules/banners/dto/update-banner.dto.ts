import { PartialType } from '@nestjs/mapped-types';
import { CreateBannerDto } from './create-banner.dto';

/**
 * DTO para actualizar metadatos de un banner (NO la imagen).
 * Para reemplazar la imagen, usar el endpoint PATCH /banners/:id/image.
 */
export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
