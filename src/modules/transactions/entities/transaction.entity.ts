// src/modules/transactions/entities/transaction.entity.ts
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
import { Staff } from '../../staff/entities/staff.entity';

export enum TransactionType {
  RECHARGE = 'recharge',
  PLAY_FREE = 'play_free',
  PLAY_PAID = 'play_paid',
  PLAY_POOL = 'play_pool',
  PRIZE_LOCAL = 'prize_local',
  PRIZE_JACKPOT = 'prize_jackpot',
  BAR_RECHARGE = 'bar_recharge',
  PLATFORM_REVENUE = 'platform_revenue',
  ADJUSTMENT = 'adjustment',
  /** Asignación de saldo del bar a un mozo. */
  STAFF_ALLOCATION = 'staff_allocation',
  /** Devolución de saldo del mozo al bar. */
  STAFF_RETURN = 'staff_return',
}

// ISO 4217. Hoy solo guaraní; agregar valores aquí no requiere migración
// porque la columna es STRING(3), no un enum de Postgres.
export enum Currency {
  PYG = 'PYG',
}

export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  QR = 'qr',
  CARD = 'card',
  OTHER = 'other',
}

interface TransactionCreationAttributes {
  type: TransactionType;
  amount: number;
  userId?: string;
  barId?: string;
  staffId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  paymentMethod?: PaymentMethod;
  currency?: Currency;
  reference?: string;
  notes?: string;
}

@Table({
  tableName: 'transactions',
  timestamps: false, // Solo tiene created_at
  underscored: true,
})
export class Transaction extends Model<
  Transaction,
  TransactionCreationAttributes
> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'user_id',
  })
  declare userId: string;

  @ForeignKey(() => Bar)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'bar_id',
  })
  declare barId: string;

  @ForeignKey(() => Staff)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'staff_id',
  })
  declare staffId: string;

  @Column({
    type: DataType.ENUM(...Object.values(TransactionType)),
    allowNull: false,
  })
  declare type: TransactionType;

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
    type: DataType.DECIMAL(12, 2),
    allowNull: true,
    field: 'balance_before',
    get() {
      const value = this.getDataValue('balanceBefore');
      return value ? parseFloat(value) : null;
    },
  })
  declare balanceBefore: number;

  @Column({
    type: DataType.DECIMAL(12, 2),
    allowNull: true,
    field: 'balance_after',
    get() {
      const value = this.getDataValue('balanceAfter');
      return value ? parseFloat(value) : null;
    },
  })
  declare balanceAfter: number;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: true,
    field: 'payment_method',
  })
  declare paymentMethod: PaymentMethod;

  @Column({
    type: DataType.STRING(3),
    allowNull: false,
    defaultValue: Currency.PYG,
  })
  declare currency: Currency;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare reference: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes: string;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => User)
  declare user: User;

  @BelongsTo(() => Bar)
  declare bar: Bar;

  @BelongsTo(() => Staff)
  declare staff: Staff;

  // ==================== MÉTODOS ====================

  isRecharge(): boolean {
    return (
      this.type === TransactionType.RECHARGE ||
      this.type === TransactionType.BAR_RECHARGE
    );
  }

  isPlay(): boolean {
    return [
      TransactionType.PLAY_FREE,
      TransactionType.PLAY_PAID,
      TransactionType.PLAY_POOL,
    ].includes(this.type);
  }

  isPrize(): boolean {
    return (
      this.type === TransactionType.PRIZE_LOCAL ||
      this.type === TransactionType.PRIZE_JACKPOT
    );
  }
}
