import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Bar } from '../../bars/entities/bar.entity';

interface BannerCreationAttributes {
  title: string;
  imageUrl: string;
  publicId: string;
  description?: string | null;
  linkUrl?: string | null;
  barId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

@Table({
  tableName: 'banners',
  timestamps: true,
  underscored: true,
})
export class Banner extends Model<Banner, BannerCreationAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => Bar)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'bar_id',
  })
  declare barId: string | null;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare title: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string | null;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
    field: 'image_url',
  })
  declare imageUrl: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    field: 'public_id',
  })
  declare publicId: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    field: 'link_url',
  })
  declare linkUrl: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'display_order',
  })
  declare displayOrder: number;

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
    field: 'starts_at',
  })
  declare startsAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'ends_at',
  })
  declare endsAt: Date | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => Bar)
  declare bar: Bar;

  // ==================== MÉTODOS DE DOMINIO ====================

  isGlobal(): boolean {
    return this.barId === null;
  }

  isVisibleNow(now: Date = new Date()): boolean {
    if (!this.isActive) return false;
    if (this.startsAt && now < this.startsAt) return false;
    if (this.endsAt && now > this.endsAt) return false;
    return true;
  }
}
