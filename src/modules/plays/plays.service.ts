// src/modules/plays/plays.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction as SequelizeTransaction } from 'sequelize';
import { randomInt } from 'crypto';
import * as QRCode from 'qrcode';
import { Play, PlayType, PlayResult } from './entities/play.entity';
import { Symbol } from '../symbols/entities/symbol.entity';
import { Prize } from '../prizes/entities/prize.entity';
import {
  PrizeClaim,
  ClaimStatus,
} from '../prize-claims/entities/prize-claim.entity';

// ==================== INTERFACES ====================

export interface GeneratedResult {
  symbolIds: string[];
  symbolDetails: Array<{ id: string; name: string; imageUrl: string }>;
  isWinner: boolean;
  matchCount: number;
  winningSymbol: Symbol | null;
}

export interface CreatePlayParams {
  userId: string;
  barId: string;
  tableId?: string;
  type: PlayType;
  result: PlayResult;
  isWinner: boolean;
  prizeId?: string;
  amountPaid?: number;
  poolContribution?: number;
}

@Injectable()
export class PlaysService {
  private readonly logger = new Logger(PlaysService.name);

  constructor(
    @InjectModel(Play)
    private readonly playModel: typeof Play,
    @InjectModel(Symbol)
    private readonly symbolModel: typeof Symbol,
    @InjectModel(Prize)
    private readonly prizeModel: typeof Prize,
    @InjectModel(PrizeClaim)
    private readonly prizeClaimModel: typeof PrizeClaim,
  ) {}

  // ==================== CREACIÓN DE JUGADAS ====================

  /**
   * Crear un registro de jugada.
   * Acepta una transacción opcional para operaciones atómicas.
   */
  async createPlay(
    params: CreatePlayParams,
    transaction?: SequelizeTransaction,
  ): Promise<Play> {
    return this.playModel.create(
      {
        userId: params.userId,
        barId: params.barId,
        tableId: params.tableId,
        type: params.type,
        result: params.result,
        isWinner: params.isWinner,
        prizeId: params.prizeId,
        amountPaid: params.amountPaid,
        poolContribution: params.poolContribution,
      },
      { transaction },
    );
  }

  // ==================== GENERACIÓN DE RESULTADOS ====================

  /**
   * Obtener símbolos activos para un bar.
   * Fusiona símbolos globales (bar_id = NULL) + exclusivos del bar.
   */
  async getBarSymbols(barId: string): Promise<Symbol[]> {
    const symbols = await this.symbolModel.findAll({
      where: {
        [Op.or]: [{ barId: null }, { barId }],
        isActive: true,
      },
      order: [['weight', 'DESC']],
      include: [{ model: Prize, required: false }],
    });

    if (symbols.length === 0) {
      throw new BadRequestException(
        'No hay símbolos configurados. Se necesitan al menos símbolos globales.',
      );
    }

    return symbols;
  }

  /**
   * Obtener solo símbolos globales (para el pozo global).
   */
  async getGlobalSymbols(): Promise<Symbol[]> {
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

  /**
   * Generar resultado aleatorio con crypto.randomInt (CSPRNG).
   *
   * ALGORITMO:
   *  - Usa crypto.randomInt() → entropía real del OS, no Math.random()
   *  - Cada carril se resuelve de forma independiente con selección ponderada
   *  - Símbolo con weight=200 aparece ~2x más que uno con weight=100
   *  - Gana SOLO si los 5 carriles muestran el mismo símbolo
   *
   * PROBABILIDADES (ejemplo con N símbolos de peso uniforme):
   *  - N=8:  P(jackpot) = 8 × (1/8)^5 = 1/4,096   ≈ 0.024%
   *  - N=10: P(jackpot) = 10 × (1/10)^5 = 1/10,000  ≈ 0.01%
   *  - N=6:  P(jackpot) = 6 × (1/6)^5 = 1/1,296   ≈ 0.077%
   *
   * Con pesos desiguales, los símbolos más pesados tienen más chance
   * de repetirse. Un símbolo con 40% de probabilidad individual
   * tiene P(5 iguales) = 0.4^5 ≈ 1.02% — todavía difícil pero no imposible.
   *
   * FORCE_WIN=true en .env → siempre retorna victoria (solo testing).
   */
  generatePlayResult(symbols: Symbol[]): GeneratedResult {
    // === Testing mode ===
    if (process.env.FORCE_WIN === 'true') {
      const winSymbol = symbols[0];
      const arr = Array(5).fill(winSymbol) as Symbol[];
      return {
        symbolIds: arr.map((s) => s.id),
        symbolDetails: arr.map((s) => ({
          id: s.id,
          name: s.name,
          imageUrl: s.imageUrl,
        })),
        isWinner: true,
        matchCount: 5,
        winningSymbol: winSymbol,
      };
    }

    // === Generar 5 símbolos aleatorios ===
    const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0);
    const resultSymbols: Symbol[] = [];

    for (let i = 0; i < 5; i++) {
      resultSymbols.push(this.selectWeightedSymbol(symbols, totalWeight));
    }

    // === Contar coincidencias ===
    const counts = new Map<string, { count: number; symbol: Symbol }>();
    for (const symbol of resultSymbols) {
      const existing = counts.get(symbol.id);
      if (existing) {
        existing.count++;
      } else {
        counts.set(symbol.id, { count: 1, symbol });
      }
    }

    let maxCount = 0;
    let winningSymbol: Symbol | null = null;
    for (const [, value] of counts) {
      if (value.count > maxCount) {
        maxCount = value.count;
        winningSymbol = value.symbol;
      }
    }

    // Victoria = 5 iguales
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

  /**
   * Selección ponderada con crypto.randomInt (CSPRNG).
   * Es 100% aleatorio, criptográficamente seguro, no predecible.
   */
  private selectWeightedSymbol(
    symbols: Symbol[],
    totalWeight: number,
  ): Symbol {
    // crypto.randomInt(min, max) genera entero en [min, max) con entropía del OS
    const random = randomInt(0, totalWeight);

    let cumulative = 0;
    for (const symbol of symbols) {
      cumulative += symbol.weight;
      if (random < cumulative) {
        return symbol;
      }
    }

    // Fallback (matemáticamente imposible pero TypeScript lo pide)
    return symbols[symbols.length - 1];
  }

  // ==================== PREMIOS ====================

  /**
   * Obtener premio asociado a un símbolo ganador.
   */
  async getPrizeForSymbol(symbol: Symbol | null): Promise<Prize | null> {
    if (!symbol || !symbol.prizeId) {
      return null;
    }
    const prize = await this.prizeModel.findByPk(symbol.prizeId);
    if (prize && !prize.isActive) {
      throw new BadRequestException(
        `El premio "${prize.name}" no está disponible actualmente.`,
      );
    }
    return prize;
  }

  /**
   * Generar QR en formato Data URL para un código de reclamo.
   */
  async generateClaimQrCode(claimCode: string): Promise<string> {
    return QRCode.toDataURL(claimCode, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
  }

  /**
   * Crear un claim de premio.
   * Acepta transacción opcional.
   */
  async createPrizeClaim(
    playId: string,
    userId: string,
    barId: string,
    prizeId: string,
    transaction?: SequelizeTransaction,
  ): Promise<PrizeClaim> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let claimCode = 'P-';
    for (let i = 0; i < 8; i++) {
      claimCode += chars.charAt(randomInt(0, chars.length));
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prizeClaimModel.create(
      {
        playId,
        userId,
        barId,
        prizeId,
        claimCode,
        status: ClaimStatus.PENDING,
        expiresAt,
      },
      { transaction },
    );
  }

  // ==================== CONSULTAS ====================

  async getBarSymbolsForDisplay(barId: string): Promise<
    Array<{
      id: string;
      name: string;
      imageUrl: string;
      weight: number;
      hasPrize: boolean;
      isGlobal: boolean;
      isJackpot: boolean;
    }>
  > {
    const symbols = await this.getBarSymbols(barId);

    return symbols.map((s) => ({
      id: s.id,
      name: s.name,
      imageUrl: s.imageUrl,
      weight: s.weight,
      hasPrize: !!s.prizeId,
      isGlobal: s.barId === null,
      isJackpot: s.isJackpot,
    }));
  }

  async getUserPlayHistory(
    userId: string,
    barId?: string,
    limit: number = 50,
  ): Promise<Play[]> {
    const where: any = { userId };
    if (barId) where.barId = barId;

    return this.playModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });
  }
}
