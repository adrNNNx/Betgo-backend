// src/modules/audit-logs/entities/audit-log.entity.ts
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

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  RECHARGE = 'RECHARGE',
  PLAY = 'PLAY',
  PRIZE_WON = 'PRIZE_WON',
  PRIZE_DELIVERED = 'PRIZE_DELIVERED',
  POOL_ADJUSTMENT = 'POOL_ADJUSTMENT',
  BAR_RECHARGE = 'BAR_RECHARGE',
}

export enum AuditEntity {
  USER = 'users',
  BAR = 'bars',
  TABLE = 'tables',
  STAFF = 'staff',
  SYMBOL = 'symbols',
  PRIZE = 'prizes',
  GLOBAL_POOL = 'global_pool',
  TRANSACTION = 'transactions',
  PLAY = 'plays',
  RECHARGE_CODE = 'recharge_codes',
  PRIZE_CLAIM = 'prize_claims',
  POOL_MOVEMENT = 'pool_movements',
}

interface AuditLogCreationAttributes {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Table({
  tableName: 'audit_logs',
  timestamps: false, // Solo tiene created_at
  underscored: true,
})
export class AuditLog extends Model<AuditLog, AuditLogCreationAttributes> {
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

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  declare action: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  declare entity: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'entity_id',
  })
  declare entityId: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'old_values',
  })
  declare oldValues: Record<string, any>;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'new_values',
  })
  declare newValues: Record<string, any>;

  @Column({
    type: DataType.INET,
    allowNull: true,
    field: 'ip_address',
  })
  declare ipAddress: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'user_agent',
  })
  declare userAgent: string;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => User)
  declare user: User;

  // ==================== MÉTODOS ESTÁTICOS ====================

  static async log(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    return AuditLog.create(params);
  }

  static async logCreate(
    userId: string,
    entity: string,
    entityId: string,
    newValues: Record<string, any>,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return AuditLog.log({
      userId,
      action: AuditAction.CREATE,
      entity,
      entityId,
      newValues,
      ipAddress,
    });
  }

  static async logUpdate(
    userId: string,
    entity: string,
    entityId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return AuditLog.log({
      userId,
      action: AuditAction.UPDATE,
      entity,
      entityId,
      oldValues,
      newValues,
      ipAddress,
    });
  }

  static async logDelete(
    userId: string,
    entity: string,
    entityId: string,
    oldValues: Record<string, any>,
    ipAddress?: string,
  ): Promise<AuditLog> {
    return AuditLog.log({
      userId,
      action: AuditAction.DELETE,
      entity,
      entityId,
      oldValues,
      ipAddress,
    });
  }

  static async logLogin(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return AuditLog.log({
      userId,
      action: AuditAction.LOGIN,
      entity: AuditEntity.USER,
      entityId: userId,
      ipAddress,
      userAgent,
    });
  }
}
