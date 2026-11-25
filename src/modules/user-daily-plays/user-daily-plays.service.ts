// src/modules/user-daily-plays/user-daily-plays.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, col, literal } from 'sequelize';
import type { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { UserDailyPlay } from './entities/user-daily-play.entity';
import { Bar } from '../bars/entities/bar.entity';
import { User } from '../users/entities/user.entity';
import {
  AuditLog,
  AuditAction,
  AuditEntity,
} from '../audit-logs/entities/audit-log.entity';
import { getTodayInParaguay } from '../../common/utils/timezone.util';

/** Estado de hoy de un jugador en un bar, tal como lo ve el panel admin. */
export interface AdminBarPlays {
  barId: string;
  barName: string;
  barSlug: string;
  playsUsed: number;
  playsLimit: number;
  playsRemaining: number;
}

export interface AdminUserTodayPlays {
  user: { id: string; name: string | null; phone: string };
  playDate: string;
  bars: AdminBarPlays[];
  totalPlaysUsed: number;
}

export interface ResetFreePlaysResult {
  userId: string;
  playDate: string;
  scope: 'bar' | 'all';
  barId: string | null;
  /** Registros que efectivamente tenían jugadas usadas y se pusieron en 0. */
  resetCount: number;
  /** Jugadas devueltas en total (suma de playsUsed antes del reset). */
  playsRestored: number;
  /** Estado de hoy después del reset, en el mismo formato que el GET. */
  bars: AdminBarPlays[];
}

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
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Bar)
    private readonly barModel: typeof Bar,
    @InjectModel(AuditLog)
    private readonly auditLogModel: typeof AuditLog,
    private readonly sequelize: Sequelize,
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

    // Incremento condicional en la base: `plays_used + 1` sólo si todavía queda
    // cupo. Antes se escribía "lo leído + 1", que perdía actualizaciones: dos
    // giros simultáneos pasaban el chequeo, y un reset del admin hecho a mitad
    // de un giro quedaba pisado por el valor viejo.
    // `update` y no `Model.increment`: en Sequelize v6 + Postgres, increment no
    // devuelve la cantidad de filas afectadas, y sin ese dato no se sabe si el
    // condicional se cumplió.
    const [affected] = await this.userDailyPlayModel.update(
      { playsUsed: literal('plays_used + 1') as unknown as number },
      {
        where: {
          id: dailyPlay.id,
          playsUsed: { [Op.lt]: col('plays_limit') },
        },
      },
    );

    if (!affected) {
      await dailyPlay.reload();
      throw new BadRequestException(
        `Has agotado tus ${dailyPlay.playsLimit} jugadas gratis del día en ${barName}. ` +
          `¡Recarga saldo para jugar por el pozo global!`,
      );
    }

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

  /**
   * Propaga un nuevo límite de jugadas gratis a TODOS los registros de HOY
   * del bar. Necesario porque playsLimit es un snapshot diario: sin esto, los
   * usuarios que ya iniciaron sesión seguirían con el límite viejo.
   * Subir el límite reabre jugadas; bajarlo deja el restante en 0 (sin negativos).
   * Retorna cuántos registros se ajustaron.
   */
  async syncTodayLimitForBar(
    barId: string,
    newLimit: number,
    transaction?: Transaction,
  ): Promise<number> {
    const today = getTodayInParaguay();
    const [affected] = await this.userDailyPlayModel.update(
      { playsLimit: newLimit },
      { where: { barId, playDate: today }, transaction },
    );
    return affected;
  }

  // ==================== ADMIN: CONSULTA Y RESET ====================

  /**
   * Jugadas gratis de HOY de un jugador, por bar. Es lo que el admin mira antes
   * de resetear. Sólo aparecen los bares donde el jugador ya jugó hoy: en el
   * resto no hay registro y tiene su cupo completo.
   */
  async getTodayForUser(userId: string): Promise<AdminUserTodayPlays> {
    const user = await this.findUserOrFail(userId);
    const playDate = getTodayInParaguay();
    const bars = await this.loadTodayBars(userId, playDate);

    return {
      user: { id: user.id, name: user.name, phone: user.phone },
      playDate,
      bars,
      totalPlaysUsed: bars.reduce((sum, b) => sum + b.playsUsed, 0),
    };
  }

  /**
   * Devuelve las jugadas gratis de HOY a un jugador: `playsUsed = 0` en un bar
   * o en todos. El historial de días anteriores no se toca.
   *
   * Queda auditado en audit_logs (quién, a quién, cuánto tenía usado y por
   * qué): un giro gratis puede ganar un premio físico, así que regalar giros
   * tiene valor real. Reset + auditoría van en la misma transacción.
   *
   * Es idempotente: si no había nada usado, responde resetCount 0 y no escribe.
   */
  async resetFreePlays(params: {
    userId: string;
    barId?: string;
    adminUserId: string;
    reason?: string;
    ipAddress?: string;
  }): Promise<ResetFreePlaysResult> {
    const { userId, barId, adminUserId, reason, ipAddress } = params;

    await this.findUserOrFail(userId);
    if (barId) {
      const bar = await this.barModel.findByPk(barId, { attributes: ['id'] });
      if (!bar) throw new NotFoundException('Bar no encontrado.');
    }

    const playDate = getTodayInParaguay();

    const { resetCount, playsRestored } = await this.sequelize.transaction(
      async (transaction) => {
        // Bloquea los registros a resetear: un giro que esté consumiendo la
        // misma fila espera a que el reset termine.
        const records = await this.userDailyPlayModel.findAll({
          where: {
            userId,
            playDate,
            playsUsed: { [Op.gt]: 0 },
            ...(barId ? { barId } : {}),
          },
          transaction,
          lock: true,
        });

        if (records.length === 0) {
          return { resetCount: 0, playsRestored: 0 };
        }

        await this.userDailyPlayModel.update(
          { playsUsed: 0 },
          {
            where: { id: { [Op.in]: records.map((r) => r.id) } },
            transaction,
          },
        );

        const restored = records.reduce((sum, r) => sum + r.playsUsed, 0);

        await this.auditLogModel.create(
          {
            userId: adminUserId,
            action: AuditAction.FREE_PLAYS_RESET,
            entity: AuditEntity.USER_DAILY_PLAY,
            entityId: userId,
            oldValues: {
              playDate,
              bars: records.map((r) => ({
                barId: r.barId,
                playsUsed: r.playsUsed,
                playsLimit: r.playsLimit,
              })),
            },
            newValues: {
              playDate,
              scope: barId ? 'bar' : 'all',
              barId: barId ?? null,
              playsUsed: 0,
              playsRestored: restored,
              reason: reason ?? null,
            },
            ipAddress,
          },
          { transaction },
        );

        return { resetCount: records.length, playsRestored: restored };
      },
    );

    if (resetCount > 0) {
      this.logger.log(
        `🔄 Jugadas gratis reseteadas — Usuario: ${userId}, ` +
          `${barId ? `Bar: ${barId}` : 'todos los bares'}, ` +
          `Devueltas: ${playsRestored}, Admin: ${adminUserId}`,
      );
    }

    return {
      userId,
      playDate,
      scope: barId ? 'bar' : 'all',
      barId: barId ?? null,
      resetCount,
      playsRestored,
      bars: await this.loadTodayBars(userId, playDate),
    };
  }

  // ==================== PRIVADOS ====================

  private calculateRemaining(dailyPlay: UserDailyPlay): number {
    return Math.max(0, dailyPlay.playsLimit - dailyPlay.playsUsed);
  }

  private async findUserOrFail(userId: string): Promise<User> {
    const user = await this.userModel.findByPk(userId, {
      attributes: ['id', 'name', 'phone'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  private async loadTodayBars(
    userId: string,
    playDate: string,
  ): Promise<AdminBarPlays[]> {
    const records = await this.userDailyPlayModel.findAll({
      where: { userId, playDate },
      include: [{ model: Bar, attributes: ['id', 'name', 'slug'] }],
      order: [[{ model: Bar, as: 'bar' }, 'name', 'ASC']],
    });

    return records.map((r) => ({
      barId: r.barId,
      barName: r.bar?.name ?? '',
      barSlug: r.bar?.slug ?? '',
      playsUsed: r.playsUsed,
      playsLimit: r.playsLimit,
      playsRemaining: this.calculateRemaining(r),
    }));
  }
}
