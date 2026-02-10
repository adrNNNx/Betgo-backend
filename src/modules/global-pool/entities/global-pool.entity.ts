// src/modules/global-pool/entities/global-pool.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { PoolMovement } from '../../pool-movements/entities/pool-movement.entity';

interface GlobalPoolCreationAttributes {
  id?: number;

  currentAmount?: number;
  costPerPlay?: number;
  minAmount?: number;

  lastWinnerId?: string;
  lastWinnerAmount?: number;
  lastWinnerAt?: Date;

  totalCollected?: number;
  totalPaid?: number;
}

@Table({
  tableName: 'global_pool',
  timestamps: false,
  underscored: true,
})
export class GlobalPool extends Model<
  GlobalPool,
  GlobalPoolCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    defaultValue: 1,
  })
  declare id: number;

  // ==================== CAMPOS ====================

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.0,
    field: 'current_amount',
    get() {
      const value = this.getDataValue('currentAmount');
      return value ? parseFloat(value) : 0;
    },
  })
  declare currentAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1000.0,
    field: 'cost_per_play',
    get() {
      const value = this.getDataValue('costPerPlay');
      return value ? parseFloat(value) : 1000;
    },
  })
  declare costPerPlay: number;

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 100000.0,
    field: 'min_amount',
    get() {
      const value = this.getDataValue('minAmount');
      return value ? parseFloat(value) : 100000;
    },
  })
  declare minAmount: number;

  // ==================== ÚLTIMO GANADOR ====================

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'last_winner_id',
  })
  declare lastWinnerId: string | null;

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: true,
    field: 'last_winner_amount',
    get() {
      const value = this.getDataValue('lastWinnerAmount');
      return value ? parseFloat(value) : null;
    },
  })
  declare lastWinnerAmount: number | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_winner_at',
  })
  declare lastWinnerAt: Date | null;

  // ==================== ESTADÍSTICAS ====================

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.0,
    field: 'total_collected',
    get() {
      const value = this.getDataValue('totalCollected');
      return value ? parseFloat(value) : 0;
    },
  })
  declare totalCollected: number;

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.0,
    field: 'total_paid',
    get() {
      const value = this.getDataValue('totalPaid');
      return value ? parseFloat(value) : 0;
    },
  })
  declare totalPaid: number;

  // ==================== UPDATED AT ====================

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => User, 'lastWinnerId')
  declare lastWinner: User;

  @HasMany(() => PoolMovement)
  declare movements: PoolMovement[];

  // ==================== MÉTODOS ESTÁTICOS ====================

  static async getInstance(): Promise<GlobalPool> {
    let pool = await GlobalPool.findByPk(1);

    if (!pool) {
      pool = await GlobalPool.create({ id: 1 });
    }

    return pool;
  }

  // ==================== MÉTODOS ====================

  addContribution(amount: number): void {
    this.currentAmount = Number(this.currentAmount) + amount;
    this.totalCollected = Number(this.totalCollected) + amount;
  }

  payJackpot(winnerId: string): number {
    const amount = this.currentAmount;

    this.lastWinnerId = winnerId;
    this.lastWinnerAmount = amount;
    this.lastWinnerAt = new Date();

    this.totalPaid = Number(this.totalPaid) + amount;

    this.currentAmount = this.minAmount;

    return amount;
  }
}
