// src/modules/plays/entities/play.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasOne,
  CreatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Bar } from '../../bars/entities/bar.entity';
import { TableEntity } from '../../tables/entities/table.entity';
import { Prize } from '../../prizes/entities/prize.entity';
import { PrizeClaim } from '../../prize-claims/entities/prize-claim.entity';
import { PoolMovement } from '../../pool-movements/entities/pool-movement.entity';

export enum PlayType {
  FREE = 'free',
  PAID = 'paid',
  POOL = 'pool',
}

export interface PlayResult {
  symbols: string[];
  matchCount: number;
  isWinner: boolean;
}

interface PlayCreationAttributes {
  barId: string;
  type: PlayType;
  result: PlayResult;
  isWinner: boolean;
  userId?: string;
  tableId?: string;
  prizeId?: string;
  amountPaid?: number;
  poolContribution?: number;
  deviceFingerprint?: string;
  ipAddress?: string;
}

@Table({
  tableName: 'plays',
  timestamps: false, // Solo tiene created_at
  underscored: true,
})
export class Play extends Model<Play, PlayCreationAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true, // NULL para jugadores anónimos
    field: 'user_id',
  })
  declare userId: string;

  @ForeignKey(() => Bar)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'bar_id',
  })
  declare barId: string;

  @ForeignKey(() => TableEntity)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'table_id',
  })
  declare tableId: string;

  @Column({
    type: DataType.ENUM(...Object.values(PlayType)),
    allowNull: false,
  })
  declare type: PlayType;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  declare result: PlayResult;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_winner',
  })
  declare isWinner: boolean;

  @ForeignKey(() => Prize)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'prize_id',
  })
  declare prizeId: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    field: 'amount_paid',
    get() {
      const value = this.getDataValue('amountPaid');
      return value ? parseFloat(value) : null;
    },
  })
  declare amountPaid: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    field: 'pool_contribution',
    get() {
      const value = this.getDataValue('poolContribution');
      return value ? parseFloat(value) : null;
    },
  })
  declare poolContribution: number;

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

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => User)
  declare user: User;

  @BelongsTo(() => Bar)
  declare bar: Bar;

  @BelongsTo(() => TableEntity)
  declare table: TableEntity;

  @BelongsTo(() => Prize)
  declare prize: Prize;

  @HasOne(() => PrizeClaim)
  declare prizeClaim: PrizeClaim;

  @HasOne(() => PoolMovement)
  declare poolMovement: PoolMovement;

  // ==================== MÉTODOS ====================

  isFreePlay(): boolean {
    return this.type === PlayType.FREE;
  }

  isPaidPlay(): boolean {
    return this.type === PlayType.PAID;
  }

  isPoolPlay(): boolean {
    return this.type === PlayType.POOL;
  }

  getSymbols(): string[] {
    return this.result?.symbols || [];
  }
}
