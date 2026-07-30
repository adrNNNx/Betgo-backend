// src/modules/game-access/game-access.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

// Servicios inyectados
import { BarsService } from '../bars/bars.service';
import {
  PlaysService,
  REELS,
  type GeneratedResult,
} from '../plays/plays.service';
import {
  UserDailyPlaysService,
} from '../user-daily-plays/user-daily-plays.service';

// Modelos
import { User } from '../users/entities/user.entity';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import {
  PoolMovement,
  PoolMovementType,
} from '../pool-movements/entities/pool-movement.entity';
import {
  Transaction,
  TransactionType,
} from '../transactions/entities/transaction.entity';

// Tipos
import { PlayType } from '../plays/entities/play.entity';
import { Bar } from '../bars/entities/bar.entity';
import { Prize } from '../prizes/entities/prize.entity';
import { PrizeClaim } from '../prize-claims/entities/prize-claim.entity';

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
    imageUrl?: string;
    claimCode?: string;
    claimQrCode?: string;
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
    private readonly sequelize: Sequelize,

    private readonly barsService: BarsService,
    private readonly playsService: PlaysService,
    private readonly userDailyPlaysService: UserDailyPlaysService,

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

  async playFree(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResultResponse> {
    const bar = await this.barsService.findBySlugOrCode(barSlug);
    const user = await this.getUser(userId);

    const dailyPlay = await this.userDailyPlaysService.verifyAndConsumeFreePlay(
      bar.id,
      userId,
      bar.freePlaysPerDay,
      bar.name,
    );

    const symbols = await this.playsService.getBarSymbols(bar.id);
    const result = this.playsService.generatePlayResult(symbols);

    // Gana si el símbolo que salió paga con esa cantidad de repeticiones.
    const prize = await this.playsService.getPrizeForResult(result);
    const isWinner = !!prize;

    const play = await this.playsService.createPlay({
      userId: user.id,
      barId: bar.id,
      tableId,
      type: PlayType.FREE,
      result: {
        symbols: result.symbolIds,
        matchCount: result.matchCount,
        isWinner,
        minMatch: result.topSymbol?.minMatchToWin ?? REELS,
      },
      isWinner,
      prizeId: prize?.id,
    });

    let claimCode: string | undefined;
    let claimQrCode: string | undefined;
    if (prize) {
      const claim = await this.playsService.createPrizeClaim(
        play.id,
        user.id,
        bar.id,
        prize.id,
      );
      claimCode = claim.claimCode;
      claimQrCode = await this.playsService.generateClaimQrCode(claimCode);
    }

    this.logger.log(
      `Jugada GRATIS - Bar: ${bar.slug}, User: ${user.phone}, ` +
        `Ganó: ${isWinner}, Restantes: ${dailyPlay.getRemainingPlays()}`,
    );

    return {
      playId: play.id,
      symbols: result.symbolIds,
      symbolDetails: result.symbolDetails,
      isWinner,
      prize: prize
        ? {
            id: prize.id,
            name: prize.name,
            type: prize.type,
            value: prize.value ?? undefined,
            imageUrl: prize.imageUrl ?? undefined,
            claimCode,
            claimQrCode,
          }
        : null,
      session: {
        playsRemaining: dailyPlay.getRemainingPlays(),
        playsUsed: dailyPlay.playsUsed,
        balance: user.balance,
      },
    };
  }

  // ==================== JUGADA PAGA (PREMIOS LOCALES) ====================

  /**
   * Jugada paga por premios locales del bar.
   *
   * FLUJO ATÓMICO:
   * 1. Validar usuario autenticado y saldo suficiente
   * 2. Generar resultado aleatorio (crypto.randomInt)
   * 3. TRANSACCIÓN:
   *    - Lock user + pool para evitar race conditions
   *    - Re-validar saldo dentro del lock
   *    - Descontar saldo
   *    - Crear registro de jugada
   *    - Registrar transacción de cobro
   *    - Distribuir: barPercentage% → bar, poolPercentage% → pozo, platformPercentage% → empresa
   *    - Registrar pool_movement por la contribución al pozo
   *    - Si ganó: crear claim de premio con QR
   * 4. Si CUALQUIER paso falla → rollback, nada se modifica
   */
  async playPaid(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResultResponse> {
    // === Validaciones previas (solo lectura) ===
    const bar = await this.barsService.findBySlugOrCode(barSlug);
    const user = await this.getUser(userId);
    const pool = await this.getGlobalPool();
    const playCost = Number(pool.costPerPlay);

    this.validatePlayCost(playCost);
    this.validateBalance(user.balance, playCost);

    // === Generar resultado (puro, sin side effects) ===
    const symbols = await this.playsService.getBarSymbols(bar.id);
    const result = this.playsService.generatePlayResult(symbols);

    // Gana si el símbolo que salió paga con esa cantidad de repeticiones.
    const prize = await this.playsService.getPrizeForResult(result);
    const isWinner = !!prize;

    // === Transacción atómica ===
    const txResult = await this.sequelize.transaction(async (transaction) => {
      // Lock para evitar race conditions
      await user.reload({ transaction, lock: true });
      await pool.reload({ transaction, lock: true });

      // Re-validar saldo (pudo cambiar entre lectura y lock)
      this.validateBalance(user.balance, playCost);

      const balanceBefore = user.balance;
      const poolBefore = Number(pool.currentAmount);

      // Calcular distribución
      const barRevenue = playCost * (bar.barPercentage / 100);
      const poolContribution = playCost * (bar.poolPercentage / 100);

      // 1) Descontar saldo
      await user.decrement('balance', { by: playCost, transaction });
      await user.reload({ transaction });

      // 2) Crear jugada
      const play = await this.playsService.createPlay(
        {
          userId: user.id,
          barId: bar.id,
          tableId,
          type: PlayType.PAID,
          result: {
            symbols: result.symbolIds,
            matchCount: result.matchCount,
            isWinner,
            minMatch: result.topSymbol?.minMatchToWin ?? REELS,
          },
          isWinner,
          prizeId: prize?.id,
          amountPaid: playCost,
          poolContribution,
        },
        transaction,
      );

      // 3) Registrar transacción de cobro
      await this.transactionModel.create(
        {
          userId: user.id,
          barId: bar.id,
          type: TransactionType.PLAY_PAID,
          amount: -playCost,
          balanceBefore,
          balanceAfter: user.balance,
        },
        { transaction },
      );

      // 4) Acreditar porcentaje al bar
      await bar.increment('balance', { by: barRevenue, transaction });

      // 5) Contribuir al pozo global
      await pool.increment('currentAmount', {
        by: poolContribution,
        transaction,
      });
      await pool.increment('totalCollected', {
        by: poolContribution,
        transaction,
      });
      await pool.reload({ transaction });

      // 6) Registrar movimiento del pozo
      await this.poolMovementModel.create(
        {
          type: PoolMovementType.CONTRIBUTION,
          amount: poolContribution,
          balanceBefore: poolBefore,
          balanceAfter: Number(pool.currentAmount),
          userId: user.id,
          barId: bar.id,
          playId: play.id,
        },
        { transaction },
      );

      // 7) Si ganó, crear claim
      let claimCode: string | undefined;
      let claimQrCode: string | undefined;
      if (prize) {
        const claim = await this.playsService.createPrizeClaim(
          play.id,
          user.id,
          bar.id,
          prize.id,
          transaction,
        );
        claimCode = claim.claimCode;
        claimQrCode = await this.playsService.generateClaimQrCode(claimCode);
      }

      return { play, claimCode, claimQrCode, poolAfter: Number(pool.currentAmount) };
    });

    // === Respuesta (ya committed) ===
    await user.reload();

    const dailyStatus = await this.userDailyPlaysService.getDailyPlayStatus(
      bar.id,
      userId,
      bar.freePlaysPerDay,
    );

    this.logger.log(
      `Jugada PAGA - Bar: ${bar.slug}, User: ${user.phone}, ` +
        `Costo: ${playCost}, Ganó: ${isWinner}`,
    );

    return {
      playId: txResult.play.id,
      symbols: result.symbolIds,
      symbolDetails: result.symbolDetails,
      isWinner,
      prize: prize
        ? {
            id: prize.id,
            name: prize.name,
            type: prize.type,
            value: prize.value ?? undefined,
            imageUrl: prize.imageUrl ?? undefined,
            claimCode: txResult.claimCode,
            claimQrCode: txResult.claimQrCode,
          }
        : null,
      session: {
        playsRemaining: dailyStatus.playsRemaining,
        playsUsed: dailyStatus.playsUsed,
        balance: user.balance,
      },
      poolAmount: txResult.poolAfter,
    };
  }

  // ==================== JUGADA POR POZO GLOBAL (JACKPOT) ====================

  /**
   * Jugada paga por el pozo global / jackpot.
   *
   * FLUJO ATÓMICO:
   * 1. Validar usuario + saldo vs pool.costPerPlay
   * 2. Generar resultado con símbolos globales (crypto.randomInt)
   * 3. TRANSACCIÓN:
   *    - Lock user + pool
   *    - Re-validar saldo
   *    - Descontar saldo
   *    - Crear registro de jugada
   *    - Registrar transacción de cobro
   *    - Acreditar barPercentage% al bar
   *    - Si NO ganó: contribuir poolPercentage% al pozo + pool_movement
   *    - Si GANÓ: transferir pozo al usuario, resetear pozo, registrar todo
   * 4. Si falla → rollback completo
   */
  async playPool(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResultResponse> {
    // === Validaciones previas ===
    const bar = await this.barsService.findBySlugOrCode(barSlug);
    const user = await this.getUser(userId);
    const pool = await this.getGlobalPool();
    const playCost = Number(pool.costPerPlay);

    this.validatePlayCost(playCost);
    this.validateBalance(user.balance, playCost);

    // === Generar resultado (puro) ===
    const symbols = await this.playsService.getGlobalSymbols();
    const result = this.playsService.generatePlayResult(symbols, REELS);

    // El jackpot exige los 5 carriles de un símbolo marcado como jackpot.
    const isJackpotWinner = this.isJackpotWin(result);

    // Premio menor: el símbolo que salió paga desde su propio umbral. No vacía
    // el pozo (es un premio físico) y la jugada igual contribuye.
    const minorPrize = isJackpotWinner
      ? null
      : await this.playsService.getPrizeForResult(result);

    // === Transacción atómica ===
    const txResult = await this.sequelize.transaction(async (transaction) => {
      // Lock filas críticas
      await user.reload({ transaction, lock: true });
      await pool.reload({ transaction, lock: true });

      // Re-validar saldo
      this.validateBalance(user.balance, playCost);

      const balanceBefore = user.balance;
      const poolBefore = Number(pool.currentAmount);

      // Distribución
      const poolContribution = playCost * (bar.poolPercentage / 100);
      const barRevenue = playCost * (bar.barPercentage / 100);

      // 1) Descontar saldo
      await user.decrement('balance', { by: playCost, transaction });
      await user.reload({ transaction });

      // 2) Crear jugada
      const play = await this.playsService.createPlay(
        {
          userId: user.id,
          barId: bar.id,
          tableId,
          type: PlayType.POOL,
          result: {
            symbols: result.symbolIds,
            matchCount: result.matchCount,
            isWinner: isJackpotWinner || !!minorPrize,
            minMatch: result.topSymbol?.minMatchToWin ?? REELS,
          },
          isWinner: isJackpotWinner || !!minorPrize,
          prizeId: minorPrize?.id,
          amountPaid: playCost,
          poolContribution,
        },
        transaction,
      );

      // 3) Transacción de cobro
      await this.transactionModel.create(
        {
          userId: user.id,
          barId: bar.id,
          type: TransactionType.PLAY_POOL,
          amount: -playCost,
          balanceBefore,
          balanceAfter: user.balance,
        },
        { transaction },
      );

      // 4) Revenue al bar
      await bar.increment('balance', { by: barRevenue, transaction });

      // 5) Premio menor: se reclama en el bar, igual que en free/paid.
      let minorClaim: PrizeClaim | undefined;
      if (minorPrize) {
        minorClaim = await this.playsService.createPrizeClaim(
          play.id,
          user.id,
          bar.id,
          minorPrize.id,
          transaction,
        );
      }

      let jackpotAmount: number | undefined;

      if (!isJackpotWinner) {
        // === NO GANÓ: contribuir al pozo ===
        await pool.increment('currentAmount', {
          by: poolContribution,
          transaction,
        });
        await pool.increment('totalCollected', {
          by: poolContribution,
          transaction,
        });
        await pool.reload({ transaction });

        await this.poolMovementModel.create(
          {
            type: PoolMovementType.CONTRIBUTION,
            amount: poolContribution,
            balanceBefore: poolBefore,
            balanceAfter: Number(pool.currentAmount),
            userId: user.id,
            barId: bar.id,
            playId: play.id,
          },
          { transaction },
        );
      } else {
        // === GANÓ EL JACKPOT ===
        jackpotAmount = poolBefore;

        // Transferir pozo al ganador
        await user.increment('balance', { by: jackpotAmount, transaction });
        await user.reload({ transaction });

        // Movimiento de vaciado del pozo
        await this.poolMovementModel.create(
          {
            type: PoolMovementType.JACKPOT_WIN,
            amount: -jackpotAmount,
            balanceBefore: poolBefore,
            balanceAfter: Number(pool.minAmount),
            userId: user.id,
            barId: bar.id,
            playId: play.id,
          },
          { transaction },
        );

        // Resetear pozo al mínimo
        await pool.update(
          {
            currentAmount: pool.minAmount,
            lastWinnerId: user.id,
            lastWinnerAmount: jackpotAmount,
            lastWinnerAt: new Date(),
            totalPaid: Number(pool.totalPaid) + jackpotAmount,
          },
          { transaction },
        );

        // Transacción de premio
        await this.transactionModel.create(
          {
            userId: user.id,
            barId: bar.id,
            type: TransactionType.PRIZE_JACKPOT,
            amount: jackpotAmount,
            balanceBefore: user.balance - jackpotAmount,
            balanceAfter: user.balance,
          },
          { transaction },
        );

        this.logger.log(
          `🎉 JACKPOT - User: ${user.phone}, Monto: Gs. ${jackpotAmount.toLocaleString()}, Bar: ${bar.slug}`,
        );
      }

      return {
        play,
        jackpotAmount,
        minorClaim,
        poolAfter: isJackpotWinner
          ? Number(pool.minAmount)
          : Number(pool.currentAmount),
      };
    });

    // === Respuesta ===
    await user.reload();

    const dailyStatus = await this.userDailyPlaysService.getDailyPlayStatus(
      bar.id,
      userId,
      bar.freePlaysPerDay,
    );

    this.logger.log(
      `Jugada POOL - Bar: ${bar.slug}, User: ${user.phone}, ` +
        `Costo: ${playCost}, Ganó: ${isJackpotWinner}` +
        (minorPrize ? `, Premio ${result.matchCount} iguales: ${minorPrize.name}` : ''),
    );

    let prizeResponse: PlayResultResponse['prize'] = null;
    if (isJackpotWinner) {
      prizeResponse = {
        id: 'jackpot',
        name: `¡JACKPOT! Gs. ${txResult.jackpotAmount?.toLocaleString()}`,
        type: 'jackpot',
        value: txResult.jackpotAmount,
      };
    } else if (minorPrize && txResult.minorClaim) {
      prizeResponse = {
        id: minorPrize.id,
        name: minorPrize.name,
        type: minorPrize.type,
        value: minorPrize.value ?? undefined,
        imageUrl: minorPrize.imageUrl ?? undefined,
        claimCode: txResult.minorClaim.claimCode,
        claimQrCode: await this.playsService.generateClaimQrCode(
          txResult.minorClaim.claimCode,
        ),
      };
    }

    return {
      playId: txResult.play.id,
      symbols: result.symbolIds,
      symbolDetails: result.symbolDetails,
      isWinner: isJackpotWinner || !!minorPrize,
      prize: prizeResponse,
      session: {
        playsRemaining: dailyStatus.playsRemaining,
        playsUsed: dailyStatus.playsUsed,
        balance: user.balance,
      },
      poolAmount: txResult.poolAfter,
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

  async getGlobalSymbolsForDisplay() {
    return this.playsService.getGlobalSymbolsForDisplay();
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

  /**
   * Si este giro se llevó el POZO GLOBAL: los 5 carriles con un símbolo que el
   * admin marcó como jackpot. Nunca es configurable a menos de 5, porque el
   * pozo es plata compartida entre todos los bares.
   */
  private isJackpotWin(result: GeneratedResult): boolean {
    return result.matchCount >= REELS && !!result.topSymbol?.isJackpot;
  }

  private validatePlayCost(cost: number): void {
    if (cost <= 0) {
      throw new BadRequestException(
        'El costo por jugada no está configurado correctamente.',
      );
    }
  }

  private validateBalance(balance: number, cost: number): void {
    if (balance < cost) {
      throw new BadRequestException(
        `Saldo insuficiente. Necesitas Gs. ${cost.toLocaleString()} para jugar. ` +
          `Tu saldo: Gs. ${balance.toLocaleString()}`,
      );
    }
  }
}
