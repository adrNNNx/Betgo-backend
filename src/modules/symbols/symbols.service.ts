// src/modules/symbols/symbols.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Symbol } from './entities/symbol.entity';
import { Bar } from '../bars/entities/bar.entity';
import { Prize } from '../prizes/entities/prize.entity';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const SYMBOLS_FOLDER_DEFAULT = 'betgo/symbols';

@Injectable()
export class SymbolsService {
  private readonly logger = new Logger(SymbolsService.name);
  private readonly folder =
    process.env.CLOUDINARY_SYMBOLS_FOLDER || SYMBOLS_FOLDER_DEFAULT;

  constructor(
    @InjectModel(Symbol)
    private readonly symbolModel: typeof Symbol,
    @InjectModel(Bar)
    private readonly barModel: typeof Bar,
    @InjectModel(Prize)
    private readonly prizeModel: typeof Prize,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crear un símbolo.
   *
   * REGLA DE NEGOCIO:
   *  - barId = null → símbolo GLOBAL → isJackpot = true (automático)
   *  - barId = uuid → símbolo LOCAL del bar → isJackpot = false (automático)
   *
   * El usuario NO controla isJackpot; se deriva del barId.
   */
  async create(dto: CreateSymbolDto): Promise<Symbol> {
    // Validar que el bar existe si se proporcionó
    if (dto.barId) {
      const bar = await this.barModel.findByPk(dto.barId);
      if (!bar) {
        throw new BadRequestException(
          `Bar con ID "${dto.barId}" no encontrado.`,
        );
      }
    }

    // Validar que el premio existe si se proporcionó
    if (dto.prizeId) {
      const prize = await this.prizeModel.findByPk(dto.prizeId);
      if (!prize) {
        throw new BadRequestException(
          `Premio con ID "${dto.prizeId}" no encontrado.`,
        );
      }
    }

    const isGlobal = !dto.barId;

    const symbol = await this.symbolModel.create({
      name: dto.name,
      imageUrl: dto.imageUrl,
      barId: dto.barId ?? null,
      prizeId: dto.prizeId ?? null,
      weight: dto.weight ?? 100,
      isJackpot: isGlobal,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    this.logger.log(
      `Símbolo creado: "${symbol.name}" (${isGlobal ? 'GLOBAL/Jackpot' : `Bar: ${dto.barId}`}), peso: ${symbol.weight}`,
    );

    return symbol;
  }

  /**
   * Actualizar un símbolo.
   * Si barId cambia, isJackpot se recalcula automáticamente.
   */
  async update(id: string, dto: UpdateSymbolDto): Promise<Symbol> {
    const symbol = await this.findOne(id);

    if (dto.barId !== undefined && dto.barId !== null) {
      const bar = await this.barModel.findByPk(dto.barId);
      if (!bar) {
        throw new BadRequestException(
          `Bar con ID "${dto.barId}" no encontrado.`,
        );
      }
    }

    if (dto.prizeId !== undefined && dto.prizeId !== null) {
      const prize = await this.prizeModel.findByPk(dto.prizeId);
      if (!prize) {
        throw new BadRequestException(
          `Premio con ID "${dto.prizeId}" no encontrado.`,
        );
      }
    }

    // Si barId se modifica, recalcular isJackpot
    const updateData: any = { ...dto };
    if ('barId' in dto) {
      const willBeGlobal = !dto.barId;
      updateData.isJackpot = willBeGlobal;
    }

    await symbol.update(updateData);

    this.logger.log(
      `Símbolo actualizado: "${symbol.name}" (ID: ${symbol.id})`,
    );

    return symbol;
  }

  /**
   * Listar símbolos con filtros opcionales.
   */
  async findAll(filters?: {
    barId?: string | null;
    isActive?: boolean;
    isGlobal?: boolean;
  }): Promise<Symbol[]> {
    const where: any = {};

    if (filters?.barId !== undefined) {
      where.barId = filters.barId;
    }

    if (filters?.isGlobal === true) {
      where.barId = null;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.symbolModel.findAll({
      where,
      order: [
        ['barId', 'ASC NULLS FIRST'],
        ['displayOrder', 'ASC'],
        ['weight', 'DESC'],
      ],
      include: [
        { model: Bar, attributes: ['id', 'name', 'slug'] },
        { model: Prize, attributes: ['id', 'name', 'type'] },
      ],
    });
  }

  /**
   * Obtener un símbolo por ID.
   */
  async findOne(id: string): Promise<Symbol> {
    const symbol = await this.symbolModel.findByPk(id, {
      include: [
        { model: Bar, attributes: ['id', 'name', 'slug'] },
        { model: Prize, attributes: ['id', 'name', 'type', 'value'] },
      ],
    });

    if (!symbol) {
      throw new NotFoundException(`Símbolo con ID "${id}" no encontrado.`);
    }

    return symbol;
  }

  /**
   * Obtener símbolos de un bar (globales + locales, solo activos).
   */
  async findByBar(barId: string): Promise<Symbol[]> {
    return this.symbolModel.findAll({
      where: {
        [Op.or]: [{ barId: null }, { barId }],
        isActive: true,
      },
      order: [['weight', 'DESC']],
      include: [{ model: Prize, required: false }],
    });
  }

  /**
   * Obtener solo símbolos globales (pozo).
   */
  async findGlobal(): Promise<Symbol[]> {
    return this.symbolModel.findAll({
      where: { barId: null, isActive: true },
      order: [['weight', 'DESC']],
      include: [{ model: Prize, required: false }],
    });
  }

  /**
   * Subir/reemplazar la imagen del símbolo: sube la nueva a Cloudinary,
   * actualiza el registro y elimina la anterior (si era una imagen subida).
   */
  async replaceImage(id: string, file: Express.Multer.File): Promise<Symbol> {
    const symbol = await this.findOne(id);
    const oldPublicId = symbol.publicId;

    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      this.folder,
    );

    try {
      await symbol.update({
        imageUrl: uploaded.url,
        publicId: uploaded.publicId,
      });
    } catch (error) {
      await this.cloudinaryService.deleteImage(uploaded.publicId);
      throw error;
    }

    if (oldPublicId) await this.cloudinaryService.deleteImage(oldPublicId);
    this.logger.log(`Imagen de símbolo reemplazada (ID: ${id})`);

    return symbol;
  }

  /**
   * Activar/desactivar un símbolo.
   */
  async toggleActive(id: string): Promise<Symbol> {
    const symbol = await this.findOne(id);
    await symbol.update({ isActive: !symbol.isActive });

    this.logger.log(
      `Símbolo "${symbol.name}" ${symbol.isActive ? 'activado' : 'desactivado'}`,
    );

    return symbol;
  }

  /**
   * Eliminar un símbolo.
   */
  async remove(id: string): Promise<void> {
    const symbol = await this.findOne(id);
    const publicId = symbol.publicId;

    await symbol.destroy();
    if (publicId) await this.cloudinaryService.deleteImage(publicId);

    this.logger.log(`Símbolo "${symbol.name}" eliminado (ID: ${id})`);
  }
}
