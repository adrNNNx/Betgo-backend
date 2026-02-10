// src/modules/tables/entities/table.entity.ts
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
  BeforeCreate,
  BeforeUpdate,
} from 'sequelize-typescript';
import { Bar } from '../../bars/entities/bar.entity';
import { Play } from '../../plays/entities/play.entity';

interface TableCreationAttributes {
  barId: string;
  number: number;
  slug?: string; // Opcional porque se genera automáticamente
  qrCode?: string; // Opcional porque se genera automáticamente
  isActive?: boolean;
}

@Table({
  tableName: 'tables',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      // Índice único compuesto: un número de mesa por bar
      unique: true,
      fields: ['bar_id', 'number'],
      name: 'unique_table_number_per_bar',
    },
  ],
})
export class TableEntity extends Model<TableEntity, TableCreationAttributes> {
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
    allowNull: false,
    field: 'bar_id',
  })
  declare barId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare number: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
  })
  declare slug: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'qr_code',
  })
  declare qrCode: string;

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

  @HasMany(() => Play)
  declare plays: Play[];

  // ==================== HOOKS ====================

  /**
   * Genera el slug automáticamente: {barSlug}-mesa-{number}
   */
  @BeforeCreate
  @BeforeUpdate
  static async generateSlug(instance: TableEntity) {
    // Solo regenerar si es necesario
    if (
      !instance.slug ||
      instance.changed('number') ||
      instance.changed('barId')
    ) {
      try {
        let barSlug = 'bar'; // Default fallback

        // Opción 1: Ya tiene el bar cargado
        if (instance.bar?.slug) {
          barSlug = instance.bar.slug;
        }
        // Opción 2: Cargar el bar por ID
        else if (instance.barId) {
          const bar = await Bar.findByPk(instance.barId, {
            attributes: ['slug'], // Solo traer el slug para optimizar
          });

          if (bar?.slug) {
            barSlug = bar.slug;
          }
        }

        instance.slug = `${barSlug}-mesa-${instance.number}`;
      } catch (error) {
        console.error('Error generando slug para mesa:', error);
        // Fallback en caso de error
        instance.slug = `bar-mesa-${instance.number}`;
      }
    }
  }

  /**
   * Genera el código QR automáticamente si no existe
   */
  @BeforeCreate
  static async generateQRCode(instance: TableEntity) {
    if (!instance.qrCode) {
      // Asegurarse de que el slug esté generado primero
      if (!instance.slug) {
        await TableEntity.generateSlug(instance);
      }

      // URL del QR que apuntará a tu app
      const baseUrl = process.env.APP_URL || 'https://betgo.app';
      instance.qrCode = `${baseUrl}/play/${instance.slug}`;
    }
  }

  // ==================== MÉTODOS DE DOMINIO ====================

  /**
   * Verificar si la mesa está activa
   */
  isAvailable(): boolean {
    return this.isActive === true;
  }

  /**
   * Activar la mesa
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * Desactivar la mesa
   */
  deactivate(): void {
    this.isActive = false;
  }

  /**
   * Obtener nombre legible de la mesa
   */
  getDisplayName(): string {
    return `Mesa ${this.number}`;
  }

  /**
   * Obtener URL completa del QR
   */
  getQRCodeUrl(): string {
    return this.qrCode;
  }

  /**
   * Verificar si tiene jugadas
   */
  async hasPlays(): Promise<boolean> {
    const count = await Play.count({
      where: { tableId: this.id },
    });
    return count > 0;
  }

  // ==================== MÉTODOS ESTÁTICOS ====================

  /**
   * Buscar mesa por slug
   */
  static async findBySlug(slug: string): Promise<TableEntity | null> {
    return TableEntity.findOne({
      where: { slug },
      include: [{ model: Bar, as: 'bar' }],
    });
  }

  /**
   * Obtener todas las mesas activas de un bar
   */
  static async getActiveByBar(barId: string): Promise<TableEntity[]> {
    return TableEntity.findAll({
      where: {
        barId,
        isActive: true,
      },
      order: [['number', 'ASC']],
    });
  }

  /**
   * Obtener el siguiente número disponible para un bar
   */
  static async getNextNumberForBar(barId: string): Promise<number> {
    const lastTable = await TableEntity.findOne({
      where: { barId },
      order: [['number', 'DESC']],
    });

    return lastTable ? lastTable.number + 1 : 1;
  }

  /**
   * Crear mesa con QR automático
   */
  static async createWithQR(
    barId: string,
    number?: number,
  ): Promise<TableEntity> {
    // Si no se proporciona número, obtener el siguiente disponible
    const tableNumber = number || (await this.getNextNumberForBar(barId));

    const table = await TableEntity.create({
      barId,
      number: tableNumber,
      isActive: true,
    });

    return table;
  }
}
