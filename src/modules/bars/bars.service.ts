// src/modules/bars/bars.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Bar } from './entities/bar.entity';
import { CreateBarDto } from './dto/create-bar.dto';
import { UpdateBarDto } from './dto/update-bar.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { splitRecharge } from './recharge-split';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import {
  PoolMovement,
  PoolMovementType,
} from '../pool-movements/entities/pool-movement.entity';
import {
  Transaction,
  TransactionType,
  Currency,
} from '../transactions/entities/transaction.entity';
import { UserDailyPlaysService } from '../user-daily-plays/user-daily-plays.service';
import Decimal from 'decimal.js';

const BARS_FOLDER_DEFAULT = 'betgo/bars';

@Injectable()
export class BarsService {
  private readonly folder =
    process.env.CLOUDINARY_BARS_FOLDER || BARS_FOLDER_DEFAULT;

  constructor(
    @InjectModel(Bar)
    private barModel: typeof Bar,
    @InjectModel(GlobalPool)
    private readonly globalPoolModel: typeof GlobalPool,
    @InjectModel(PoolMovement)
    private readonly poolMovementModel: typeof PoolMovement,
    @InjectModel(Transaction)
    private readonly transactionModel: typeof Transaction,
    private readonly sequelize: Sequelize,
    private readonly cloudinaryService: CloudinaryService,
    private readonly userDailyPlaysService: UserDailyPlaysService,
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

  /**
   * Recargar un bar distribuyendo el monto según sus porcentajes:
   *  - barPercentage%      → balance del bar (crédito para pagar jugadas)
   *  - poolPercentage%     → pozo global (global_pool + pool_movement)
   *  - platformPercentage% → ganancia de la empresa (acumulador platform_earnings)
   *
   * Todo en una transacción atómica con locks (mismo patrón que las jugadas).
   * La porción de empresa se calcula como remanente para que las 3 partes
   * sumen exactamente `amount` (sin drift de centavos).
   */
  async rechargeBalance(
    id: string,
    amount: number,
    notes?: string,
    currency: Currency = Currency.PYG,
  ): Promise<{
    bar: Bar;
    breakdown: {
      amount: number;
      barShare: number;
      poolShare: number;
      platformShare: number;
      currency: Currency;
    };
    poolAmount: number;
  }> {
    if (amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    const bar = await this.findOne(id);

    const result = await this.sequelize.transaction(async (t) => {
      await bar.reload({ transaction: t, lock: true });
      const pool = await this.globalPoolModel.findByPk(1, {
        transaction: t,
        lock: true,
      });
      if (!pool) {
        throw new BadRequestException('Pozo global no configurado');
      }

      const { barShare, poolShare, platformShare } = splitRecharge(
        amount,
        bar.barPercentage,
        bar.poolPercentage,
      );

      const barBalanceBefore = bar.balance;
      const poolBefore = Number(pool.currentAmount);

      // 1) Crédito al bar + acumulador de empresa (caché del ledger).
      await bar.increment(
        { balance: barShare, platformEarnings: platformShare },
        { transaction: t },
      );
      await bar.reload({ transaction: t });

      // Ledger: crédito acreditado al bar (BAR_RECHARGE)
      await this.transactionModel.create(
        {
          barId: bar.id,
          type: TransactionType.BAR_RECHARGE,
          amount: barShare,
          balanceBefore: barBalanceBefore,
          balanceAfter: bar.balance,
          currency,
          notes:
            notes ??
            `Recarga ${amount} ${currency} → bar ${barShare}, pozo ${poolShare}, empresa ${platformShare}`,
        },
        { transaction: t },
      );

      // Ledger: ganancia de la empresa (PLATFORM_REVENUE) — fuente de verdad
      // de los KPIs con rango de fechas. No mueve balance de ninguna cuenta.
      await this.transactionModel.create(
        {
          barId: bar.id,
          type: TransactionType.PLATFORM_REVENUE,
          amount: platformShare,
          currency,
          notes: notes ?? `Ganancia empresa por recarga (${amount} ${currency})`,
        },
        { transaction: t },
      );

      // 2) Aporte al pozo global
      await pool.increment(
        { currentAmount: poolShare, totalCollected: poolShare },
        { transaction: t },
      );
      await pool.reload({ transaction: t });

      await this.poolMovementModel.create(
        {
          type: PoolMovementType.CONTRIBUTION,
          amount: poolShare,
          balanceBefore: poolBefore,
          balanceAfter: Number(pool.currentAmount),
          barId: bar.id,
          notes: notes ?? 'Aporte por recarga de bar',
        },
        { transaction: t },
      );

      return {
        barShare,
        poolShare,
        platformShare,
        poolAmount: Number(pool.currentAmount),
      };
    });

    return {
      bar,
      breakdown: {
        amount,
        barShare: result.barShare,
        poolShare: result.poolShare,
        platformShare: result.platformShare,
        currency,
      },
      poolAmount: result.poolAmount,
    };
  }

  /**
   * Previsualización del desglose sin tocar la base (para el diálogo del front).
   */
  async previewRecharge(id: string, amount: number) {
    const bar = await this.findOne(id);
    return splitRecharge(amount, bar.barPercentage, bar.poolPercentage);
  }

  async updateFreePlays(id: string, freePlaysPerDay: number): Promise<Bar> {
    const bar = await this.findOne(id);

    if (freePlaysPerDay < 0 || freePlaysPerDay > 10) {
      throw new BadRequestException(
        'Las jugadas gratis deben estar entre 0 y 10',
      );
    }

    // Atómico: cambiar el límite del bar y propagarlo a los registros de HOY,
    // así los usuarios que ya iniciaron sesión ven el nuevo límite (el snapshot
    // diario quedaría desactualizado de lo contrario).
    await this.sequelize.transaction(async (t) => {
      await bar.update({ freePlaysPerDay }, { transaction: t });
      await this.userDailyPlaysService.syncTodayLimitForBar(
        id,
        freePlaysPerDay,
        t,
      );
    });

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

    const poolContributed =
      (await this.poolMovementModel.sum('amount', {
        where: { barId: id, type: PoolMovementType.CONTRIBUTION },
      })) || 0;

    const totalRecharged =
      (await this.transactionModel.sum('amount', {
        where: { barId: id, type: TransactionType.BAR_RECHARGE },
      })) || 0;

    return {
      bar: { id: bar.id, name: bar.name, balance: bar.balance },
      stats: {
        balance: bar.balance,
        platformEarnings: bar.platformEarnings, // ganancia empresa por este bar
        poolContributed: Number(poolContributed), // aporte de este bar al pozo
        barCredited: Number(totalRecharged), // crédito acreditado al bar por recargas
      },
    };
  }

  /**
   * KPIs globales para el panel admin, derivados del ledger (transactions /
   * pool_movements) para soportar filtro por rango de fechas:
   *  - ganancia total de la empresa
   *  - total aportado al pozo
   *  - desglose por bar (ganancia empresa + aporte al pozo)
   *
   * `from`/`to` son opcionales; sin ellos devuelve el acumulado histórico.
   */
  async getPlatformKpis(from?: Date, to?: Date) {
    const dateWhere = this.buildDateWhere(from, to);

    const platformByBar = await this.transactionModel.findAll({
      attributes: [
        'barId',
        [this.sequelize.fn('SUM', this.sequelize.col('amount')), 'total'],
      ],
      where: { type: TransactionType.PLATFORM_REVENUE, ...dateWhere },
      group: ['barId'],
      raw: true,
    });
    const poolByBar = await this.poolMovementModel.findAll({
      attributes: [
        'barId',
        [this.sequelize.fn('SUM', this.sequelize.col('amount')), 'total'],
      ],
      where: {
        type: PoolMovementType.CONTRIBUTION,
        barId: { [Op.ne]: null },
        ...dateWhere,
      },
      group: ['barId'],
      raw: true,
    });

    const platformMap = new Map(
      platformByBar.map((r: any) => [r.barId, new Decimal(r.total || 0)]),
    );
    const poolMap = new Map(
      poolByBar.map((r: any) => [r.barId, new Decimal(r.total || 0)]),
    );

    const bars = await this.barModel.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    let totalPlatform = new Decimal(0);
    let totalPool = new Decimal(0);

    const perBar = bars.map((b) => {
      const platform = platformMap.get(b.id) ?? new Decimal(0);
      const pool = poolMap.get(b.id) ?? new Decimal(0);
      totalPlatform = totalPlatform.plus(platform);
      totalPool = totalPool.plus(pool);
      return {
        id: b.id,
        name: b.name,
        platformEarnings: platform.toNumber(),
        poolContributed: pool.toNumber(),
      };
    });

    return {
      range: { from: from ?? null, to: to ?? null },
      totalPlatformEarnings: totalPlatform.toNumber(),
      totalPoolCollected: totalPool.toNumber(),
      bars: perBar,
    };
  }

  private buildDateWhere(from?: Date, to?: Date) {
    if (!from && !to) return {};
    const range: any = {};
    if (from) range[Op.gte] = from;
    if (to) range[Op.lte] = to;
    return { createdAt: range };
  }
}
