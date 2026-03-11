// src/modules/game-access/game-access.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

// Servicios inyectados (Single Responsibility)
import { BarsService } from '../bars/bars.service';
import { PlaysService } from '../plays/plays.service';
import {
  UserDailyPlaysService,
  DailyPlayStatus,
} from '../user-daily-plays/user-daily-plays.service';

// Modelos que aún no tienen service propio
import { User } from '../users/entities/user.entity';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import { PoolMovement, PoolMovementType } from '../pool-movements/entities/pool-movement.entity';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';

// Tipos
import { PlayType } from '../plays/entities/play.entity';

// ==================== INTERFACES DE RESPUESTA ====================

export interface BarAccessResponse {
  bar: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    freePlaysPerDay: number;
  };
  session: {
    playsRemaining: number;
    playsUsed: number;
    playsLimit: number;
    userBalance: number;
  };
  globalPool: {
    currentAmount: number;
    costPerPlay: number;
  };
}

export interface PlayResultResponse {
  playId: string;
  symbols: string[];
  symbolDetails: Array<{ id: string; name: string; imageUrl: string }>;
  isWinner: boolean;
  prize: {
    id: string;
    name: string;
    type: string;
    value?: number;
    claimCode?: string;
  } | null;
  session: {
    playsRemaining: number;
    playsUsed: number;
    balance: number;
  };
  poolAmount?: number;
}

@Injectable()
export class GameAccessService {
  private readonly logger = new Logger(GameAccessService.name);

  constructor(
    // Servicios inyectados
    private readonly barsService: BarsService,
    private readonly playsService: PlaysService,
    private readonly userDailyPlaysService: UserDailyPlaysService,

    // Modelos directos (migrar a services en el futuro)
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(GlobalPool)
    private readonly globalPoolModel: typeof GlobalPool,
    @InjectModel(PoolMovement)
    private readonly poolMovementModel: typeof PoolMovement,
    @InjectModel(Transaction)
    private readonly transactionModel: typeof Transaction,
  ) {}

  // ==================== ACCESO AL BAR ====================

  /**
   * Acceder a un bar (usuario autenticado).
   * Retorna la info del bar + estado de jugadas + pozo global.
   */
  async accessBar(
    barSlugOrCode: string,
    userId: string,
  ): Promise<BarAccessResponse> {
    const bar = await this.barsService.findBySlugOrCode(barSlugOrCode);
    const user = await this.getUser(userId);

    const dailyStatus = await this.userDailyPlaysService.getDailyPlayStatus(
      bar.id,
      userId,
      bar.freePlaysPerDay,
    );

    const pool = await this.getGlobalPool();

    return {
      bar: {
        id: bar.id,
        name: bar.name,
        slug: bar.slug,
        logoUrl: bar.logoUrl,
        freePlaysPerDay: bar.freePlaysPerDay,
      },
      session: {
        playsRemaining: dailyStatus.playsRemaining,
        playsUsed: dailyStatus.playsUsed,
        playsLimit: dailyStatus.playsLimit,
        userBalance: user.balance,
      },
      globalPool: {
        currentAmount: Number(pool.currentAmount),
        costPerPlay: Number(pool.costPerPlay),
      },
    };
  }

  /**
   * Obtener información pública del bar (sin autenticación).
   */
  async getBarPublicInfo(barSlugOrCode: string) {
    const bar = await this.barsService.findBySlugOrCode(barSlugOrCode);

    return {
      id: bar.id,
      name: bar.name,
      slug: bar.slug,
      logoUrl: bar.logoUrl,
      freePlaysPerDay: bar.freePlaysPerDay,
    };
  }

  // ==================== JUGADA GRATIS ====================

  /**
   * Ejecutar jugada gratuita.
   * Verifica disponibilidad, genera resultado, consume la jugada.
   */
  async playFree(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResultResponse> {
    const bar = await this.barsService.findBySlugOrCode(barSlug);
    const user = await this.getUser(userId);

    // Verificar y consumir jugada diaria (lanza excepción si no hay)
    const dailyPlay = await this.userDailyPlaysService.verifyAndConsumeFreePlay(
      bar.id,
      userId,
      bar.freePlaysPerDay,
      bar.name,
    );

    // Obtener símbolos y generar resultado
    const symbols = await this.playsService.getBarSymbols(bar.id);
    const result = this.playsService.generatePlayResult(symbols);

    // Verificar premio
    const prize = result.isWinner
      ? await this.playsService.getPrizeForSymbol(result.winningSymbol)
      : null;

    // Crear registro de la jugada
    const play = await this.playsService.createPlay({
      userId: user.id,
      barId: bar.id,
      tableId,
      type: PlayType.FREE,
      result: {
        symbols: result.symbolIds,
        matchCount: result.matchCount,
        isWinner: result.isWinner,
      },
      isWinner: result.isWinner,
      prizeId: prize?.id,
    });

    // Si ganó, crear claim del premio
    let claimCode: string | undefined;
    if (prize) {
      const claim = await this.playsService.createPrizeClaim(
        play.id,
        user.id,
        bar.id,
        prize.id,
      );
      claimCode = claim.claimCode;
    }

    this.logger.log(
      `Jugada GRATIS - Bar: ${bar.slug}, User: ${user.phone}, ` +
        `Ganó: ${result.isWinner}, Restantes: ${dailyPlay.getRemainingPlays()}`,
    );

    return {
      playId: play.id,
      symbols: result.symbolIds,
      symbolDetails: result.symbolDetails,
      isWinner: result.isWinner,
      prize: prize
        ? {
            id: prize.id,
            name: prize.name,
            type: prize.type,
            value: prize.value ?? undefined,
            claimCode,
          }
        : null,
      session: {
        playsRemaining: dailyPlay.getRemainingPlays(),
        playsUsed: dailyPlay.playsUsed,
        balance: user.balance,
      },
    };
  }

  // ==================== JUGADA PAGA ====================

  /**
   * Ejecutar jugada paga (premio local del bar).
   */
  async playPaid(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResultResponse> {
    const bar = await this.barsService.findBySlugOrCode(barSlug);
    const user = await this.getUser(userId);

    const playCost = 1000; // TODO: hacer configurable por bar

    if (user.balance < playCost) {
      throw new BadRequestException(
        `Saldo insuficiente. Necesitas Gs. ${playCost.toLocaleString()} para jugar. ` +
          `Tu saldo: Gs. ${user.balance.toLocaleString()}`,
      );
    }

    // Generar resultado
    const symbols = await this.playsService.getBarSymbols(bar.id);
    const result = this.playsService.generatePlayResult(symbols);

    const prize = result.isWinner
      ? await this.playsService.getPrizeForSymbol(result.winningSymbol)
      : null;

    // Descontar saldo
    const balanceBefore = user.balance;
    await user.decrement('balance', { by: playCost });
    await user.reload();

    // Crear jugada
    const play = await this.playsService.createPlay({
      userId: user.id,
      barId: bar.id,
      tableId,
      type: PlayType.PAID,
      result: {
        symbols: result.symbolIds,
        matchCount: result.matchCount,
        isWinner: result.isWinner,
      },
      isWinner: result.isWinner,
      prizeId: prize?.id,
      amountPaid: playCost,
    });

    // Registrar transacción
    await this.transactionModel.create({
      userId: user.id,
      barId: bar.id,
      type: TransactionType.PLAY_PAID,
      amount: -playCost,
      balanceBefore,
      balanceAfter: user.balance,
    });

    // Distribuir pago según porcentajes
    await this.distributePayment(bar, playCost);

    // Crear claim si ganó
    let claimCode: string | undefined;
    if (prize) {
      const claim = await this.playsService.createPrizeClaim(
        play.id,
        user.id,
        bar.id,
        prize.id,
      );
      claimCode = claim.claimCode;
    }

    // Obtener estado actualizado de jugadas diarias
    const dailyStatus = await this.userDailyPlaysService.getDailyPlayStatus(
      bar.id,
      userId,
      bar.freePlaysPerDay,
    );

    this.logger.log(
      `Jugada PAGA - Bar: ${bar.slug}, User: ${user.phone}, ` +
        `Costo: ${playCost}, Ganó: ${result.isWinner}`,
    );

    return {
      playId: play.id,
      symbols: result.symbolIds,
      symbolDetails: result.symbolDetails,
      isWinner: result.isWinner,
      prize: prize
        ? {
            id: prize.id,
            name: prize.name,
            type: prize.type,
            value: prize.value ?? undefined,
            claimCode,
          }
        : null,
      session: {
        playsRemaining: dailyStatus.playsRemaining,
        playsUsed: dailyStatus.playsUsed,
        balance: user.balance,
      },
    };
  }

  // ==================== JUGADA POR POZO GLOBAL ====================

  /**
   * Ejecutar jugada por el pozo global (jackpot).
   */
  async playPool(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResultResponse> {
    const bar = await this.barsService.findBySlugOrCode(barSlug);
    const user = await this.getUser(userId);

    const pool = await this.getGlobalPool();
    const playCost = Number(pool.costPerPlay);

    if (user.balance < playCost) {
      throw new BadRequestException(
        `Saldo insuficiente. Necesitas Gs. ${playCost.toLocaleString()} para jugar por el pozo. ` +
          `Tu saldo: Gs. ${user.balance.toLocaleString()}`,
      );
    }

    // Generar resultado con símbolos globales
    const symbols = await this.playsService.getGlobalSymbols();
    const result = this.playsService.generatePlayResult(symbols);

    const isJackpotWinner =
      result.isWinner && !!result.winningSymbol?.isJackpot;

    // Descontar saldo
    const balanceBefore = user.balance;
    await user.decrement('balance', { by: playCost });
    await user.reload();

    const poolContribution = playCost * (bar.poolPercentage / 100);

    // Crear jugada
    const play = await this.playsService.createPlay({
      userId: user.id,
      barId: bar.id,
      tableId,
      type: PlayType.POOL,
      result: {
        symbols: result.symbolIds,
        matchCount: result.matchCount,
        isWinner: result.isWinner,
      },
      isWinner: isJackpotWinner,
      amountPaid: playCost,
      poolContribution,
    });

    // Registrar transacción
    await this.transactionModel.create({
      userId: user.id,
      barId: bar.id,
      type: TransactionType.PLAY_POOL,
      amount: -playCost,
      balanceBefore,
      balanceAfter: user.balance,
    });

    let jackpotAmount: number | undefined;

    if (!isJackpotWinner) {
      // No ganó: contribuir al pozo
      const poolBefore = Number(pool.currentAmount);
      await pool.increment('currentAmount', { by: poolContribution });
      await pool.increment('totalCollected', { by: poolContribution });
      await pool.reload();

      await this.poolMovementModel.create({
        type: PoolMovementType.CONTRIBUTION,
        amount: poolContribution,
        balanceBefore: poolBefore,
        balanceAfter: Number(pool.currentAmount),
        userId: user.id,
        barId: bar.id,
        playId: play.id,
      });
    } else {
      // ¡JACKPOT!
      jackpotAmount = Number(pool.currentAmount);

      await user.increment('balance', { by: jackpotAmount });
      await user.reload();

      const poolBefore = Number(pool.currentAmount);
      await this.poolMovementModel.create({
        type: PoolMovementType.JACKPOT_WIN,
        amount: -jackpotAmount,
        balanceBefore: poolBefore,
        balanceAfter: Number(pool.minAmount),
        userId: user.id,
        barId: bar.id,
        playId: play.id,
      });

      await pool.update({
        currentAmount: pool.minAmount,
        lastWinnerId: user.id,
        lastWinnerAmount: jackpotAmount,
        lastWinnerAt: new Date(),
        totalPaid: Number(pool.totalPaid) + jackpotAmount,
      });

      await this.transactionModel.create({
        userId: user.id,
        barId: bar.id,
        type: TransactionType.PRIZE_JACKPOT,
        amount: jackpotAmount,
        balanceBefore: user.balance - jackpotAmount,
        balanceAfter: user.balance,
      });

      this.logger.log(
        `🎉 JACKPOT GANADO - User: ${user.phone}, Monto: Gs. ${jackpotAmount.toLocaleString()}`,
      );
    }

    // Estado actualizado de jugadas
    const dailyStatus = await this.userDailyPlaysService.getDailyPlayStatus(
      bar.id,
      userId,
      bar.freePlaysPerDay,
    );

    return {
      playId: play.id,
      symbols: result.symbolIds,
      symbolDetails: result.symbolDetails,
      isWinner: isJackpotWinner,
      prize: isJackpotWinner
        ? {
            id: 'jackpot',
            name: `¡JACKPOT! Gs. ${jackpotAmount?.toLocaleString()}`,
            type: 'jackpot',
            value: jackpotAmount,
          }
        : null,
      session: {
        playsRemaining: dailyStatus.playsRemaining,
        playsUsed: dailyStatus.playsUsed,
        balance: user.balance,
      },
      poolAmount: Number(pool.currentAmount),
    };
  }

  // ==================== CONSULTAS ====================

  async getGlobalPoolStatus() {
    const pool = await this.getGlobalPool();

    let lastWinner;
    if (pool.lastWinnerId) {
      const winner = await this.userModel.findByPk(pool.lastWinnerId, {
        attributes: ['name', 'phone'],
      });
      lastWinner = {
        name: winner?.name || 'Anónimo',
        amount: Number(pool.lastWinnerAmount),
        date: pool.lastWinnerAt!,
      };
    }

    return {
      currentAmount: Number(pool.currentAmount),
      costPerPlay: Number(pool.costPerPlay),
      lastWinner,
    };
  }

  async getUserDailySummary(userId: string) {
    return this.userDailyPlaysService.getUserDailySummary(userId);
  }

  async getBarSymbolsForDisplay(barSlug: string) {
    const bar = await this.barsService.findBySlugOrCode(barSlug);
    return this.playsService.getBarSymbolsForDisplay(bar.id);
  }

  // ==================== PRIVADOS ====================

  private async getUser(userId: string): Promise<User> {
    const user = await this.userModel.findByPk(userId);
    if (!user || !user.isActive) {
      throw new ForbiddenException('Usuario no encontrado o inactivo');
    }
    return user;
  }

  private async getGlobalPool(): Promise<GlobalPool> {
    const pool = await this.globalPoolModel.findOne({ where: { id: 1 } });
    if (!pool) {
      throw new BadRequestException('Pozo global no configurado');
    }
    return pool;
  }

  private async distributePayment(bar: any, amount: number): Promise<void> {
    const barAmount = amount * (bar.barPercentage / 100);
    const poolAmount = amount * (bar.poolPercentage / 100);

    await bar.increment('balance', { by: barAmount });

    const pool = await this.globalPoolModel.findOne({ where: { id: 1 } });
    if (pool) {
      await pool.increment('currentAmount', { by: poolAmount });
      await pool.increment('totalCollected', { by: poolAmount });
    }
  }
}
