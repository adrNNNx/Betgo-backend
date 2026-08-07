// src/modules/prize-claims/prize-claims.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { PrizeClaim, ClaimStatus } from './entities/prize-claim.entity';
import { Prize, PrizeType } from '../prizes/entities/prize.entity';
import { User } from '../users/entities/user.entity';
import { Bar } from '../bars/entities/bar.entity';
import { StaffService } from '../staff/staff.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ==================== INTERFACES ====================

export interface ValidateClaimResponse {
  claimId: string;
  claimCode: string;
  status: ClaimStatus;
  prize: {
    id: string;
    name: string;
    type: string;
    value: number | null;
    imageUrl: string | null;
    description: string | null;
  };
  user: {
    id: string;
    name: string | null;
    phone: string;
  };
  bar: {
    id: string;
    name: string;
  } | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface DeliverPrizeResponse {
  success: boolean;
  claimCode: string;
  prize: {
    name: string;
    value: number | null;
  };
  user: {
    name: string | null;
    phone: string;
  };
  deliveredAt: Date;
}

export interface PendingClaimItem {
  id: string;
  claimCode: string;
  prize: {
    name: string;
    type: string;
    value: number | null;
    imageUrl: string | null;
  };
  user: {
    name: string | null;
    phone: string;
  };
  /** Solo lo devuelve la vista de admin: el mozo ya sabe de qué bar es. */
  bar?: { id: string; name: string } | null;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class PrizeClaimsService {
  private readonly logger = new Logger(PrizeClaimsService.name);

  constructor(
    @InjectModel(PrizeClaim)
    private readonly prizeClaimModel: typeof PrizeClaim,
    @InjectModel(Prize)
    private readonly prizeModel: typeof Prize,
    private readonly staffService: StaffService,
  ) {}

  // ==================== VALIDAR CÓDIGO DE PREMIO (MOZO) ====================

  /**
   * El mozo escanea o ingresa el código del premio.
   *
   * VALIDACIONES:
   * - El código existe
   * - Está en estado PENDING
   * - No ha expirado
   * - Es un premio LOCAL (no jackpot)
   * - Pertenece al bar del mozo
   */
  async validateClaimCode(
    code: string,
    staffUserId: string,
  ): Promise<ValidateClaimResponse> {
    // Buscar staff
    const staff = await this.getStaffByUserId(staffUserId);

    // Buscar claim con relaciones
    const claim = await this.prizeClaimModel.findOne({
      where: { claimCode: code },
      include: [
        {
          model: Prize,
          attributes: ['id', 'name', 'type', 'value', 'imageUrl', 'description'],
        },
        {
          model: User,
          attributes: ['id', 'name', 'phone'],
        },
        {
          model: Bar,
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!claim) {
      throw new NotFoundException(
        'Código de premio no encontrado. Verifica e intenta de nuevo.',
      );
    }

    // Verificar que no esté ya entregado
    if (claim.status === ClaimStatus.DELIVERED) {
      throw new BadRequestException('Este premio ya fue entregado.');
    }

    // Verificar expiración
    if (new Date() > claim.expiresAt) {
      if (claim.status !== ClaimStatus.EXPIRED) {
        await claim.update({ status: ClaimStatus.EXPIRED });
      }
      throw new BadRequestException(
        'Este código de premio ha expirado.',
      );
    }

    // Verificar que esté pending
    if (claim.status !== ClaimStatus.PENDING) {
      throw new BadRequestException(
        `Código en estado inválido: ${claim.status}`,
      );
    }

    // Verificar que sea premio local (no jackpot)
    if (claim.prize.type === PrizeType.JACKPOT) {
      throw new BadRequestException(
        'Este es un premio mayor: lo entrega un administrador, no el panel del mozo.',
      );
    }

    // Verificar que pertenece al bar del mozo
    if (claim.barId && staff.barId && claim.barId !== staff.barId) {
      throw new ForbiddenException(
        'Este premio pertenece a otro bar. Solo puedes validar premios de tu bar.',
      );
    }

    this.logger.log(
      `Código de premio ${code} validado por staff ${staffUserId}`,
    );

    return {
      claimId: claim.id,
      claimCode: claim.claimCode,
      status: claim.status,
      prize: {
        id: claim.prize.id,
        name: claim.prize.name,
        type: claim.prize.type,
        value: claim.prize.value,
        imageUrl: claim.prize.imageUrl,
        description: claim.prize.description,
      },
      user: {
        id: claim.user.id,
        name: claim.user.name,
        phone: claim.user.phone,
      },
      bar: claim.bar
        ? { id: claim.bar.id, name: claim.bar.name }
        : null,
      createdAt: claim.createdAt,
      expiresAt: claim.expiresAt,
    };
  }

  // ==================== ENTREGAR PREMIO (MOZO) ====================

  /**
   * El mozo confirma la entrega del premio.
   *
   * FLUJO:
   * 1. Re-validar el código (puede haber expirado)
   * 2. Verificar permisos del staff
   * 3. Marcar como entregado con staffId + timestamp
   * 4. Decrementar stock del premio si aplica
   */
  async deliverPrize(
    code: string,
    staffUserId: string,
    notes?: string,
  ): Promise<DeliverPrizeResponse> {
    const staff = await this.getStaffByUserId(staffUserId);

    const claim = await this.prizeClaimModel.findOne({
      where: { claimCode: code },
      include: [
        { model: Prize },
        { model: User, attributes: ['id', 'name', 'phone'] },
      ],
    });

    if (!claim) {
      throw new NotFoundException('Código de premio no encontrado.');
    }

    if (claim.status === ClaimStatus.DELIVERED) {
      throw new BadRequestException('Este premio ya fue entregado.');
    }

    if (new Date() > claim.expiresAt) {
      if (claim.status !== ClaimStatus.EXPIRED) {
        await claim.update({ status: ClaimStatus.EXPIRED });
      }
      throw new BadRequestException('Este código de premio ha expirado.');
    }

    if (claim.status !== ClaimStatus.PENDING) {
      throw new BadRequestException(
        `No se puede entregar. Estado actual: ${claim.status}`,
      );
    }

    if (claim.prize.type === PrizeType.JACKPOT) {
      throw new BadRequestException(
        'Los premios del pozo global no se pueden entregar desde el panel del mozo.',
      );
    }

    if (claim.barId && staff.barId && claim.barId !== staff.barId) {
      throw new ForbiddenException(
        'Este premio pertenece a otro bar.',
      );
    }

    // Marcar como entregado
    await claim.update({
      status: ClaimStatus.DELIVERED,
      deliveredById: staff.id,
      deliveredAt: new Date(),
      notes: notes || null,
    });

    // Decrementar stock del premio si tiene stock limitado
    if (claim.prize.stock !== null && claim.prize.stock > 0) {
      await claim.prize.decrement('stock', { by: 1 });
    }

    this.logger.log(
      `🎁 Premio entregado - Código: ${code}, Premio: ${claim.prize.name}, ` +
        `Usuario: ${claim.user.phone}, Staff: ${staff.id}`,
    );

    return {
      success: true,
      claimCode: claim.claimCode,
      prize: {
        name: claim.prize.name,
        value: claim.prize.value,
      },
      user: {
        name: claim.user.name,
        phone: claim.user.phone,
      },
      deliveredAt: claim.deliveredAt!,
    };
  }

  // ==================== PREMIOS PENDIENTES DEL BAR (MOZO) ====================

  /**
   * Lista de premios pendientes de entregar para el bar del mozo.
   *
   * - Solo muestra premios LOCALES (no jackpot)
   * - Auto-expira los que ya pasaron su fecha
   * - Orden: más recientes primero
   */
  async getPendingByBar(
    staffUserId: string,
  ): Promise<PendingClaimItem[]> {
    const staff = await this.getStaffByUserId(staffUserId);

    if (!staff.barId) {
      throw new ForbiddenException('No tienes un bar asignado.');
    }

    // Auto-expirar claims vencidos
    await this.prizeClaimModel.update(
      { status: ClaimStatus.EXPIRED },
      {
        where: {
          barId: staff.barId,
          status: ClaimStatus.PENDING,
          expiresAt: { [Op.lt]: new Date() },
        },
      },
    );

    // Buscar pendientes
    const claims = await this.prizeClaimModel.findAll({
      where: {
        barId: staff.barId,
        status: ClaimStatus.PENDING,
      },
      include: [
        {
          model: Prize,
          attributes: ['name', 'type', 'value', 'imageUrl'],
          where: { type: PrizeType.LOCAL }, // Solo locales
        },
        {
          model: User,
          attributes: ['name', 'phone'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return claims.map((claim) => ({
      id: claim.id,
      claimCode: claim.claimCode,
      prize: {
        name: claim.prize.name,
        type: claim.prize.type,
        value: claim.prize.value,
        imageUrl: claim.prize.imageUrl,
      },
      user: {
        name: claim.user.name,
        phone: claim.user.phone,
      },
      createdAt: claim.createdAt,
      expiresAt: claim.expiresAt,
    }));
  }

  // ============ PREMIOS MAYORES (type=jackpot) — SOLO ADMIN ============

  /**
   * Premios mayores pendientes de entregar, de TODOS los bares.
   * Son los `type: jackpot` del catálogo (iPhone, auto, montos grandes): el mozo
   * no puede entregarlos, los autoriza un admin. No confundir con el pozo global,
   * que se acredita al saldo automáticamente y no genera claim.
   * Auto-expira los vencidos, igual que la vista del mozo.
   */
  async getMajorClaims(query: {
    barId?: string;
    status?: ClaimStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: PendingClaimItem[]; total: number }> {
    const status = query.status ?? ClaimStatus.PENDING;

    // Solo tiene sentido auto-expirar cuando se listan los pendientes.
    if (status === ClaimStatus.PENDING) {
      await this.prizeClaimModel.update(
        { status: ClaimStatus.EXPIRED },
        {
          where: {
            ...(query.barId ? { barId: query.barId } : {}),
            status: ClaimStatus.PENDING,
            expiresAt: { [Op.lt]: new Date() },
          },
        },
      );
    }

    const limit =
      query.limit && query.limit > 0
        ? Math.min(query.limit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset = query.offset && query.offset > 0 ? query.offset : 0;

    const { rows, count } = await this.prizeClaimModel.findAndCountAll({
      where: {
        status,
        ...(query.barId ? { barId: query.barId } : {}),
      },
      include: [
        {
          model: Prize,
          attributes: ['name', 'type', 'value', 'imageUrl'],
          where: { type: PrizeType.JACKPOT }, // solo premios mayores
        },
        { model: User, attributes: ['name', 'phone'] },
        { model: Bar, attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return {
      data: rows.map((claim) => ({
        id: claim.id,
        claimCode: claim.claimCode,
        prize: {
          name: claim.prize.name,
          type: claim.prize.type,
          value: claim.prize.value,
          imageUrl: claim.prize.imageUrl,
        },
        user: {
          name: claim.user.name,
          phone: claim.user.phone,
        },
        bar: claim.bar ? { id: claim.bar.id, name: claim.bar.name } : null,
        createdAt: claim.createdAt,
        expiresAt: claim.expiresAt,
      })),
      total: count,
    };
  }

  /**
   * Entrega de un premio mayor, autorizada por un admin.
   * Mismas validaciones que la entrega del mozo, pero sin restricción de bar
   * (el admin ve todos) y aceptando únicamente premios `type: jackpot`.
   *
   * `delivered_by_id` es FK a staff, así que el admin necesita perfil de staff
   * activo. Si no lo tiene, findActiveByUserId corta con 403.
   */
  async deliverMajorPrize(
    code: string,
    adminUserId: string,
    notes?: string,
  ): Promise<DeliverPrizeResponse> {
    const staff = await this.getStaffByUserId(adminUserId);

    const claim = await this.prizeClaimModel.findOne({
      where: { claimCode: code },
      include: [
        { model: Prize },
        { model: User, attributes: ['id', 'name', 'phone'] },
      ],
    });

    if (!claim) {
      throw new NotFoundException('Código de premio no encontrado.');
    }
    if (claim.status === ClaimStatus.DELIVERED) {
      throw new BadRequestException('Este premio ya fue entregado.');
    }
    if (new Date() > claim.expiresAt) {
      if (claim.status !== ClaimStatus.EXPIRED) {
        await claim.update({ status: ClaimStatus.EXPIRED });
      }
      throw new BadRequestException('Este código de premio ha expirado.');
    }
    if (claim.status !== ClaimStatus.PENDING) {
      throw new BadRequestException(`Código en estado inválido: ${claim.status}`);
    }
    if (claim.prize.type !== PrizeType.JACKPOT) {
      throw new BadRequestException(
        'Este es un premio local: se entrega desde el panel del mozo.',
      );
    }

    await claim.update({
      status: ClaimStatus.DELIVERED,
      deliveredById: staff.id,
      deliveredAt: new Date(),
      notes: notes || null,
    });

    if (claim.prize.stock !== null && claim.prize.stock > 0) {
      await claim.prize.decrement('stock', { by: 1 });
    }

    this.logger.log(
      `🏆 Premio MAYOR entregado - Código: ${code}, Premio: ${claim.prize.name}, ` +
        `Usuario: ${claim.user.phone}, Autorizó: ${staff.id}`,
    );

    return {
      success: true,
      claimCode: claim.claimCode,
      prize: { name: claim.prize.name, value: claim.prize.value },
      user: { name: claim.user.name, phone: claim.user.phone },
      deliveredAt: claim.deliveredAt!,
    };
  }

  // ==================== PRIVADOS ====================

  private getStaffByUserId(userId: string) {
    return this.staffService.findActiveByUserId(userId);
  }
}
