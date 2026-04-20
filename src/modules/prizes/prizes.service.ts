import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Prize, PrizeType } from './entities/prize.entity';
import { Bar } from '../bars/entities/bar.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreatePrizeDto, UpdatePrizeDto, PrizeQueryDto } from './dto';

const PRIZES_FOLDER_DEFAULT = 'betgo/prizes';

@Injectable()
export class PrizesService {
  private readonly logger = new Logger(PrizesService.name);
  private readonly folder =
    process.env.CLOUDINARY_PRIZES_FOLDER || PRIZES_FOLDER_DEFAULT;

  constructor(
    @InjectModel(Prize)
    private readonly prizeModel: typeof Prize,
    @InjectModel(Bar)
    private readonly barModel: typeof Bar,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crear premio.
   *
   * REGLA DE NEGOCIO:
   *  - barId = null → premio GLOBAL → type = JACKPOT (automático)
   *  - barId = uuid → premio LOCAL del bar → type = LOCAL (automático)
   *
   * La imagen es opcional. Si se provee se sube a Cloudinary.
   */
  async create(
    dto: CreatePrizeDto,
    file?: Express.Multer.File,
  ): Promise<Prize> {
    if (dto.barId) {
      const bar = await this.barModel.findByPk(dto.barId);
      if (!bar) {
        throw new BadRequestException(
          `Bar con ID "${dto.barId}" no encontrado.`,
        );
      }
    }

    let imageUrl: string | null = null;
    let publicId: string | null = null;

    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(
        file.buffer,
        this.folder,
      );
      imageUrl = uploaded.url;
      publicId = uploaded.publicId;
    }

    const isGlobal = !dto.barId;

    try {
      const prize = await this.prizeModel.create({
        name: dto.name,
        description: dto.description ?? null,
        type: isGlobal ? PrizeType.JACKPOT : PrizeType.LOCAL,
        barId: dto.barId ?? null,
        value: dto.value ?? null,
        stock: dto.stock ?? null,
        imageUrl,
        publicId,
        isActive: dto.isActive ?? true,
      });

      this.logger.log(
        `Premio creado: "${prize.name}" (${isGlobal ? 'GLOBAL/JACKPOT' : `Bar: ${dto.barId}`})`,
      );

      return prize;
    } catch (error) {
      if (publicId) await this.cloudinaryService.deleteImage(publicId);
      throw error;
    }
  }

  /**
   * Listar premios con filtros (panel admin).
   */
  async findAll(query: PrizeQueryDto): Promise<Prize[]> {
    const where: any = {};

    if (query.isGlobal === true) {
      where.barId = null;
    } else if (query.barId !== undefined) {
      where.barId = query.barId;
    }

    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.type !== undefined) where.type = query.type;

    return this.prizeModel.findAll({
      where,
      order: [
        ['barId', 'ASC NULLS FIRST'],
        ['name', 'ASC'],
      ],
      include: [{ model: Bar, attributes: ['id', 'name', 'slug'] }],
    });
  }

  /**
   * Premios globales (jackpot) — visibles para todos.
   */
  async findGlobal(): Promise<Prize[]> {
    return this.prizeModel.findAll({
      where: { barId: null, isActive: true },
      order: [['name', 'ASC']],
    });
  }

  /**
   * Premios locales de un bar específico.
   */
  async findByBar(barId: string): Promise<Prize[]> {
    await this.requireBar(barId);

    return this.prizeModel.findAll({
      where: { barId, isActive: true },
      order: [['name', 'ASC']],
    });
  }

  /**
   * Premios globales + locales del bar (lo que ve un jugador en ese bar).
   */
  async findByBarAndGlobal(barId: string): Promise<Prize[]> {
    await this.requireBar(barId);

    return this.prizeModel.findAll({
      where: {
        isActive: true,
        [Op.or]: [{ barId: null }, { barId }],
      },
      order: [
        ['barId', 'ASC NULLS FIRST'],
        ['name', 'ASC'],
      ],
    });
  }

  async findOne(id: string): Promise<Prize> {
    const prize = await this.prizeModel.findByPk(id, {
      include: [{ model: Bar, attributes: ['id', 'name', 'slug'] }],
    });

    if (!prize) {
      throw new NotFoundException(`Premio con ID "${id}" no encontrado.`);
    }

    return prize;
  }

  /**
   * Actualizar metadatos del premio (sin cambiar imagen).
   */
  async update(id: string, dto: UpdatePrizeDto): Promise<Prize> {
    const prize = await this.findOne(id);

    if (dto.barId !== undefined && dto.barId !== null) {
      await this.requireBar(dto.barId);
    }

    const barId =
      dto.barId === undefined ? prize.barId : (dto.barId ?? null);
    const type = barId === null ? PrizeType.JACKPOT : PrizeType.LOCAL;

    await prize.update({ ...dto, barId, type });

    this.logger.log(`Premio actualizado: "${prize.name}" (ID: ${id})`);
    return prize;
  }

  /**
   * Reemplazar la imagen del premio.
   */
  async replaceImage(id: string, file: Express.Multer.File): Promise<Prize> {
    const prize = await this.findOne(id);
    const oldPublicId = prize.publicId;

    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      this.folder,
    );

    try {
      await prize.update({
        imageUrl: uploaded.url,
        publicId: uploaded.publicId,
      });
    } catch (error) {
      await this.cloudinaryService.deleteImage(uploaded.publicId);
      throw error;
    }

    if (oldPublicId) await this.cloudinaryService.deleteImage(oldPublicId);
    this.logger.log(`Imagen de premio reemplazada (ID: ${id})`);

    return prize;
  }

  /**
   * Eliminar imagen del premio (sin borrar el registro).
   */
  async removeImage(id: string): Promise<Prize> {
    const prize = await this.findOne(id);

    if (prize.publicId) {
      await this.cloudinaryService.deleteImage(prize.publicId);
    }

    await prize.update({ imageUrl: null, publicId: null });
    this.logger.log(`Imagen eliminada del premio (ID: ${id})`);

    return prize;
  }

  async toggleActive(id: string): Promise<Prize> {
    const prize = await this.findOne(id);
    await prize.update({ isActive: !prize.isActive });
    this.logger.log(
      `Premio "${prize.name}" ${prize.isActive ? 'activado' : 'desactivado'}`,
    );
    return prize;
  }

  async remove(id: string): Promise<void> {
    const prize = await this.findOne(id);
    const publicId = prize.publicId;

    await prize.destroy();
    if (publicId) await this.cloudinaryService.deleteImage(publicId);

    this.logger.log(`Premio "${prize.name}" eliminado (ID: ${id})`);
  }

  // ==================== HELPERS ====================

  private async requireBar(barId: string): Promise<void> {
    const bar = await this.barModel.findByPk(barId);
    if (!bar) {
      throw new BadRequestException(
        `Bar con ID "${barId}" no encontrado.`,
      );
    }
  }
}
