import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { GlobalPool } from './entities/global-pool.entity';
import { User } from '../users/entities/user.entity';
import {
  PoolMovement,
  PoolMovementType,
} from '../pool-movements/entities/pool-movement.entity';
import { UpdateGlobalPoolDto } from './dto/update-global-pool.dto';
import { AdjustPoolDto } from './dto/adjust-pool.dto';
import { nextPoolAmount } from './pool-math';

@Injectable()
export class GlobalPoolService {
  constructor(
    @InjectModel(GlobalPool)
    private readonly poolModel: typeof GlobalPool,
    @InjectModel(PoolMovement)
    private readonly movementModel: typeof PoolMovement,
    private readonly sequelize: Sequelize,
  ) {}

  /**
   * Devuelve la instancia única del pozo (id=1) con su último ganador.
   * La crea si aún no existe. GET /global-pool
   */
  async getPool(): Promise<GlobalPool> {
    const pool = await this.poolModel.findByPk(1, {
      include: [
        // Sin phone: este endpoint es público, no exponer PII del ganador.
        { model: User, as: 'lastWinner', attributes: ['id', 'name'] },
      ],
    });
    return pool ?? this.poolModel.create({ id: 1 });
  }

  /**
   * Igual que getPool pero con el detalle completo del ganador (incluye phone).
   * Solo admin. GET /global-pool/admin
   */
  async getPoolAdmin(): Promise<GlobalPool> {
    const pool = await this.poolModel.findByPk(1, {
      include: [
        { model: User, as: 'lastWinner', attributes: ['id', 'name', 'phone'] },
      ],
    });
    return pool ?? this.poolModel.create({ id: 1 });
  }

  /**
   * Persiste la config editable (costo por tirada, mínimo). PATCH /global-pool/:id
   * El id se ignora: el pozo es singleton.
   */
  async updateConfig(dto: UpdateGlobalPoolDto): Promise<GlobalPool> {
    const pool = await this.getPool();
    const patch: Partial<GlobalPool> = {};
    if (dto.costPerPlay !== undefined) patch.costPerPlay = dto.costPerPlay;
    if (dto.minAmount !== undefined) patch.minAmount = dto.minAmount;
    if (Object.keys(patch).length > 0) await pool.update(patch);
    return pool;
  }

  /**
   * Ajuste manual del pozo: mueve currentAmount y registra un PoolMovement
   * tipo 'adjustment'. Atómico con lock. No toca totalCollected/totalPaid
   * (son flujos económicos reales, no correcciones manuales).
   * POST /global-pool/adjust
   */
  async adjust(dto: AdjustPoolDto, adminUserId: string) {
    if (dto.amount === 0) {
      throw new BadRequestException('El ajuste no puede ser 0.');
    }

    return this.sequelize.transaction(async (t) => {
      const pool = await this.poolModel.findByPk(1, {
        transaction: t,
        lock: true,
      });
      if (!pool) {
        throw new BadRequestException('Pozo global no configurado.');
      }

      const before = Number(pool.currentAmount);
      const after = nextPoolAmount(before, dto.amount);
      if (after < 0) {
        throw new BadRequestException(
          'El ajuste dejaría el pozo en negativo.',
        );
      }

      await pool.update({ currentAmount: after }, { transaction: t });

      const movement = await this.movementModel.create(
        {
          type: PoolMovementType.ADJUSTMENT,
          amount: dto.amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: dto.notes,
          createdById: adminUserId,
        },
        { transaction: t },
      );

      return { pool, movement };
    });
  }
}
