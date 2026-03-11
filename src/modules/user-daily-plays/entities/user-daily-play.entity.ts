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
  userId: string;
  playDate: string;
  playsUsed?: number;
  playsLimit?: number;
}

@Table({
  tableName: 'user_daily_plays',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['bar_id', 'play_date', 'user_id'],
      name: 'unique_user_bar_daily_play',
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

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'user_id',
  })
  declare userId: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'play_date',
  })
  declare playDate: Date;

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

  // ==================== MÉTODOS DE INSTANCIA ====================

  hasPlaysRemaining(): boolean {
    return this.playsUsed < this.playsLimit;
  }

  getRemainingPlays(): number {
    return Math.max(0, this.playsLimit - this.playsUsed);
  }
}
