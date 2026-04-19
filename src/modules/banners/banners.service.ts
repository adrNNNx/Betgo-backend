import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Banner } from './entities/banner.entity';
import { Bar } from '../bars/entities/bar.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateBannerDto, UpdateBannerDto } from './dto';

const BANNERS_FOLDER_DEFAULT = 'betgo/banners';

@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);
  private readonly folder =
    process.env.CLOUDINARY_BANNERS_FOLDER || BANNERS_FOLDER_DEFAULT;

  constructor(
    @InjectModel(Banner)
    private readonly bannerModel: typeof Banner,
    @InjectModel(Bar)
    private readonly barModel: typeof Bar,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crear banner: sube la imagen a Cloudinary y guarda el registro.
   *
   * REGLA DE NEGOCIO:
   *  - barId = null → banner GLOBAL (visible para todos los bares)
   *  - barId = uuid → banner LOCAL del bar
   */
  async create(
    dto: CreateBannerDto,
    file: Express.Multer.File,
  ): Promise<Banner> {
    this.validateSchedule(dto.startsAt, dto.endsAt);

    if (dto.barId) {
      const bar = await this.barModel.findByPk(dto.barId);
      if (!bar) {
        throw new BadRequestException(
          `Bar con ID "${dto.barId}" no encontrado.`,
        );
      }
    }

    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      this.folder,
    );

    try {
      const banner = await this.bannerModel.create({
        title: dto.title,
        description: dto.description ?? null,
        imageUrl: uploaded.url,
        publicId: uploaded.publicId,
        linkUrl: dto.linkUrl ?? null,
        barId: dto.barId ?? null,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ?? null,
        endsAt: dto.endsAt ?? null,
      });

      this.logger.log(
        `Banner creado: "${banner.title}" (${banner.isGlobal() ? 'GLOBAL' : `Bar: ${banner.barId}`})`,
      );

      return banner;
    } catch (error) {
      // Rollback: si falla el insert, limpiar la imagen para no dejar huérfanos.
      await this.cloudinaryService.deleteImage(uploaded.publicId);
      throw error;
    }
  }

  /**
   * Listar banners (admin) con filtros opcionales.
   */
  async findAll(filters?: {
    barId?: string;
    isActive?: boolean;
    isGlobal?: boolean;
  }): Promise<Banner[]> {
    const where: any = {};

    if (filters?.isGlobal === true) {
      where.barId = null;
    } else if (filters?.barId !== undefined) {
      where.barId = filters.barId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.bannerModel.findAll({
      where,
      order: [
        ['barId', 'ASC NULLS FIRST'],
        ['displayOrder', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      include: [{ model: Bar, attributes: ['id', 'name', 'slug'] }],
    });
  }

  /**
   * Feed público: banners visibles ahora, ordenados para el carrusel.
   * - Si `barId` se pasa: globales + del bar.
   * - Si no: solo globales.
   */
  async findActive(barId?: string): Promise<Banner[]> {
    const now = new Date();

    const barCondition = barId ? [{ barId: null }, { barId }] : [{ barId: null }];

    return this.bannerModel.findAll({
      where: {
        isActive: true,
        [Op.or]: barCondition,
        [Op.and]: [
          {
            [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }],
          },
          {
            [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }],
          },
        ],
      },
      order: [
        ['displayOrder', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    });
  }

  async findOne(id: string): Promise<Banner> {
    const banner = await this.bannerModel.findByPk(id, {
      include: [{ model: Bar, attributes: ['id', 'name', 'slug'] }],
    });

    if (!banner) {
      throw new NotFoundException(`Banner con ID "${id}" no encontrado.`);
    }

    return banner;
  }

  /**
   * Actualizar metadatos del banner (no la imagen).
   */
  async update(id: string, dto: UpdateBannerDto): Promise<Banner> {
    const banner = await this.findOne(id);

    const nextStartsAt =
      dto.startsAt !== undefined ? dto.startsAt : banner.startsAt;
    const nextEndsAt = dto.endsAt !== undefined ? dto.endsAt : banner.endsAt;
    this.validateSchedule(nextStartsAt, nextEndsAt);

    if (dto.barId !== undefined && dto.barId !== null) {
      const bar = await this.barModel.findByPk(dto.barId);
      if (!bar) {
        throw new BadRequestException(
          `Bar con ID "${dto.barId}" no encontrado.`,
        );
      }
    }

    await banner.update({
      ...dto,
      barId: dto.barId === undefined ? banner.barId : (dto.barId ?? null),
    });

    this.logger.log(`Banner actualizado: "${banner.title}" (ID: ${id})`);
    return banner;
  }

  /**
   * Reemplazar la imagen del banner: sube la nueva y elimina la anterior.
   */
  async replaceImage(id: string, file: Express.Multer.File): Promise<Banner> {
    const banner = await this.findOne(id);
    const oldPublicId = banner.publicId;

    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      this.folder,
    );

    try {
      await banner.update({
        imageUrl: uploaded.url,
        publicId: uploaded.publicId,
      });
    } catch (error) {
      await this.cloudinaryService.deleteImage(uploaded.publicId);
      throw error;
    }

    await this.cloudinaryService.deleteImage(oldPublicId);
    this.logger.log(`Imagen de banner reemplazada (ID: ${id})`);

    return banner;
  }

  async toggleActive(id: string): Promise<Banner> {
    const banner = await this.findOne(id);
    await banner.update({ isActive: !banner.isActive });
    this.logger.log(
      `Banner "${banner.title}" ${banner.isActive ? 'activado' : 'desactivado'}`,
    );
    return banner;
  }

  async remove(id: string): Promise<void> {
    const banner = await this.findOne(id);
    const publicId = banner.publicId;

    await banner.destroy();
    await this.cloudinaryService.deleteImage(publicId);

    this.logger.log(`Banner "${banner.title}" eliminado (ID: ${id})`);
  }

  // ==================== HELPERS ====================

  private validateSchedule(
    startsAt?: Date | null,
    endsAt?: Date | null,
  ): void {
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestException(
        'startsAt debe ser anterior a endsAt.',
      );
    }
  }
}
