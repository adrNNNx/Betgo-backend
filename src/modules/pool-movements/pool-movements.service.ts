import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  PoolMovement,
  PoolMovementType,
} from './entities/pool-movement.entity';
import { User } from '../users/entities/user.entity';
import { Bar } from '../bars/entities/bar.entity';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Categorías del panel. Un `contribution` es jugada (con playId) o recarga. */
export type MovementCategory =
  | 'all'
  | 'game_spin'
  | 'topup'
  | 'payout'
  | 'adjust';

@Injectable()
export class PoolMovementsService {
  constructor(
    @InjectModel(PoolMovement)
    private readonly movementModel: typeof PoolMovement,
  ) {}

  /**
   * Historial paginado del pozo, más recientes primero.
   * GET /pool-movements?limit=&offset=&category=&search=
   * Devuelve { data, total } para que el panel arme la paginación.
   */
  async findAll(query: {
    limit?: number;
    offset?: number;
    category?: MovementCategory;
    search?: string;
  }): Promise<{ data: PoolMovement[]; total: number }> {
    const where = this.buildWhere(query.category, query.search);

    const limit =
      query.limit && query.limit > 0
        ? Math.min(query.limit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset = query.offset && query.offset > 0 ? query.offset : 0;

    const { rows, count } = await this.movementModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
        { model: Bar, attributes: ['id', 'name'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] },
      ],
    });

    return { data: rows, total: count };
  }

  private buildWhere(category?: MovementCategory, search?: string) {
    const where: Record<string, unknown> = {};

    switch (category) {
      case 'game_spin': // jugada: contribución con jugada asociada
        where.type = PoolMovementType.CONTRIBUTION;
        where.playId = { [Op.ne]: null };
        break;
      case 'topup': // recarga: contribución sin jugada (parte de la recarga)
        where.type = PoolMovementType.CONTRIBUTION;
        where.playId = { [Op.is]: null };
        break;
      case 'payout':
        where.type = PoolMovementType.JACKPOT_WIN;
        break;
      case 'adjust':
        where.type = PoolMovementType.ADJUSTMENT;
        break;
      // 'all' / undefined → sin filtro de tipo
    }

    if (search) {
      where.notes = { [Op.iLike]: `%${search}%` };
    }

    return where;
  }
}
