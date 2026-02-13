// src/modules/auth/entities/refresh-token.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  BeforeValidate,
} from 'sequelize-typescript';
import { Op } from 'sequelize';

import * as crypto from 'crypto';

import { User } from '../../users/entities/user.entity';

interface RefreshTokenCreationAttributes {
  userId: string;
  token: string;
  expiresAt: Date;

  tokenHash?: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Table({
  tableName: 'refresh_tokens',
  timestamps: false,
  underscored: true,
})
export class RefreshToken extends Model<
  RefreshToken,
  RefreshTokenCreationAttributes
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
    allowNull: false,
    field: 'user_id',
  })
  declare userId: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
    unique: true,
  })
  declare token: string;

  @Column({
    type: DataType.STRING(64),
    allowNull: false,
    unique: true,
    field: 'token_hash',
  })
  declare tokenHash: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'expires_at',
  })
  declare expiresAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_revoked',
  })
  declare isRevoked: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'revoked_at',
  })
  declare revokedAt: Date;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'device_info',
  })
  declare deviceInfo: string;

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

  // ==================== HOOKS ====================

  @BeforeValidate
  static hashToken(instance: RefreshToken) {
    if (instance.token && !instance.tokenHash) {
      instance.tokenHash = crypto
        .createHash('sha256')
        .update(instance.token)
        .digest('hex');
    }
  }

  // ==================== MÉTODOS ====================

  isActive(): boolean {
    return !this.isRevoked && this.expiresAt > new Date();
  }

  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  async revoke(): Promise<void> {
    this.isRevoked = true;
    this.revokedAt = new Date();
    await this.save();
  }

  // ==================== MÉTODOS ESTÁTICOS ====================

  static async revokeAllUserTokens(userId: string): Promise<number> {
    const [affectedCount] = await RefreshToken.update(
      {
        isRevoked: true,
        revokedAt: new Date(),
      },
      {
        where: {
          userId,
          isRevoked: false,
        },
      },
    );
    return affectedCount;
  }

  static async cleanupExpired(): Promise<number> {
    const count = await RefreshToken.destroy({
      where: {
        [Op.or]: [{ isRevoked: true }, { expiresAt: { [Op.lt]: new Date() } }],
      },
    });
    return count;
  }

  static async findActiveByHash(
    tokenHash: string,
  ): Promise<RefreshToken | null> {
    return RefreshToken.findOne({
      where: {
        tokenHash,
        isRevoked: false,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      include: [{ model: User, as: 'user' }],
    });
  }

  static async countActiveForUser(userId: string): Promise<number> {
    return RefreshToken.count({
      where: {
        userId,
        isRevoked: false,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
    });
  }

  static async findByToken(token: string): Promise<RefreshToken | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    return RefreshToken.findOne({
      where: { tokenHash, isRevoked: false },
      include: [User],
    });
  }
}
