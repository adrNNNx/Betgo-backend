// src/modules/symbols/entities/symbol.entity.ts
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
import { Prize } from '../../prizes/entities/prize.entity';

interface SymbolCreationAttributes {
  name: string;
  imageUrl: string;
  publicId?: string | null;

  barId?: string | null;
  prizeId?: string | null;

  weight?: number;
  isJackpot?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

@Table({
  tableName: 'symbols',
  timestamps: true,
  underscored: true,
})
export class Symbol extends Model<Symbol, SymbolCreationAttributes> {
  // ==================== CAMPOS ====================

  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => Bar)
  @Column({
    type: DataType.UUID,
    allowNull: true, // NULL para símbolos globales
    field: 'bar_id',
  })
  declare barId: string | null;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
    field: 'image_url',
  })
  declare imageUrl: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'public_id',
  })
  declare publicId: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 100,
  })
  declare weight: number;

  @ForeignKey(() => Prize)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'prize_id',
  })
  declare prizeId: string | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_jackpot',
  })
  declare isJackpot: boolean;

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

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // ==================== RELACIONES ====================

  @BelongsTo(() => Bar)
  declare bar: Bar;

  @BelongsTo(() => Prize)
  declare prize: Prize;

  // ==================== MÉTODOS DE DOMINIO ====================

  /**
   * Símbolo global (sirve para todos los bares)
   */
  isGlobal(): boolean {
    return this.barId === null;
  }

  /**
   * Símbolo pertenece a un bar específico
   */
  isLocal(): boolean {
    return this.barId !== null;
  }

  /**
   * Tiene premio asociado
   */
  hasPrize(): boolean {
    return this.prizeId !== null;
  }

  /**
   * Símbolo activo (puede aparecer en jugadas)
   */
  isAvailable(): boolean {
    return this.isActive && this.weight > 0;
  }

  /**
   * Es un símbolo jackpot
   */
  isJackpotSymbol(): boolean {
    return this.isJackpot === true;
  }

  /**
   * Validación para sorteos (peso debe ser positivo)
   */
  hasValidWeight(): boolean {
    return this.weight > 0;
  }

  /**
   * Activar símbolo
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * Desactivar símbolo
   */
  deactivate(): void {
    this.isActive = false;
  }
}
