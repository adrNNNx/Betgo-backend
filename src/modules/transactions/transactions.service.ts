import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col } from 'sequelize';
import Decimal from 'decimal.js';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { Bar } from '../bars/entities/bar.entity';
import { Staff } from '../staff/entities/staff.entity';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Categorías del panel → tipos crudos. 'all'/undefined = sin filtro de tipo.
export type TransactionCategory =
  | 'all'
  | 'play'
  | 'recharge'
  | 'prize'
  | 'platform'
  | 'adjustment';

const CATEGORY_TYPES: Record<string, TransactionType[]> = {
  play: [
    TransactionType.PLAY_FREE,
    TransactionType.PLAY_PAID,
    TransactionType.PLAY_POOL,
  ],
  recharge: [TransactionType.RECHARGE, TransactionType.BAR_RECHARGE],
  prize: [TransactionType.PRIZE_LOCAL, TransactionType.PRIZE_JACKPOT],
  platform: [TransactionType.PLATFORM_REVENUE],
  adjustment: [TransactionType.ADJUSTMENT],
};

export interface TransactionFilters {
  category?: TransactionCategory;
  barId?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  search?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction)
    private readonly txModel: typeof Transaction,
  ) {}

  /**
   * Listado paginado con filtros. Devuelve { data, total }.
   * Incluye bar, jugador (user) y mozo (staff → user).
   * GET /transactions?category=&barId=&userId=&from=&to=&search=&limit=&offset=
   */
  async findAll(
    filters: TransactionFilters & { limit?: number; offset?: number },
  ): Promise<{ data: Transaction[]; total: number }> {
    const where = this.buildWhere(filters);

    const limit =
      filters.limit && filters.limit > 0
        ? Math.min(filters.limit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset = filters.offset && filters.offset > 0 ? filters.offset : 0;

    const { rows, count } = await this.txModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: Bar, attributes: ['id', 'name'] },
        { model: User, attributes: ['id', 'name'] }, // jugador
        {
          model: Staff,
          attributes: ['id', 'role'],
          include: [{ model: User, attributes: ['id', 'name'] }], // mozo
        },
      ],
    });

    return { data: rows, total: count };
  }

  /**
   * Resumen agregado con los mismos filtros (sin paginar).
   * GET /transactions/summary → { count, total, byType: { <type>: { count, total } } }
   */
  async summary(filters: TransactionFilters): Promise<{
    count: number;
    total: number;
    byType: Record<string, { count: number; total: number }>;
  }> {
    const where = this.buildWhere(filters);

    const rows = (await this.txModel.findAll({
      attributes: [
        'type',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('amount')), 'total'],
      ],
      where,
      group: ['type'],
      raw: true,
    })) as unknown as Array<{ type: string; count: string; total: string }>;

    const byType: Record<string, { count: number; total: number }> = {};
    let totalCount = 0;
    let totalAmount = new Decimal(0);

    for (const r of rows) {
      const count = Number(r.count) || 0;
      const total = new Decimal(r.total || 0);
      byType[r.type] = { count, total: total.toNumber() };
      totalCount += count;
      totalAmount = totalAmount.plus(total);
    }

    return { count: totalCount, total: totalAmount.toNumber(), byType };
  }

  private buildWhere(filters: TransactionFilters) {
    const where: Record<string, unknown> = {};

    const types =
      filters.category && CATEGORY_TYPES[filters.category]
        ? CATEGORY_TYPES[filters.category]
        : undefined;
    if (types) where.type = { [Op.in]: types };

    if (filters.barId) where.barId = filters.barId;
    if (filters.userId) where.userId = filters.userId;

    if (filters.from || filters.to) {
      const range: Record<symbol, Date> = {};
      if (filters.from) range[Op.gte] = filters.from;
      if (filters.to) range[Op.lte] = filters.to;
      where.createdAt = range;
    }

    if (filters.search) {
      const like = { [Op.iLike]: `%${filters.search}%` };
      where[Op.or as unknown as string] = [{ notes: like }, { reference: like }];
    }

    return where;
  }
}
