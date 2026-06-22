// src/modules/bars/bars.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Bar } from './entities/bar.entity';
import { CreateBarDto } from './dto/create-bar.dto';
import { UpdateBarDto } from './dto/update-bar.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const BARS_FOLDER_DEFAULT = 'betgo/bars';

@Injectable()
export class BarsService {
  private readonly folder =
    process.env.CLOUDINARY_BARS_FOLDER || BARS_FOLDER_DEFAULT;

  constructor(
    @InjectModel(Bar)
    private barModel: typeof Bar,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createBarDto: CreateBarDto): Promise<Bar> {
    // Validar que los porcentajes sumen 100
    const totalPercentage =
      (createBarDto.barPercentage || 50) +
      (createBarDto.poolPercentage || 30) +
      (createBarDto.platformPercentage || 20);

    if (totalPercentage !== 100) {
      throw new BadRequestException(
        `Los porcentajes deben sumar 100%. Actual: ${totalPercentage}%`,
      );
    }

    try {
      const bar = await this.barModel.create(createBarDto);
      return bar;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new ConflictException('Ya existe un bar con ese nombre');
      }
      throw error;
    }
  }

  async findAll(includeInactive = false): Promise<Bar[]> {
    const where = includeInactive ? {} : { isActive: true };
    return this.barModel.findAll({
      where,
      order: [['name', 'ASC']],
    });
  }

  async findOne(id: string): Promise<Bar> {
    const bar = await this.barModel.findByPk(id);
    if (!bar) {
      throw new NotFoundException('Bar no encontrado');
    }
    return bar;
  }

  async findBySlug(slug: string): Promise<Bar> {
    const bar = await this.barModel.findOne({
      where: { slug, isActive: true },
    });
    if (!bar) {
      throw new NotFoundException('Bar no encontrado');
    }
    return bar;
  }

  async findByAccessCode(accessCode: string): Promise<Bar> {
    const bar = await this.barModel.findOne({
      where: { accessCode, isActive: true },
    });
    if (!bar) {
      throw new NotFoundException('Bar no encontrado');
    }
    return bar;
  }

  async findBySlugOrCode(slugOrCode: string): Promise<Bar> {
    const bar = await this.barModel.findOne({
      where: {
        [Op.or]: [{ slug: slugOrCode }, { accessCode: slugOrCode }],
        isActive: true,
      },
    });
    if (!bar) {
      throw new NotFoundException('Bar no encontrado');
    }
    return bar;
  }

  async update(id: string, updateBarDto: UpdateBarDto): Promise<Bar> {
    const bar = await this.findOne(id);

    // Si se actualizan porcentajes, validar que sumen 100
    const barPercentage = updateBarDto.barPercentage ?? bar.barPercentage;
    const poolPercentage = updateBarDto.poolPercentage ?? bar.poolPercentage;
    const platformPercentage =
      updateBarDto.platformPercentage ?? bar.platformPercentage;

    const totalPercentage = barPercentage + poolPercentage + platformPercentage;

    if (totalPercentage !== 100) {
      throw new BadRequestException(
        `Los porcentajes deben sumar 100%. Actual: ${totalPercentage}%`,
      );
    }

    await bar.update(updateBarDto);
    return bar;
  }

  async remove(id: string): Promise<void> {
    const bar = await this.findOne(id);
    // Soft delete - marcar como inactivo
    await bar.update({ isActive: false });
  }

  async rechargeBalance(
    id: string,
    amount: number,
    notes?: string,
  ): Promise<Bar> {
    const bar = await this.findOne(id);

    if (amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    await bar.increment('balance', { by: amount });
    await bar.reload();

    return bar;
  }

  async updateFreePlays(id: string, freePlaysPerDay: number): Promise<Bar> {
    const bar = await this.findOne(id);

    if (freePlaysPerDay < 0 || freePlaysPerDay > 10) {
      throw new BadRequestException(
        'Las jugadas gratis deben estar entre 0 y 10',
      );
    }

    await bar.update({ freePlaysPerDay });
    return bar;
  }

  /**
   * Sube/reemplaza el logo del bar: sube la nueva imagen a Cloudinary,
   * actualiza el registro y elimina la anterior (si existía).
   */
  async updateLogo(id: string, file: Express.Multer.File): Promise<Bar> {
    const bar = await this.findOne(id);
    const oldPublicId = bar.logoPublicId;

    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      this.folder,
    );

    try {
      await bar.update({
        logoUrl: uploaded.url,
        logoPublicId: uploaded.publicId,
      });
    } catch (error) {
      await this.cloudinaryService.deleteImage(uploaded.publicId);
      throw error;
    }

    if (oldPublicId) await this.cloudinaryService.deleteImage(oldPublicId);
    return bar;
  }

  async getStats(id: string): Promise<any> {
    const bar = await this.findOne(id);

    // TODO: Agregar estadísticas reales
    return {
      bar: {
        id: bar.id,
        name: bar.name,
        balance: bar.balance,
      },
      stats: {
        totalPlays: 0,
        totalRecharges: 0,
        prizesDelivered: 0,
      },
    };
  }
}
