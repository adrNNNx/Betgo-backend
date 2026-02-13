// src/modules/users/entities/user.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  HasOne,
  HasMany,
  CreatedAt,
  UpdatedAt,
  BeforeCreate,
} from 'sequelize-typescript';
import * as bcrypt from 'bcrypt';
import { Staff } from '../../staff/entities/staff.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Play } from '../../plays/entities/play.entity';
import { UserDailyPlay } from '../../user-daily-plays/entities/user-daily-play.entity';
import { RechargeCode } from '../../recharge-codes/entities/recharge-code.entity';
import { PrizeClaim } from '../../prize-claims/entities/prize-claim.entity';
import { PoolMovement } from '../../pool-movements/entities/pool-movement.entity';
import { AuditLog } from '../../audit-logs/entities/audit-log.entity';

export enum UserRole {
  PLAYER = 'player',
  STAFF = 'staff',
  ADMIN = 'admin',
}

interface UserCreationAttributes {
  phone: string;
  passwordHash: string;
  email?: string | null;
  name?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

@Table({
  tableName: 'users',
  timestamps: true,
  underscored: true,
})
export class User extends Model<User, UserCreationAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true,
  })
  declare phone: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    unique: true,
  })
  declare email: string | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    field: 'password_hash',
  })
  declare passwordHash: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare name: string | null;

  @Column({
    type: DataType.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.0,
    get() {
      const value = this.getDataValue('balance');
      return value ? parseFloat(value) : 0;
    },
  })
  declare balance: number;

  @Column({
    type: DataType.ENUM(...Object.values(UserRole)),
    allowNull: false,
    defaultValue: UserRole.PLAYER,
  })
  declare role: UserRole;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_login_at',
  })
  declare lastLoginAt: Date | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // ==================== RELACIONES ====================

  @HasOne(() => Staff)
  declare staffProfile: Staff;

  @HasMany(() => Transaction)
  declare transactions: Transaction[];

  @HasMany(() => Play)
  declare plays: Play[];

  @HasMany(() => UserDailyPlay)
  declare dailyPlays: UserDailyPlay[];

  @HasMany(() => RechargeCode)
  declare rechargeCodes: RechargeCode[];

  @HasMany(() => PrizeClaim)
  declare prizeClaims: PrizeClaim[];

  @HasMany(() => PoolMovement, 'userId')
  declare poolMovements: PoolMovement[];

  @HasMany(() => AuditLog)
  declare auditLogs: AuditLog[];

  // ==================== HOOKS ====================

  @BeforeCreate
  static async hashPassword(instance: User) {
    if (instance.passwordHash && !instance.passwordHash.startsWith('$2b$')) {
      instance.passwordHash = await bcrypt.hash(instance.passwordHash, 10);
    }
  }

  // ==================== MÉTODOS ====================

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }

  async setPassword(password: string): Promise<void> {
    this.passwordHash = await bcrypt.hash(password, 10);
  }

  // Ocultar datos sensibles al convertir a JSON
  toJSON() {
    const { passwordHash, ...rest } = this.get();
    return rest;
  }
}
