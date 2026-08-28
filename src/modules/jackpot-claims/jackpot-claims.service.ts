import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import type { Transaction as SequelizeTransaction } from 'sequelize';
import {
  JackpotClaim,
  JackpotClaimStatus,
} from './entities/jackpot-claim.entity';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import { User } from '../users/entities/user.entity';
import { Bar } from '../bars/entities/bar.entity';
import { StaffService } from '../staff/staff.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Sin I, O, 0, 1: el folio se dicta por teléfono y se transcribe a mano.
const FOLIO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FOLIO_LENGTH = 6;

export interface JackpotClaimItem {
  id: string;
  folio: string;
  amount: number;
  status: JackpotClaimStatus;
  playedAt: Date;
  contactedAt: Date | null;
  paidAt: Date | null;
  bar: { id: string; name: string } | null;
  user?: { id: string; name: string | null; phone: string };
}

@Injectable()
export class JackpotClaimsService {
  private readonly logger = new Logger(JackpotClaimsService.name);

  constructor(
    @InjectModel(JackpotClaim)
    private readonly claimModel: typeof JackpotClaim,
    @InjectModel(GlobalPool)
    private readonly poolModel: typeof GlobalPool,
    private readonly configService: ConfigService,
    private readonly staffService: StaffService,
  ) {}

  /**
   * Folio J-XXXXXX único. Reintenta ante colisión (el índice unique es la
   * garantía real; esto solo evita que el usuario vea un 500).
   */
  private generateFolio(): string {
    let folio = 'J-';
    for (let i = 0; i < FOLIO_LENGTH; i++) {
      folio += FOLIO_CHARS.charAt(randomInt(0, FOLIO_CHARS.length));
    }
    return folio;
  }

  /**
   * Emite el comprobante del pozo ganado. Lo llama el flujo de juego dentro de
   * su transacción: el monto NO se acredita al saldo, queda como obligación.
   */
  async createForWin(
    params: {
      userId: string;
      playId: string;
      amount: number;
      barId?: string | null;
    },
    transaction?: SequelizeTransaction,
  ): Promise<JackpotClaim> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const folio = this.generateFolio();
      const existing = await this.claimModel.findOne({
        where: { folio },
        transaction,
      });
      if (existing) continue;

      const claim = await this.claimModel.create(
        {
          userId: params.userId,
          playId: params.playId,
          barId: params.barId ?? null,
          folio,
          amount: params.amount,
          status: JackpotClaimStatus.PENDING_CONTACT,
        },
        { transaction },
      );

      this.notifyAdmins(claim);
      return claim;
    }
    throw new BadRequestException('No se pudo generar el folio del pozo.');
  }

  /**
   * Punto de enganche para avisar a administración. Hoy solo deja el registro
   * en el log y el panel se entera por el badge (pendingCount).
   * Si más adelante se suma email o WhatsApp, se conecta acá sin tocar el juego.
   */
  private notifyAdmins(claim: JackpotClaim): void {
    this.logger.warn(
      `🏆 POZO GANADO — Folio: ${claim.folio}, Monto: Gs. ${claim.amount.toLocaleString()}, ` +
        `Usuario: ${claim.userId}. Requiere revisión y pago manual.`,
    );
  }

  /**
   * Link de WhatsApp con el folio ya escrito en el mensaje, así administración
   * identifica el caso sin pedirle datos al ganador.
   * Sin ADMIN_WHATSAPP configurado devuelve null y el front oculta el botón.
   */
  buildContactHref(folio: string): string | null {
    const phone = this.configService.get<string>('ADMIN_WHATSAPP');
    if (!phone) return null;

    const clean = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hola, gané el pozo global de BetGo. Mi folio es ${folio}.`,
    );
    return `https://wa.me/${clean}?text=${text}`;
  }

  /**
   * El ganador avisa que se contactó: pending_contact → in_review.
   * Solo el dueño del comprobante puede hacerlo.
   */
  async markContacted(folio: string, userId: string): Promise<JackpotClaim> {
    const claim = await this.claimModel.findOne({ where: { folio } });
    if (!claim) {
      throw new NotFoundException('Comprobante no encontrado.');
    }
    if (claim.userId !== userId) {
      throw new ForbiddenException('Este comprobante no es tuyo.');
    }
    if (claim.status === JackpotClaimStatus.PAID) {
      throw new BadRequestException('Este pozo ya fue pagado.');
    }
    // Reintentar el contacto no es un error: se responde el estado actual.
    if (claim.status === JackpotClaimStatus.IN_REVIEW) {
      return claim;
    }

    await claim.update({
      status: JackpotClaimStatus.IN_REVIEW,
      contactedAt: new Date(),
    });
    return claim;
  }

  /** Comprobantes del usuario autenticado. */
  async getMyClaims(
    userId: string,
    query: { limit?: number; offset?: number },
  ): Promise<{ data: JackpotClaimItem[]; total: number }> {
    const { limit, offset } = this.paginate(query);

    const { rows, count } = await this.claimModel.findAndCountAll({
      where: { userId },
      include: [{ model: Bar, attributes: ['id', 'name'], required: false }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return { data: rows.map((c) => this.format(c)), total: count };
  }

  /** Listado para el panel admin. */
  async findAll(query: {
    status?: JackpotClaimStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: JackpotClaimItem[]; total: number }> {
    const { limit, offset } = this.paginate(query);

    const { rows, count } = await this.claimModel.findAndCountAll({
      where: query.status ? { status: query.status } : {},
      include: [
        { model: Bar, attributes: ['id', 'name'], required: false },
        { model: User, attributes: ['id', 'name', 'phone'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return {
      data: rows.map((c) => this.format(c, true)),
      total: count,
    };
  }

  /**
   * Badge del panel: cuántos pozos esperan resolución.
   * Es la vía por la que los admins se enteran de que alguien ganó.
   */
  async getPendingCount(): Promise<{
    total: number;
    pendingContact: number;
    inReview: number;
    amountOwed: number;
  }> {
    const pendientes = await this.claimModel.findAll({
      where: { status: [JackpotClaimStatus.PENDING_CONTACT, JackpotClaimStatus.IN_REVIEW] },
      attributes: ['status', 'amount'],
    });

    let pendingContact = 0;
    let inReview = 0;
    let amountOwed = 0;
    for (const c of pendientes) {
      if (c.status === JackpotClaimStatus.PENDING_CONTACT) pendingContact++;
      else inReview++;
      amountOwed += c.amount;
    }

    return {
      total: pendientes.length,
      pendingContact,
      inReview,
      amountOwed,
    };
  }

  /**
   * Administración marca el pozo como pagado. Recién acá se suma a
   * `total_paid` del pozo: al ganar solo nace la deuda, no el pago.
   */
  async markPaid(
    folio: string,
    adminUserId: string,
    notes?: string,
  ): Promise<JackpotClaim> {
    const staff = await this.staffService.findActiveByUserId(adminUserId);

    const claim = await this.claimModel.findOne({ where: { folio } });
    if (!claim) {
      throw new NotFoundException('Comprobante no encontrado.');
    }
    if (claim.status === JackpotClaimStatus.PAID) {
      throw new BadRequestException('Este pozo ya fue pagado.');
    }

    await claim.update({
      status: JackpotClaimStatus.PAID,
      paidAt: new Date(),
      paidById: staff.id,
      notes: notes ?? claim.notes,
    });

    const pool = await this.poolModel.findByPk(1);
    if (pool) {
      await pool.increment('totalPaid', { by: claim.amount });
    }

    this.logger.log(
      `💰 Pozo PAGADO — Folio: ${folio}, Monto: Gs. ${claim.amount.toLocaleString()}, ` +
        `Autorizó: ${staff.id}`,
    );
    return claim;
  }

  // ==================== PRIVADOS ====================

  private paginate(query: { limit?: number; offset?: number }) {
    return {
      limit:
        query.limit && query.limit > 0
          ? Math.min(query.limit, MAX_LIMIT)
          : DEFAULT_LIMIT,
      offset: query.offset && query.offset > 0 ? query.offset : 0,
    };
  }

  private format(claim: JackpotClaim, includeUser = false): JackpotClaimItem {
    const item: JackpotClaimItem = {
      id: claim.id,
      folio: claim.folio,
      amount: claim.amount,
      status: claim.status,
      playedAt: claim.createdAt,
      contactedAt: claim.contactedAt,
      paidAt: claim.paidAt,
      bar: claim.bar ? { id: claim.bar.id, name: claim.bar.name } : null,
    };
    if (includeUser && claim.user) {
      item.user = {
        id: claim.user.id,
        name: claim.user.name,
        phone: claim.user.phone,
      };
    }
    return item;
  }
}
