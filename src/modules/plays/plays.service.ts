// src/modules/plays/plays.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
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
   * Crear un registro de jugada en la base de datos.
   */
  async createPlay(params: CreatePlayParams): Promise<Play> {
    return this.playModel.create({
      userId: params.userId,
      barId: params.barId,
      tableId: params.tableId,
      type: params.type,
      result: params.result,
      isWinner: params.isWinner,
      prizeId: params.prizeId,
      amountPaid: params.amountPaid,
      poolContribution: params.poolContribution,
    });
  }

  // ==================== GENERACIÓN DE RESULTADOS ====================

  /**
   * Obtener símbolos activos para un bar.
   * Fusiona símbolos globales (bar_id = NULL) + exclusivos del bar.
   * Solo retorna los que están activos (is_active = true).
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
   * Generar un resultado aleatorio basado en los pesos de los símbolos.
   * Retorna 5 símbolos. Gana si los 5 son iguales.
   * Si FORCE_WIN=true en el entorno, siempre retorna victoria (solo para testing).
   */
  generatePlayResult(symbols: Symbol[]): GeneratedResult {
    if (process.env.FORCE_WIN === 'true') {
      const winSymbol = symbols[0];
      const resultSymbols = Array(5).fill(winSymbol) as Symbol[];
      return {
        symbolIds: resultSymbols.map((s) => s.id),
        symbolDetails: resultSymbols.map((s) => ({
          id: s.id,
          name: s.name,
          imageUrl: s.imageUrl,
        })),
        isWinner: true,
        matchCount: 5,
        winningSymbol: winSymbol,
      };
    }

    const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0);
    const resultSymbols: Symbol[] = [];

    for (let i = 0; i < 5; i++) {
      let random = Math.random() * totalWeight;
      let selected = false;

      for (const symbol of symbols) {
        random -= symbol.weight;
        if (random <= 0) {
          resultSymbols.push(symbol);
          selected = true;
          break;
        }
      }

      // Fallback por seguridad
      if (!selected) {
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

  // ==================== PREMIOS ====================

  /**
   * Obtener premio asociado a un símbolo ganador.
   * Lanza BadRequestException si el premio existe pero no está activo.
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
   * Generar QR en formato Data URL (base64) para un código de reclamo.
   */
  async generateClaimQrCode(claimCode: string): Promise<string> {
    return QRCode.toDataURL(claimCode, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  }

  /**
   * Crear un claim de premio para un ganador.
   */
  async createPrizeClaim(
    playId: string,
    userId: string,
    barId: string,
    prizeId: string,
  ): Promise<PrizeClaim> {
    // Generar código de reclamo único
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let claimCode = 'P-';
    for (let i = 0; i < 8; i++) {
      claimCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Expiración: 7 días
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

  // ==================== CONSULTAS ====================

  /**
   * Obtener símbolos de un bar formateados para el frontend.
   * Incluye globales + específicos del bar, solo activos.
   */
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

  /**
   * Obtener historial de jugadas de un usuario.
   */
  async getUserPlayHistory(
    userId: string,
    barId?: string,
    limit: number = 50,
  ): Promise<Play[]> {
    const where: any = { userId };
    if (barId) {
      where.barId = barId;
    }

    return this.playModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });
  }
}
