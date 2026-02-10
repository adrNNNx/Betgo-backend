// src/modules/user-daily-plays/entities/user-daily-play.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Bar } from '../../bars/entities/bar.entity';

interface UserDailyPlayCreationAttributes {
  barId: string;
  playDate: Date;

  deviceFingerprint?: string;
  ipAddress?: string;
  userId?: string;
  playsUsed?: number;
  playsLimit?: number;
}

@Table({
  tableName: 'user_daily_plays',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      // Para usuarios registrados
      unique: true,
      fields: ['bar_id', 'play_date', 'user_id'],
      name: 'unique_user_daily_play',
      where: {
        user_id: { [Symbol.for('ne')]: null },
      },
    },
    {
      // Para usuarios anónimos
      unique: true,
      fields: ['bar_id', 'play_date', 'device_fingerprint'],
      name: 'unique_device_daily_play',
      where: {
        device_fingerprint: { [Symbol.for('ne')]: null },
      },
    },
  ],
})
export class UserDailyPlay extends Model<
  UserDailyPlay,
  UserDailyPlayCreationAttributes
> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => Bar)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'bar_id',
  })
  declare barId: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'play_date',
  })
  declare playDate: Date;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'device_fingerprint',
  })
  declare deviceFingerprint: string;

  @Column({
    type: DataType.INET,
    allowNull: true,
    field: 'ip_address',
  })
  declare ipAddress: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'user_id',
  })
  declare userId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'plays_used',
  })
  declare playsUsed: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 3,
    field: 'plays_limit',
  })
  declare playsLimit: number;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => Bar)
  declare bar: Bar;

  @BelongsTo(() => User)
  declare user: User;

  // ==================== MÉTODOS ====================

  hasPlaysRemaining(): boolean {
    return this.playsUsed < this.playsLimit;
  }

  getRemainingPlays(): number {
    return Math.max(0, this.playsLimit - this.playsUsed);
  }

  incrementPlaysUsed(): void {
    this.playsUsed += 1;
  }

  static async findOrCreateDailyPlay(
    barId: string,
    userId?: string,
    deviceFingerprint?: string,
  ): Promise<UserDailyPlay> {
    const today = new Date().toISOString().split('T')[0];

    const where: any = {
      barId,
      playDate: today,
    };

    // Buscar por usuario registrado o dispositivo anónimo
    if (userId) {
      where.userId = userId;
    } else if (deviceFingerprint) {
      where.deviceFingerprint = deviceFingerprint;
    }

    const [dailyPlay] = await UserDailyPlay.findOrCreate({
      where,
      defaults: {
        barId,
        playDate: new Date(today),
        userId,
        deviceFingerprint,
        playsUsed: 0,
        playsLimit: 3,
      },
    });

    return dailyPlay;
  }
}
