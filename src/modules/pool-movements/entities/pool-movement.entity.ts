// src/modules/pool-movements/entities/pool-movement.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Bar } from '../../bars/entities/bar.entity';
import { Play } from '../../plays/entities/play.entity';

export enum PoolMovementType {
  CONTRIBUTION = 'contribution',
  JACKPOT_WIN = 'jackpot_win',
  ADJUSTMENT = 'adjustment',
}

interface PoolMovementCreationAttributes {
  type: PoolMovementType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;

  userId?: string;
  barId?: string;
  playId?: string;

  notes?: string;
  createdById?: string;
}

@Table({
  tableName: 'pool_movements',
  timestamps: false,
  underscored: true,
})
export class PoolMovement extends Model<
  PoolMovement,
  PoolMovementCreationAttributes
> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  // ==================== CAMPOS PRINCIPALES ====================

  @Column({
    type: DataType.ENUM(...Object.values(PoolMovementType)),
    allowNull: false,
  })
  declare type: PoolMovementType;

  @Column({
    type: DataType.DECIMAL(12, 2),
    allowNull: false,
    get() {
      const value = this.getDataValue('amount');
      return value ? parseFloat(value) : 0;
    },
  })
  declare amount: number;

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: false,
    field: 'balance_before',
    get() {
      const value = this.getDataValue('balanceBefore');
      return value ? parseFloat(value) : 0;
    },
  })
  declare balanceBefore: number;

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: false,
    field: 'balance_after',
    get() {
      const value = this.getDataValue('balanceAfter');
      return value ? parseFloat(value) : 0;
    },
  })
  declare balanceAfter: number;

  // ==================== FOREIGN KEYS ====================

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'user_id',
  })
  declare userId: string | null;

  @ForeignKey(() => Bar)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'bar_id',
  })
  declare barId: string | null;

  @ForeignKey(() => Play)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'play_id',
  })
  declare playId: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes: string | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'created_by_id',
  })
  declare createdById: string | null;

  // ==================== TIMESTAMP ====================

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => User, 'userId')
  declare user: User;

  @BelongsTo(() => Bar)
  declare bar: Bar;

  @BelongsTo(() => Play)
  declare play: Play;

  @BelongsTo(() => User, 'createdById')
  declare createdBy: User;

  // ==================== MÉTODOS ====================

  isContribution(): boolean {
    return this.type === PoolMovementType.CONTRIBUTION;
  }

  isJackpotWin(): boolean {
    return this.type === PoolMovementType.JACKPOT_WIN;
  }

  isAdjustment(): boolean {
    return this.type === PoolMovementType.ADJUSTMENT;
  }
}
