// src/modules/recharge-codes/entities/recharge-code.entity.ts
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
import { randomInt } from 'crypto';
import { User } from '../../users/entities/user.entity';
import { Staff } from '../../staff/entities/staff.entity';

export enum CodeStatus {
  PENDING = 'pending',
  USED = 'used',
  EXPIRED = 'expired',
}

interface RechargeCodeCreationAttributes {
  userId: string;
  expiresAt: Date;

  code?: string;
  qrData?: string;
  status?: CodeStatus;

  usedAt?: Date;
  usedByStaffId?: string;

  amountRequested?: number;
  amountLoaded?: number;
}

@Table({
  tableName: 'recharge_codes',
  timestamps: false,
  underscored: true,
})
export class RechargeCode extends Model<
  RechargeCode,
  RechargeCodeCreationAttributes
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

  @ForeignKey(() => Staff)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'used_by_staff_id',
  })
  declare usedByStaffId: string | null;

  // ==================== CAMPOS ====================

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true,
  })
  declare code: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'qr_data',
  })
  declare qrData: string;

  @Column({
    type: DataType.ENUM(...Object.values(CodeStatus)),
    allowNull: false,
    defaultValue: CodeStatus.PENDING,
  })
  declare status: CodeStatus;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'expires_at',
  })
  declare expiresAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'used_at',
  })
  declare usedAt: Date | null;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    field: 'amount_requested',
    get() {
      const value = this.getDataValue('amountRequested');
      return value ? parseFloat(value) : null;
    },
  })
  declare amountRequested: number | null;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    field: 'amount_loaded',
    get() {
      const value = this.getDataValue('amountLoaded');
      return value ? parseFloat(value) : null;
    },
  })
  declare amountLoaded: number | null;

  // ==================== TIMESTAMP ====================

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => User)
  declare user: User;

  @BelongsTo(() => Staff, 'usedByStaffId')
  declare usedByStaff: Staff;

  // ==================== HOOKS ====================

  @BeforeCreate
  static generateCode(instance: RechargeCode) {
    if (!instance.getDataValue('code')) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(randomInt(0, chars.length));
      }
      instance.setDataValue('code', code);
    }

    if (!instance.getDataValue('qrData')) {
      instance.setDataValue(
        'qrData',
        JSON.stringify({
          code: instance.getDataValue('code'),
          userId: instance.getDataValue('userId'),
          type: 'recharge',
        }),
      );
    }
  }

  // ==================== MÉTODOS ====================

  isPending(): boolean {
    return this.status === CodeStatus.PENDING;
  }

  isExpired(): boolean {
    return this.status === CodeStatus.EXPIRED || new Date() > this.expiresAt;
  }

  isUsed(): boolean {
    return this.status === CodeStatus.USED;
  }

  isValid(): boolean {
    return this.isPending() && !this.isExpired();
  }

  markAsUsed(staffId: string, amountLoaded: number): void {
    this.status = CodeStatus.USED;
    this.usedAt = new Date();
    this.usedByStaffId = staffId;
    this.amountLoaded = amountLoaded;
  }

  markAsExpired(): void {
    this.status = CodeStatus.EXPIRED;
  }
}
