// src/modules/game-access/game-access.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Bar } from '../bars/entities/bar.entity';
import { UserDailyPlay } from '../user-daily-plays/entities/user-daily-play.entity';
import { User } from '../users/entities/user.entity';
import { Symbol } from '../symbols/entities/symbol.entity';
import { Prize } from '../prizes/entities/prize.entity';
import { Play, PlayType } from '../plays/entities/play.entity';
import {
  PrizeClaim,
  ClaimStatus,
} from '../prize-claims/entities/prize-claim.entity';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import {
  PoolMovement,
  PoolMovementType,
} from '../pool-movements/entities/pool-movement.entity';
import {
  Transaction,
  TransactionType,
} from '../transactions/entities/transaction.entity';

// ==================== INTERFACES ====================

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

export interface PlayResult {
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
    @InjectModel(Bar)
    private barModel: typeof Bar,
    @InjectModel(UserDailyPlay)
    private userDailyPlayModel: typeof UserDailyPlay,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Symbol)
    private symbolModel: typeof Symbol,
    @InjectModel(Prize)
    private prizeModel: typeof Prize,
    @InjectModel(Play)
    private playModel: typeof Play,
    @InjectModel(PrizeClaim)
    private prizeClaimModel: typeof PrizeClaim,
    @InjectModel(GlobalPool)
    private globalPoolModel: typeof GlobalPool,
    @InjectModel(PoolMovement)
    private poolMovementModel: typeof PoolMovement,
    @InjectModel(Transaction)
    private transactionModel: typeof Transaction,
  ) {}

  // ==================== ACCESO AL BAR ====================

  /**
   * Acceder a un bar (usuario debe estar autenticado)
   * Este endpoint se llama después del login cuando el usuario escaneó el QR
   */
  async accessBar(
    barSlugOrCode: string,
    userId: string,
  ): Promise<BarAccessResponse> {
    // Buscar bar
    const bar = await this.findBarBySlugOrCode(barSlugOrCode);

    // Obtener usuario
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    // Obtener o crear registro de jugadas diarias
    const dailyPlay = await UserDailyPlay.findOrCreateForUser(
      bar.id,
      userId,
      bar.freePlaysPerDay,
    );

    // Obtener estado del pozo global
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
        playsRemaining: dailyPlay.getRemainingPlays(),
        playsUsed: dailyPlay.playsUsed,
        playsLimit: dailyPlay.playsLimit,
        userBalance: user.balance,
      },
      globalPool: {
        currentAmount: Number(pool.currentAmount),
        costPerPlay: Number(pool.costPerPlay),
      },
    };
  }

  /**
   * Obtener información pública del bar (sin autenticación)
   * Solo para mostrar el logo y nombre antes del login
   */
  async getBarPublicInfo(barSlugOrCode: string): Promise<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    frePlaysPerDay: number;
  }> {
    const bar = await this.findBarBySlugOrCode(barSlugOrCode);

    return {
      id: bar.id,
      name: bar.name,
      slug: bar.slug,
      logoUrl: bar.logoUrl,
      frePlaysPerDay: bar.freePlaysPerDay,
    };
  }

  // ==================== EJECUTAR JUGADAS ====================

  /**
   * Ejecutar jugada GRATIS
   */
  async playFree(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResult> {
    const bar = await this.findBarBySlugOrCode(barSlug);
    const user = await this.getUser(userId);

    // Obtener registro de jugadas diarias
    const dailyPlay = await UserDailyPlay.findOrCreateForUser(
      bar.id,
      userId,
      bar.freePlaysPerDay,
    );

    // Verificar que tiene jugadas disponibles
    if (!dailyPlay.hasPlaysRemaining()) {
      throw new BadRequestException(
        `Has agotado tus ${bar.freePlaysPerDay} jugadas gratis del día en ${bar.name}. ` +
          `¡Recarga saldo para jugar por el pozo global!`,
      );
    }

    // Obtener símbolos del bar
    const symbols = await this.getBarSymbols(bar.id);

    // Generar resultado
    const result = this.generatePlayResult(symbols);

    // Verificar si ganó
    const prize = result.isWinner
      ? await this.getPrizeForSymbol(result.winningSymbol)
      : null;

    // Crear registro de la jugada
    const play = await this.playModel.create({
      userId: user.id,
      barId: bar.id,
      tableId: tableId ?? undefined,
      type: PlayType.FREE,
      result: {
        symbols: result.symbolIds,
        matchCount: result.matchCount,
        isWinner: result.isWinner,
      },
      isWinner: result.isWinner,
      prizeId: prize?.id ?? undefined,
    });

    // Incrementar contador de jugadas usadas
    dailyPlay.incrementPlaysUsed();
    await dailyPlay.save();

    // Si ganó, crear claim del premio
    let claimCode: string | undefined;
    if (prize) {
      const claim = await this.createPrizeClaim(
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

  /**
   * Ejecutar jugada PAGA (premio local del bar)
   */
  async playPaid(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResult> {
    const bar = await this.findBarBySlugOrCode(barSlug);
    const user = await this.getUser(userId);

    // Costo de la jugada (configurable por bar en el futuro)
    const playCost = 1000;

    // Verificar saldo
    if (user.balance < playCost) {
      throw new BadRequestException(
        `Saldo insuficiente. Necesitas Gs. ${playCost.toLocaleString()} para jugar. ` +
          `Tu saldo: Gs. ${user.balance.toLocaleString()}`,
      );
    }

    // Obtener símbolos del bar
    const symbols = await this.getBarSymbols(bar.id);

    // Generar resultado
    const result = this.generatePlayResult(symbols);

    // Verificar si ganó premio local
    const prize = result.isWinner
      ? await this.getPrizeForSymbol(result.winningSymbol)
      : null;

    // Descontar saldo del usuario
    const balanceBefore = user.balance;
    await user.decrement('balance', { by: playCost });
    await user.reload();

    // Crear registro de la jugada
    const play = await this.playModel.create({
      userId: user.id,
      barId: bar.id,
      tableId: tableId ?? undefined,
      type: PlayType.PAID,
      result: {
        symbols: result.symbolIds,
        matchCount: result.matchCount,
        isWinner: result.isWinner,
      },
      isWinner: result.isWinner,
      prizeId: prize?.id ?? undefined,
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

    // Distribuir el pago según porcentajes del bar
    await this.distributePayment(bar, playCost);

    // Si ganó, crear claim del premio
    let claimCode: string | undefined;
    if (prize) {
      const claim = await this.createPrizeClaim(
        play.id,
        user.id,
        bar.id,
        prize.id,
      );
      claimCode = claim.claimCode;
    }

    // Obtener jugadas diarias restantes
    const dailyPlay = await UserDailyPlay.findOrCreateForUser(
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
        playsRemaining: dailyPlay.getRemainingPlays(),
        playsUsed: dailyPlay.playsUsed,
        balance: user.balance,
      },
    };
  }

  /**
   * Ejecutar jugada por el POZO GLOBAL
   */
  async playPool(
    barSlug: string,
    userId: string,
    tableId?: string,
  ): Promise<PlayResult> {
    const bar = await this.findBarBySlugOrCode(barSlug);
    const user = await this.getUser(userId);

    // Obtener pozo global
    const pool = await this.getGlobalPool();
    const playCost = Number(pool.costPerPlay);

    // Verificar saldo
    if (user.balance < playCost) {
      throw new BadRequestException(
        `Saldo insuficiente. Necesitas Gs. ${playCost.toLocaleString()} para jugar por el pozo. ` +
          `Tu saldo: Gs. ${user.balance.toLocaleString()}`,
      );
    }

    // Obtener símbolos GLOBALES (del pozo)
    const symbols = await this.getGlobalSymbols();

    // Generar resultado
    const result = this.generatePlayResult(symbols);

    // Verificar si ganó el jackpot (todos los símbolos iguales Y es el símbolo jackpot)
    const isJackpotWinner =
      result.isWinner && !!result.winningSymbol?.isJackpot;

    // Descontar saldo del usuario
    const balanceBefore = user.balance;
    await user.decrement('balance', { by: playCost });
    await user.reload();

    // Calcular contribución al pozo
    const poolContribution = playCost * (bar.poolPercentage / 100);

    // Crear registro de la jugada
    const play = await this.playModel.create({
      userId: user.id,
      barId: bar.id,
      tableId: tableId ?? undefined,
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
      // No ganó: agregar contribución al pozo
      const poolBefore = Number(pool.currentAmount);
      await pool.increment('currentAmount', { by: poolContribution });
      await pool.increment('totalCollected', { by: poolContribution });
      await pool.reload();

      // Registrar movimiento del pozo
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
      // ¡GANÓ EL JACKPOT!
      jackpotAmount = Number(pool.currentAmount);

      // Transferir pozo al ganador
      await user.increment('balance', { by: jackpotAmount });
      await user.reload();

      // Registrar movimiento del pozo
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

      // Resetear pozo al mínimo
      await pool.update({
        currentAmount: pool.minAmount,
        lastWinnerId: user.id,
        lastWinnerAmount: jackpotAmount,
        lastWinnerAt: new Date(),
        totalPaid: Number(pool.totalPaid) + jackpotAmount,
      });

      // Registrar transacción de premio
      await this.transactionModel.create({
        userId: user.id,
        barId: bar.id,
        type: TransactionType.PRIZE_JACKPOT,
        amount: jackpotAmount,
        balanceBefore: user.balance - jackpotAmount,
        balanceAfter: user.balance,
      });

      this.logger.log(
        `🎉🎉🎉 JACKPOT GANADO 🎉🎉🎉 - User: ${user.phone}, Monto: Gs. ${jackpotAmount.toLocaleString()}`,
      );
    }

    // Obtener jugadas diarias restantes
    const dailyPlay = await UserDailyPlay.findOrCreateForUser(
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
        playsRemaining: dailyPlay.getRemainingPlays(),
        playsUsed: dailyPlay.playsUsed,
        balance: user.balance,
      },
      poolAmount: Number(pool.currentAmount),
    };
  }

  // ==================== MÉTODOS DE CONSULTA ====================

  /**
   * Obtener estado actual del pozo global
   */
  async getGlobalPoolStatus(): Promise<{
    currentAmount: number;
    costPerPlay: number;
    lastWinner: { name: string; amount: number; date: Date } | null;
  }> {
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

  /**
   * Obtener resumen de jugadas del día del usuario
   */
  async getUserDailySummary(userId: string): Promise<{
    bars: Array<{
      barId: string;
      barName: string;
      barSlug: string;
      playsUsed: number;
      playsRemaining: number;
    }>;
    totalPlaysToday: number;
  }> {
    const dailyPlays = await UserDailyPlay.getUserTodayPlays(userId);

    const bars = dailyPlays.map((dp) => ({
      barId: dp.barId,
      barName: dp.bar?.name || '',
      barSlug: dp.bar?.slug || '',
      playsUsed: dp.playsUsed,
      playsRemaining: dp.getRemainingPlays(),
    }));

    const totalPlaysToday = dailyPlays.reduce(
      (sum, dp) => sum + dp.playsUsed,
      0,
    );

    return { bars, totalPlaysToday };
  }

  /**
   * Obtener símbolos del bar para mostrar en el juego
   */
  async getBarSymbolsForDisplay(barSlug: string): Promise<
    Array<{
      id: string;
      name: string;
      imageUrl: string;
      hasPrize: boolean;
    }>
  > {
    const bar = await this.findBarBySlugOrCode(barSlug);
    const symbols = await this.getBarSymbols(bar.id);

    return symbols.map((s) => ({
      id: s.id,
      name: s.name,
      imageUrl: s.imageUrl,
      hasPrize: !!s.prizeId,
    }));
  }

  // ==================== MÉTODOS PRIVADOS ====================

  private async findBarBySlugOrCode(slugOrCode: string): Promise<Bar> {
    const bar = await this.barModel.findOne({
      where: {
        [Op.or]: [{ slug: slugOrCode }, { accessCode: slugOrCode }],
        isActive: true,
      },
    });

    if (!bar) {
      throw new NotFoundException('Bar no encontrado o inactivo');
    }

    return bar;
  }

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

  private async getBarSymbols(barId: string): Promise<Symbol[]> {
    const symbols = await this.symbolModel.findAll({
      where: { barId, isActive: true },
      order: [['weight', 'DESC']],
      include: [{ model: Prize, required: false }],
    });

    if (symbols.length === 0) {
      throw new BadRequestException(
        'No hay símbolos configurados para este bar',
      );
    }

    return symbols;
  }

  private async getGlobalSymbols(): Promise<Symbol[]> {
    const symbols = await this.symbolModel.findAll({
      where: { barId: null, isActive: true },
      order: [['weight', 'DESC']],
      include: [{ model: Prize, required: false }],
    });

    if (symbols.length === 0) {
      throw new BadRequestException('No hay símbolos globales configurados');
    }

    return symbols;
  }

  private generatePlayResult(symbols: Symbol[]): {
    symbolIds: string[];
    symbolDetails: Array<{ id: string; name: string; imageUrl: string }>;
    isWinner: boolean;
    matchCount: number;
    winningSymbol: Symbol | null;
  } {
    // Generar 5 símbolos aleatorios basados en peso
    const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0);
    const resultSymbols: Symbol[] = [];

    for (let i = 0; i < 5; i++) {
      let random = Math.random() * totalWeight;
      for (const symbol of symbols) {
        random -= symbol.weight;
        if (random <= 0) {
          resultSymbols.push(symbol);
          break;
        }
      }
      // Fallback
      if (resultSymbols.length <= i) {
        resultSymbols.push(symbols[symbols.length - 1]);
      }
    }

    // Contar coincidencias
    const symbolCounts = new Map<string, { count: number; symbol: Symbol }>();
    for (const symbol of resultSymbols) {
      const existing = symbolCounts.get(symbol.id);
      if (existing) {
        existing.count++;
      } else {
        symbolCounts.set(symbol.id, { count: 1, symbol });
      }
    }

    // Encontrar el máximo de coincidencias
    let maxCount = 0;
    let winningSymbol: Symbol | null = null;
    for (const [, value] of symbolCounts) {
      if (value.count > maxCount) {
        maxCount = value.count;
        winningSymbol = value.symbol;
      }
    }

    // Gana si tiene 5 iguales
    const isWinner = maxCount === 5;

    return {
      symbolIds: resultSymbols.map((s) => s.id),
      symbolDetails: resultSymbols.map((s) => ({
        id: s.id,
        name: s.name,
        imageUrl: s.imageUrl,
      })),
      isWinner,
      matchCount: maxCount,
      winningSymbol: isWinner ? winningSymbol : null,
    };
  }

  private async getPrizeForSymbol(
    symbol: Symbol | null,
  ): Promise<Prize | null> {
    if (!symbol || !symbol.prizeId) {
      return null;
    }
    return this.prizeModel.findByPk(symbol.prizeId);
  }

  private async createPrizeClaim(
    playId: string,
    userId: string,
    barId: string,
    prizeId: string,
  ): Promise<PrizeClaim> {
    // Generar código de reclamo
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let claimCode = 'P-';
    for (let i = 0; i < 8; i++) {
      claimCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Fecha de expiración (7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prizeClaimModel.create({
      playId,
      userId,
      barId,
      prizeId,
      claimCode,
      status: ClaimStatus.PENDING,
      expiresAt,
    });
  }

  private async distributePayment(bar: Bar, amount: number): Promise<void> {
    // Calcular distribución
    const barAmount = amount * (bar.barPercentage / 100);
    const poolAmount = amount * (bar.poolPercentage / 100);

    // Acreditar al bar
    await bar.increment('balance', { by: barAmount });

    // Acreditar al pozo
    const pool = await this.globalPoolModel.findOne({ where: { id: 1 } });
    if (pool) {
      await pool.increment('currentAmount', { by: poolAmount });
      await pool.increment('totalCollected', { by: poolAmount });
    }
  }
}
