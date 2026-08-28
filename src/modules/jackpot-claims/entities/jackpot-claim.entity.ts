// src/modules/jackpot-claims/entities/jackpot-claim.entity.ts
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
import { User } from '../../users/entities/user.entity';
import { Bar } from '../../bars/entities/bar.entity';
import { Play } from '../../plays/entities/play.entity';
import { Staff } from '../../staff/entities/staff.entity';

/**
 * Estados del retiro del pozo. El avance es estrictamente hacia adelante:
 * pending_contact → in_review → paid.
 */
export enum JackpotClaimStatus {
  PENDING_CONTACT = 'pending_contact',
  IN_REVIEW = 'in_review',
  PAID = 'paid',
}

interface JackpotClaimCreationAttributes {
  userId: string;
  playId: string;
  folio: string;
  amount: number;
  barId?: string | null;
  status?: JackpotClaimStatus;
  notes?: string | null;
}

/**
 * Comprobante de pozo ganado. El monto NO se acredita al saldo: queda como
 * obligación hasta que administración lo marca pagado.
 */
@Table({
  tableName: 'jackpot_claims',
  timestamps: true,
  underscored: true,
})
export class JackpotClaim extends Model<
  JackpotClaim,
  JackpotClaimCreationAttributes
> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @ForeignKey(() => Bar)
  @Column({ type: DataType.UUID, allowNull: true, field: 'bar_id' })
  declare barId: string | null;

  @ForeignKey(() => Play)
  @Column({ type: DataType.UUID, allowNull: false, field: 'play_id' })
  declare playId: string;

  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  declare folio: string;

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: false,
    get() {
      const value = this.getDataValue('amount');
      return value ? parseFloat(value) : 0;
    },
  })
  declare amount: number;

  @Column({
    type: DataType.ENUM(...Object.values(JackpotClaimStatus)),
    allowNull: false,
    defaultValue: JackpotClaimStatus.PENDING_CONTACT,
  })
  declare status: JackpotClaimStatus;

  @Column({ type: DataType.DATE, allowNull: true, field: 'contacted_at' })
  declare contactedAt: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'paid_at' })
  declare paidAt: Date | null;

  @ForeignKey(() => Staff)
  @Column({ type: DataType.UUID, allowNull: true, field: 'paid_by_id' })
  declare paidById: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  /** Hoy el reclamo del pozo no vence; la columna queda por si eso cambia. */
  @Column({ type: DataType.DATE, allowNull: true, field: 'expires_at' })
  declare expiresAt: Date | null;

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

  @BelongsTo(() => Play)
  declare play: Play;

  @BelongsTo(() => Staff, 'paidById')
  declare paidBy: Staff;

  // ==================== MÉTODOS ====================

  isPaid(): boolean {
    return this.status === JackpotClaimStatus.PAID;
  }
}
