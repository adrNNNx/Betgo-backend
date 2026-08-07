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

export const REELS = 5;
export const MIN_MATCH = 3;

/**
 * Resultado crudo de un giro: qué salió y qué se repitió más.
 * No decide si ganó: eso lo define el símbolo (ver `getPrizeForResult`).
 */
export interface GeneratedResult {
  symbolIds: string[];
  symbolDetails: Array<{ id: string; name: string; imageUrl: string }>;
  /** Veces que se repitió el símbolo más frecuente (1-5). */
  matchCount: number;
  /** El símbolo más repetido. Con matchCount >= 3 es siempre único. */
  topSymbol: Symbol | null;
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
   *
   * Sólo gira y cuenta: si eso paga algo lo decide el símbolo que salió
   * (ver `getPrizeForResult`), porque cada uno define desde cuántos iguales
   * entrega su premio.
   *
   * FORCE_WIN=true en .env → fuerza exactamente `forceMatch` coincidencias,
   * para poder probar cada nivel (solo testing).
   */
  generatePlayResult(symbols: Symbol[], forceMatch = REELS): GeneratedResult {
    let resultSymbols: Symbol[];

    if (process.env.FORCE_WIN === 'true') {
      const target = Math.min(REELS, Math.max(MIN_MATCH, forceMatch));
      // Rellena con otro símbolo para no pasarse del umbral pedido.
      const filler = symbols[1] ?? symbols[0];
      resultSymbols = [
        ...(Array(target).fill(symbols[0]) as Symbol[]),
        ...(Array(REELS - target).fill(filler) as Symbol[]),
      ];
    } else {
      const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0);
      resultSymbols = Array.from({ length: REELS }, () =>
        this.selectWeightedSymbol(symbols, totalWeight),
      );
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
    let topSymbol: Symbol | null = null;
    for (const [, value] of counts) {
      if (value.count > maxCount) {
        maxCount = value.count;
        topSymbol = value.symbol;
      }
    }

    return {
      symbolIds: resultSymbols.map((s) => s.id),
      symbolDetails: resultSymbols.map((s) => ({
        id: s.id,
        name: s.name,
        imageUrl: s.imageUrl,
      })),
      matchCount: maxCount,
      topSymbol,
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
   * Premio que paga un giro, según el símbolo que salió.
   *
   * Manda el símbolo: paga su premio si se repitió al menos tantas veces como
   * pide su `minMatchToWin`. Así la cereza puede pagar desde 3 y el diamante
   * exigir 4, cada uno con su premio y su frecuencia.
   *
   * Devuelve null si no se repitió lo suficiente, si el símbolo no tiene
   * premio, o si el premio quedó inactivo (no rompe la jugada: simplemente
   * no se gana, que es lo correcto para el jugador).
   */
  async getPrizeForResult(result: GeneratedResult): Promise<Prize | null> {
    const symbol = result.topSymbol;
    if (!symbol?.prizeId) return null;
    if (result.matchCount < symbol.minMatchToWin) return null;

    const prize = await this.prizeModel.findByPk(symbol.prizeId);
    return prize?.isActive ? prize : null;
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
      prizeName: string | null;
      minMatchToWin: number;
      isGlobal: boolean;
      isJackpot: boolean;
    }>
  > {
    const symbols = await this.getBarSymbols(barId);

    // getBarSymbols ya trae la relación Prize, así que prizeName no cuesta query extra.
    return symbols.map((s) => ({
      id: s.id,
      name: s.name,
      imageUrl: s.imageUrl,
      weight: s.weight,
      hasPrize: !!s.prizeId,
      prizeName: s.prize?.name ?? null,
      minMatchToWin: s.minMatchToWin,
      isGlobal: s.barId === null,
      isJackpot: s.isJackpot,
    }));
  }

  /**
   * Obtener solo símbolos globales para mostrar en la UI del pozo global.
   * Solo retorna símbolos con bar_id IS NULL.
   */
  async getGlobalSymbolsForDisplay(): Promise<
    Array<{
      id: string;
      name: string;
      imageUrl: string;
      weight: number;
      hasPrize: boolean;
      prizeName: string | null;
      minMatchToWin: number;
      isJackpot: boolean;
    }>
  > {
    const symbols = await this.getGlobalSymbols();

    return symbols.map((s) => ({
      id: s.id,
      name: s.name,
      imageUrl: s.imageUrl,
      weight: s.weight,
      hasPrize: !!s.prizeId,
      prizeName: s.prize?.name ?? null,
      minMatchToWin: s.minMatchToWin,
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
