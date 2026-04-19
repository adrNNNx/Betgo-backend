import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * Valida el archivo recibido por Multer:
 *  - Debe existir
 *  - MIME type permitido (jpg, png, webp, gif)
 *  - Tamaño <= 3MB
 */
@Injectable()
export class ImageFilePipe
  implements PipeTransform<Express.Multer.File, Express.Multer.File>
{
  transform(
    file: Express.Multer.File,
    _metadata: ArgumentMetadata,
  ): Express.Multer.File {
    if (!file) {
      throw new BadRequestException(
        'Debes adjuntar un archivo de imagen en el campo "file".',
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Formato no permitido. Formatos válidos: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `La imagen supera el tamaño máximo permitido (${MAX_SIZE_BYTES / (1024 * 1024)}MB).`,
      );
    }

    return file;
  }
}
