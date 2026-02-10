// src/modules/bars/entities/bar.entity.ts
import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  CreatedAt,
  UpdatedAt,
  BeforeCreate,
  BeforeUpdate,
} from 'sequelize-typescript';
import { TableEntity } from '../../tables/entities/table.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { Symbol } from '../../symbols/entities/symbol.entity';
import { Prize } from '../../prizes/entities/prize.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Play } from '../../plays/entities/play.entity';
import { UserDailyPlay } from '../../user-daily-plays/entities/user-daily-play.entity';
import { PrizeClaim } from '../../prize-claims/entities/prize-claim.entity';
import { PoolMovement } from '../../pool-movements/entities/pool-movement.entity';

interface BarCreationAttributes {
  name: string;
  slug?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  freePlaysPerDay?: number;
  barPercentage?: number;
  poolPercentage?: number;
  platformPercentage?: number;
  isActive?: boolean;
}

@Table({
  tableName: 'bars',
  timestamps: true,
  underscored: true,
})
export class Bar extends Model<Bar, BarCreationAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    unique: true,
  })
  declare slug: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare address: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
  })
  declare phone: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    field: 'logo_url',
  })
  declare logoUrl: string;

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
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 3,
    field: 'free_plays_per_day',
  })
  declare freePlaysPerDay: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 50.0,
    field: 'bar_percentage',
    get() {
      const value = this.getDataValue('barPercentage');
      return value ? parseFloat(value) : 50;
    },
  })
  declare barPercentage: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 30.0,
    field: 'pool_percentage',
    get() {
      const value = this.getDataValue('poolPercentage');
      return value ? parseFloat(value) : 30;
    },
  })
  declare poolPercentage: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 20.0,
    field: 'platform_percentage',
    get() {
      const value = this.getDataValue('platformPercentage');
      return value ? parseFloat(value) : 20;
    },
  })
  declare platformPercentage: number;

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

  @HasMany(() => TableEntity)
  declare tables: TableEntity[];

  @HasMany(() => Staff)
  declare staff: Staff[];

  @HasMany(() => Symbol)
  declare symbols: Symbol[];

  @HasMany(() => Prize)
  declare prizes: Prize[];

  @HasMany(() => Transaction)
  declare transactions: Transaction[];

  @HasMany(() => Play)
  declare plays: Play[];

  @HasMany(() => UserDailyPlay)
  declare userDailyPlays: UserDailyPlay[];

  @HasMany(() => PrizeClaim)
  declare prizeClaims: PrizeClaim[];

  @HasMany(() => PoolMovement)
  declare poolMovements: PoolMovement[];

  // ==================== HOOKS ====================

  @BeforeCreate
  @BeforeUpdate
  static generateSlug(instance: Bar) {
    if (instance.name && (!instance.slug || instance.changed('name'))) {
      instance.slug = instance.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  }
}
