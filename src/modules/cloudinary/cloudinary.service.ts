import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { UploadApiOptions, UploadApiResponse, v2 } from 'cloudinary';
import * as streamifier from 'streamifier';
import { CLOUDINARY } from './cloudinary.constants';

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof v2,
  ) {}

  /**
   * Sube un buffer de imagen a Cloudinary usando upload_stream.
   * @param buffer Buffer del archivo (ej. file.buffer de multer)
   * @param folder Carpeta destino en Cloudinary (ej. 'betgo/banners')
   */
  async uploadImage(
    buffer: Buffer,
    folder: string,
    options: Partial<UploadApiOptions> = {},
  ): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          ...options,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(
              `Error subiendo imagen a Cloudinary: ${error?.message}`,
            );
            return reject(
              new InternalServerErrorException(
                'No se pudo subir la imagen a Cloudinary',
              ),
            );
          }
          resolve(this.toUploadedImage(result));
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  /**
   * Elimina una imagen de Cloudinary por su public_id.
   * No lanza error si no existe (idempotente).
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      const result = await this.cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
      this.logger.log(
        `Imagen eliminada de Cloudinary (publicId: ${publicId}, result: ${result.result})`,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar la imagen ${publicId} de Cloudinary: ${(error as Error).message}`,
      );
    }
  }

  private toUploadedImage(result: UploadApiResponse): UploadedImage {
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }
}
