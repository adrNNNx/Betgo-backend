import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  PoolMovement,
  PoolMovementType,
} from './entities/pool-movement.entity';
import { User } from '../users/entities/user.entity';
import { Bar } from '../bars/entities/bar.entity';
import {
  JackpotClaim,
  JackpotClaimStatus,
} from '../jackpot-claims/entities/jackpot-claim.entity';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Categorías del panel. Un `contribution` es jugada (con playId) o recarga. */
export type MovementCategory =
  | 'all'
  | 'game_spin'
  | 'topup'
  | 'payout'
  | 'adjust';

/**
 * Estado del pago al ganador, adjunto a los movimientos `jackpot_win`.
 * El pozo se vacía al ganarse, pero el dinero se entrega después: sin esto el
 * historial no distingue un pozo ya pagado de uno que todavía se adeuda.
 */
export interface MovementJackpotInfo {
  folio: string;
  status: JackpotClaimStatus;
  paidAt: Date | null;
  contactedAt: Date | null;
}

@Injectable()
export class PoolMovementsService {
  constructor(
    @InjectModel(PoolMovement)
    private readonly movementModel: typeof PoolMovement,
    @InjectModel(JackpotClaim)
    private readonly jackpotClaimModel: typeof JackpotClaim,
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
  }): Promise<{ data: Array<Record<string, unknown>>; total: number }> {
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

    const jackpotByPlay = await this.loadJackpotInfo(rows);

    return {
      data: rows.map((m) => ({
        ...m.toJSON(),
        // Solo en los egresos por pozo ganado; null en el resto.
        jackpot: m.playId ? (jackpotByPlay.get(m.playId) ?? null) : null,
      })),
      total: count,
    };
  }

  /**
   * Comprobantes de los pozos que aparecen en esta página, indexados por playId.
   * Una query extra sobre los ids ya cargados, no un N+1.
   */
  private async loadJackpotInfo(
    rows: PoolMovement[],
  ): Promise<Map<string, MovementJackpotInfo>> {
    const playIds = rows
      .filter((m) => m.type === PoolMovementType.JACKPOT_WIN && m.playId)
      .map((m) => m.playId as string);

    if (playIds.length === 0) return new Map();

    const claims = await this.jackpotClaimModel.findAll({
      where: { playId: { [Op.in]: playIds } },
      attributes: ['playId', 'folio', 'status', 'paidAt', 'contactedAt'],
    });

    return new Map(
      claims.map((c) => [
        c.playId,
        {
          folio: c.folio,
          status: c.status,
          paidAt: c.paidAt,
          contactedAt: c.contactedAt,
        },
      ]),
    );
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
