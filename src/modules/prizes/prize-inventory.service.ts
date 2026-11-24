// src/modules/prizes/prize-inventory.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { Transaction as SequelizeTransaction } from 'sequelize';
import { Prize } from './entities/prize.entity';
import {
  PrizeClaim,
  ClaimStatus,
} from '../prize-claims/entities/prize-claim.entity';

/**
 * Inventario de premios: cuántas unidades se pueden seguir otorgando.
 *
 * `prizes.stock` son las unidades FÍSICAS que tiene el bar y baja cuando el
 * mozo entrega. Pero entre que alguien gana y retira pasan hasta 7 días, y en
 * ese tiempo la unidad ya está comprometida. Lo que se puede otorgar no es
 * `stock`, es:
 *
 *   disponible = stock − comprobantes pendientes y vigentes
 *
 * Con esa cuenta no hace falta devolver stock cuando un comprobante vence
 * (deja de contar solo por `expiresAt`), `stock` conserva su significado y
 * no hay datos que migrar.
 */
@Injectable()
export class PrizeInventoryService {
  private readonly logger = new Logger(PrizeInventoryService.name);

  constructor(
    @InjectModel(Prize)
    private readonly prizeModel: typeof Prize,
    @InjectModel(PrizeClaim)
    private readonly prizeClaimModel: typeof PrizeClaim,
  ) {}

  /**
   * Bloquea la fila del premio y lo devuelve si todavía se puede otorgar.
   *
   * Tiene que correr en la MISMA transacción que crea el comprobante. El
   * `FOR UPDATE` serializa a quienes ganan el mismo premio a la vez: el segundo
   * espera, y cuando obtiene el lock su conteo ya ve el comprobante del primero
   * (en READ COMMITTED cada sentencia toma una foto nueva de lo confirmado).
   *
   * Los premios ilimitados (`stock` null) no cuentan nada.
   */
  async lockForAward(
    prizeId: string,
    transaction: SequelizeTransaction,
  ): Promise<Prize | null> {
    const prize = await this.prizeModel.findByPk(prizeId, {
      transaction,
      lock: true,
    });
    if (!prize?.isActive) return null;
    if (prize.stock === null) return prize;

    const committed = await this.countCommitted(prizeId, transaction);
    if (prize.stock - committed > 0) return prize;

    this.logger.warn(
      `Premio agotado, la jugada no paga - ${prize.name} (${prize.id}): ` +
        `stock ${prize.stock}, comprometidos ${committed}`,
    );
    return null;
  }

  /**
   * Descuenta la unidad física al entregar. Es condicional en la base: nunca
   * deja el stock negativo, aunque un admin lo haya editado a mano en el medio.
   */
  async consumeOnDelivery(
    prizeId: string,
    transaction: SequelizeTransaction,
  ): Promise<void> {
    await this.prizeModel.decrement('stock', {
      by: 1,
      where: { id: prizeId, stock: { [Op.gt]: 0 } },
      transaction,
    });
  }

  /** Comprobantes que ya reservan una unidad: pendientes y sin vencer. */
  private countCommitted(
    prizeId: string,
    transaction: SequelizeTransaction,
  ): Promise<number> {
    return this.prizeClaimModel.count({
      where: {
        prizeId,
        status: ClaimStatus.PENDING,
        expiresAt: { [Op.gt]: new Date() },
      },
      transaction,
    });
  }
}
