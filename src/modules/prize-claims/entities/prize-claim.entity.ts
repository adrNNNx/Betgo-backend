// src/modules/prize-claims/entities/prize-claim.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  BeforeCreate,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Bar } from '../../bars/entities/bar.entity';
import { Prize } from '../../prizes/entities/prize.entity';
import { Play } from '../../plays/entities/play.entity';
import { Staff } from '../../staff/entities/staff.entity';

export enum ClaimStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  EXPIRED = 'expired',
}

interface PrizeClaimCreationAttributes {
  userId: string;
  prizeId: string;
  playId: string;
  expiresAt: Date;

  barId?: string;
  claimCode?: string;
  status?: ClaimStatus;

  deliveredById?: string;
  deliveredAt?: Date;
  notes?: string;
}

@Table({
  tableName: 'prize_claims',
  timestamps: false,
  underscored: true,
})
export class PrizeClaim extends Model<
  PrizeClaim,
  PrizeClaimCreationAttributes
> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  // ==================== FOREIGN KEYS ====================

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'user_id',
  })
  declare userId: string;

  @ForeignKey(() => Bar)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'bar_id',
  })
  declare barId: string | null;

  @ForeignKey(() => Prize)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'prize_id',
  })
  declare prizeId: string;

  @ForeignKey(() => Play)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'play_id',
  })
  declare playId: string;

  // ==================== CAMPOS ====================

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true,
    field: 'claim_code',
  })
  declare claimCode: string;

  @Column({
    type: DataType.ENUM(...Object.values(ClaimStatus)),
    allowNull: false,
    defaultValue: ClaimStatus.PENDING,
  })
  declare status: ClaimStatus;

  @ForeignKey(() => Staff)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'delivered_by_id',
  })
  declare deliveredById: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'delivered_at',
  })
  declare deliveredAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'expires_at',
  })
  declare expiresAt: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes: string | null;

  // ==================== TIMESTAMP ====================

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => User)
  declare user: User;

  @BelongsTo(() => Bar)
  declare bar: Bar;

  @BelongsTo(() => Prize)
  declare prize: Prize;

  @BelongsTo(() => Play)
  declare play: Play;

  @BelongsTo(() => Staff, 'deliveredById')
  declare deliveredBy: Staff;

  // ==================== HOOKS ====================

  @BeforeCreate
  static generateClaimCode(instance: PrizeClaim) {
    if (!instance.claimCode) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'P-';

      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      instance.claimCode = code;
    }
  }

  // ==================== MÉTODOS ====================

  isPending(): boolean {
    return this.status === ClaimStatus.PENDING;
  }

  isDelivered(): boolean {
    return this.status === ClaimStatus.DELIVERED;
  }

  isExpired(): boolean {
    return this.status === ClaimStatus.EXPIRED || new Date() > this.expiresAt;
  }

  canBeDelivered(): boolean {
    return this.isPending() && !this.isExpired();
  }

  markAsDelivered(staffId: string, notes?: string): void {
    this.status = ClaimStatus.DELIVERED;
    this.deliveredById = staffId;
    this.deliveredAt = new Date();

    if (notes) {
      this.notes = notes;
    }
  }

  markAsExpired(): void {
    this.status = ClaimStatus.EXPIRED;
  }
}
