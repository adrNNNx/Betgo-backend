// src/modules/staff/entities/staff.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Bar } from '../../bars/entities/bar.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { RechargeCode } from '../../recharge-codes/entities/recharge-code.entity';
import { PrizeClaim } from '../../prize-claims/entities/prize-claim.entity';

export enum StaffRole {
  MOZO = 'mozo',
  ENCARGADO = 'encargado',
  ADMIN_BAR = 'admin_bar',
  SUPER_ADMIN = 'super_admin',
}

interface StaffCreationAttributes {
  userId: string;
  role: StaffRole;

  barId?: string | null;
  isActive?: boolean;
}

@Table({
  tableName: 'staff',
  timestamps: true,
  underscored: true,
})
export class Staff extends Model<Staff, StaffCreationAttributes> {
  // ==================== CAMPOS ====================

  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

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
    allowNull: true, // NULL para super_admin
    field: 'bar_id',
  })
  declare barId: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(StaffRole)),
    allowNull: false,
  })
  declare role: StaffRole;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => User)
  declare user: User;

  @BelongsTo(() => Bar)
  declare bar: Bar;

  @HasMany(() => Transaction)
  declare transactions: Transaction[];

  @HasMany(() => RechargeCode, 'usedByStaffId')
  declare processedRechargeCodes: RechargeCode[];

  @HasMany(() => PrizeClaim, 'deliveredById')
  declare deliveredPrizes: PrizeClaim[];

  // ==================== MÉTODOS ====================

  isSuperAdmin(): boolean {
    return this.role === StaffRole.SUPER_ADMIN;
  }

  isBarAdmin(): boolean {
    return this.role === StaffRole.ADMIN_BAR || this.isSuperAdmin();
  }

  hasBarAssigned(): boolean {
    return this.barId !== null;
  }

  canManageBar(barId: string): boolean {
    return this.isSuperAdmin() || this.barId === barId;
  }
}
