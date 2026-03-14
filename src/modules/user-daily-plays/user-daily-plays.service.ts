// src/modules/user-daily-plays/user-daily-plays.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserDailyPlay } from './entities/user-daily-play.entity';
import { Bar } from '../bars/entities/bar.entity';
import { getTodayInParaguay } from 'src/common/utils/timezone.util';

export interface DailyPlayStatus {
  playsUsed: number;
  playsLimit: number;
  playsRemaining: number;
  hasPlaysRemaining: boolean;
  playDate: string;
}

export interface UserDailySummary {
  bars: Array<{
    barId: string;
    barName: string;
    barSlug: string;
    playsUsed: number;
    playsRemaining: number;
    playsLimit: number;
  }>;
  totalPlaysToday: number;
}

@Injectable()
export class UserDailyPlaysService {
  private readonly logger = new Logger(UserDailyPlaysService.name);

  constructor(
    @InjectModel(UserDailyPlay)
    private readonly userDailyPlayModel: typeof UserDailyPlay,
  ) {}

  /**
   * Obtener o crear el registro de jugadas diarias para un usuario en un bar.
   * Si ya existe un registro para hoy, lo retorna; si no, crea uno nuevo
   * con el límite configurado del bar.
   */
  async getOrCreateDailyRecord(
    barId: string,
    userId: string,
    playsLimit: number,
  ): Promise<UserDailyPlay> {
    try {
      const today = getTodayInParaguay();

      const [dailyPlay, created] = await this.userDailyPlayModel.findOrCreate({
        where: {
          barId,
          userId,
          playDate: today,
        },
        defaults: {
          barId,
          userId,
          playDate: today,
          playsUsed: 0,
          playsLimit,
        },
      });

      if (created) {
        this.logger.debug(
          `Registro diario creado - Bar: ${barId}, User: ${userId}, Límite: ${playsLimit}`,
        );
      }

      return dailyPlay;
    } catch (error) {
      this.logger.error(
        `Error en getOrCreateDailyRecord: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener el registro de jugadas diarias.',
      );
    }
  }

  /**
   * Obtener el estado actual de jugadas diarias de un usuario en un bar.
   */
  async getDailyPlayStatus(
    barId: string,
    userId: string,
    playsLimit: number,
  ): Promise<DailyPlayStatus> {
    const dailyPlay = await this.getOrCreateDailyRecord(
      barId,
      userId,
      playsLimit,
    );

    return {
      playsUsed: dailyPlay.playsUsed,
      playsLimit: dailyPlay.playsLimit,
      playsRemaining: this.calculateRemaining(dailyPlay),
      hasPlaysRemaining: dailyPlay.playsUsed < dailyPlay.playsLimit,
      playDate: getTodayInParaguay(),
    };
  }

  /**
   * Verificar disponibilidad y consumir una jugada gratuita.
   * Lanza BadRequestException si no tiene jugadas disponibles.
   * Retorna el registro actualizado.
   */
  async verifyAndConsumeFreePlay(
    barId: string,
    userId: string,
    playsLimit: number,
    barName: string,
  ): Promise<UserDailyPlay> {
    const dailyPlay = await this.getOrCreateDailyRecord(
      barId,
      userId,
      playsLimit,
    );

    if (dailyPlay.playsUsed >= dailyPlay.playsLimit) {
      throw new BadRequestException(
        `Has agotado tus ${dailyPlay.playsLimit} jugadas gratis del día en ${barName}. ` +
          `¡Recarga saldo para jugar por el pozo global!`,
      );
    }

    // Incrementar el contador de forma atómica usando update directo
    await this.userDailyPlayModel.update(
      { playsUsed: dailyPlay.playsUsed + 1 },
      { where: { id: dailyPlay.id } },
    );

    // Recargar para tener el valor actualizado
    await dailyPlay.reload();

    this.logger.debug(
      `Jugada consumida - Bar: ${barId}, User: ${userId}, ` +
        `Usadas: ${dailyPlay.playsUsed}/${dailyPlay.playsLimit}`,
    );

    return dailyPlay;
  }

  /**
   * Obtener resumen de jugadas del día del usuario en todos los bares.
   */
  async getUserDailySummary(userId: string): Promise<UserDailySummary> {
    const today = getTodayInParaguay();

    const dailyPlays = await this.userDailyPlayModel.findAll({
      where: {
        userId,
        playDate: today,
      },
      include: [
        {
          model: Bar,
          attributes: ['id', 'name', 'slug', 'logoUrl'],
        },
      ],
    });

    const bars = dailyPlays.map((dp) => ({
      barId: dp.barId,
      barName: dp.bar?.name || '',
      barSlug: dp.bar?.slug || '',
      playsUsed: dp.playsUsed,
      playsRemaining: this.calculateRemaining(dp),
      playsLimit: dp.playsLimit,
    }));

    const totalPlaysToday = dailyPlays.reduce(
      (sum, dp) => sum + dp.playsUsed,
      0,
    );

    return { bars, totalPlaysToday };
  }

  /**
   * Obtener historial de jugadas diarias de un usuario en un bar.
   */
  async getUserBarHistory(
    userId: string,
    barId: string,
    limit: number = 30,
  ): Promise<UserDailyPlay[]> {
    return this.userDailyPlayModel.findAll({
      where: { userId, barId },
      order: [['playDate', 'DESC']],
      limit,
    });
  }

  // ==================== PRIVADOS ====================

  private calculateRemaining(dailyPlay: UserDailyPlay): number {
    return Math.max(0, dailyPlay.playsLimit - dailyPlay.playsUsed);
  }
}
