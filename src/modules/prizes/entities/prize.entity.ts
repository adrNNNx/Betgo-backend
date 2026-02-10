// src/modules/prizes/entities/prize.entity.ts
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
import { Bar } from '../../bars/entities/bar.entity';
import { Symbol } from '../../symbols/entities/symbol.entity';
import { Play } from '../../plays/entities/play.entity';
import { PrizeClaim } from '../../prize-claims/entities/prize-claim.entity';

export enum PrizeType {
  LOCAL = 'local',
  JACKPOT = 'jackpot',
}

interface PrizeCreationAttributes {
  name: string;
  type: PrizeType;

  barId?: string;
  description?: string;
  value?: number;
  stock?: number;
  imageUrl?: string;
  isActive?: boolean;
}

@Table({
  tableName: 'prizes',
  timestamps: true,
  underscored: true,
})
export class Prize extends Model<Prize, PrizeCreationAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => Bar)
  @Column({
    type: DataType.UUID,
    allowNull: true, // NULL para jackpot global
    field: 'bar_id',
  })
  declare barId: string | null;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string | null; 

  @Column({
    type: DataType.ENUM(...Object.values(PrizeType)),
    allowNull: false,
  })
  declare type: PrizeType;

  @Column({
    type: DataType.DECIMAL(12, 2),
    allowNull: true,
    get() {
      const value = this.getDataValue('value');
      return value ? parseFloat(value) : null;
    },
  })
  declare value: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true, // NULL = ilimitado
  })
  declare stock: number | null;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    field: 'image_url',
  })
  declare imageUrl: string | null;

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

  @BelongsTo(() => Bar)
  declare bar: Bar;

  @HasMany(() => Symbol)
  declare symbols: Symbol[];

  @HasMany(() => Play)
  declare winningPlays: Play[];

  @HasMany(() => PrizeClaim)
  declare claims: PrizeClaim[];

  // ==================== MÉTODOS ====================

  isGlobal(): boolean {
    return this.barId === null;
  }

  hasStock(): boolean {
    return this.stock === null || this.stock > 0;
  }

  decrementStock(): void {
    if (this.stock !== null && this.stock > 0) {
      this.stock -= 1;
    }
  }
}
