// src/modules/recharge-codes/recharge-codes.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RechargeCode, CodeStatus } from './entities/recharge-code.entity';
import { User } from '../users/entities/user.entity';
import { Staff } from '../staff/entities/staff.entity';
import {
  Transaction,
  TransactionType,
  PaymentMethod,
} from '../transactions/entities/transaction.entity';

// ==================== CONSTANTES ====================

/** Tiempo de vida del código en segundos (1 minuto 30 segundos) */
const CODE_TTL_SECONDS = 90;

// ==================== INTERFACES ====================

export interface GenerateCodeResponse {
  code: string;
  qrData: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface CodeStatusResponse {
  status: CodeStatus;
  expiresAt: string;
  expiresInSeconds: number;
  isExpired: boolean;
  /** Solo presente cuando status = 'used' */
  amountLoaded?: number;
}

export interface ValidateCodeResponse {
  codeId: string;
  code: string;
  user: {
    id: string;
    name: string | null;
    phone: string;
    balance: number;
  };
  expiresAt: string;
  expiresInSeconds: number;
}

export interface LoadBalanceResponse {
  success: boolean;
  amountLoaded: number;
  user: {
    id: string;
    name: string | null;
    newBalance: number;
  };
  transactionId: string;
}

@Injectable()
export class RechargeCodesService {
  private readonly logger = new Logger(RechargeCodesService.name);

  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(RechargeCode)
    private readonly rechargeCodeModel: typeof RechargeCode,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Staff)
    private readonly staffModel: typeof Staff,
    @InjectModel(Transaction)
    private readonly transactionModel: typeof Transaction,
  ) {}

  // ==================== GENERAR CÓDIGO (USUARIO) ====================

  /**
   * Genera un código de recarga para el usuario.
   *
   * REGLAS:
   * - Invalida cualquier código pendiente previo del mismo usuario
   * - Genera un código alfanumérico de 8 caracteres (vía BeforeCreate hook)
   * - El código expira en 90 segundos
   * - El qrData contiene JSON con code + userId + type
   */
  async generateCode(userId: string): Promise<GenerateCodeResponse> {
    // Verificar que el usuario existe
    const user = await this.userModel.findByPk(userId);
    if (!user || !user.isActive) {
      throw new ForbiddenException('Usuario no encontrado o inactivo');
    }

    // Invalidar códigos pendientes anteriores del usuario
    await this.rechargeCodeModel.update(
      { status: CodeStatus.EXPIRED },
      {
        where: {
          userId,
          status: CodeStatus.PENDING,
        },
      },
    );

    // Generar código y qrData explícitamente (no depender del hook)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(randomInt(0, chars.length));
    }
    const qrData = JSON.stringify({ code, userId, type: 'recharge' });

    // Crear nuevo código con expiración de 90 segundos
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + CODE_TTL_SECONDS);

    const rechargeCode = await this.rechargeCodeModel.create({
      userId,
      expiresAt,
      code,
      qrData,
    });

    this.logger.log(
      `Código generado: ${rechargeCode.code} para usuario ${userId}, expira en ${CODE_TTL_SECONDS}s`,
    );

    return {
      code: rechargeCode.code,
      qrData: rechargeCode.qrData,
      expiresAt: rechargeCode.expiresAt.toISOString(),
      expiresInSeconds: CODE_TTL_SECONDS,
    };
  }

  // ==================== CONSULTAR ESTADO (POLLING DEL USUARIO) ====================

  /**
   * Retorna el estado actual de un código.
   * El frontend hace polling cada ~3 segundos.
   *
   * Si el código está pending pero ya expiró por tiempo,
   * lo marca como expired automáticamente.
   *
   * Cuando el mozo carga saldo, el status cambia a 'used'
   * y el frontend detecta el cambio → muestra pantalla de éxito.
   */
  async getCodeStatus(
    code: string,
    userId: string,
  ): Promise<CodeStatusResponse> {
    const rechargeCode = await this.rechargeCodeModel.findOne({
      where: { code },
    });

    if (!rechargeCode) {
      throw new NotFoundException('Código no encontrado');
    }

    // Verificar que el código pertenece al usuario que consulta
    if (rechargeCode.userId !== userId) {
      throw new ForbiddenException('Este código no te pertenece');
    }

    // Si está pending pero ya pasó el tiempo → marcar como expired
    if (
      rechargeCode.status === CodeStatus.PENDING &&
      new Date() > rechargeCode.expiresAt
    ) {
      await rechargeCode.update({ status: CodeStatus.EXPIRED });
    }

    const now = new Date();
    const expiresInMs = rechargeCode.expiresAt.getTime() - now.getTime();
    const expiresInSeconds = Math.max(0, Math.floor(expiresInMs / 1000));

    return {
      status: rechargeCode.status,
      expiresAt: rechargeCode.expiresAt.toISOString(),
      expiresInSeconds,
      isExpired:
        rechargeCode.status === CodeStatus.EXPIRED || expiresInSeconds <= 0,
      amountLoaded:
        rechargeCode.status === CodeStatus.USED
          ? rechargeCode.amountLoaded ?? undefined
          : undefined,
    };
  }

  // ==================== VALIDAR CÓDIGO (MOZO) ====================

  /**
   * El mozo escanea o ingresa el código manualmente.
   * El sistema valida que:
   * - El código existe
   * - Está en estado pending
   * - No ha expirado
   * - El usuario es válido
   *
   * Retorna la info del usuario para que el mozo confirme la identidad.
   */
  async validateCode(code: string): Promise<ValidateCodeResponse> {
    const rechargeCode = await this.rechargeCodeModel.findOne({
      where: { code },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'phone', 'balance', 'isActive'],
        },
      ],
    });

    if (!rechargeCode) {
      throw new NotFoundException(
        'Código no encontrado. Verifica e intenta de nuevo.',
      );
    }

    // Verificar que no esté usado
    if (rechargeCode.status === CodeStatus.USED) {
      throw new BadRequestException('Este código ya fue utilizado.');
    }

    // Verificar expiración
    if (new Date() > rechargeCode.expiresAt) {
      // Marcar como expirado si aún no lo está
      if (rechargeCode.status !== CodeStatus.EXPIRED) {
        await rechargeCode.update({ status: CodeStatus.EXPIRED });
      }
      throw new BadRequestException(
        'Este código ha expirado. El usuario debe generar uno nuevo.',
      );
    }

    // Verificar que esté pending
    if (rechargeCode.status !== CodeStatus.PENDING) {
      throw new BadRequestException(
        `Código en estado inválido: ${rechargeCode.status}`,
      );
    }

    // Verificar usuario
    if (!rechargeCode.user || !rechargeCode.user.isActive) {
      throw new BadRequestException('El usuario asociado no está activo.');
    }

    const now = new Date();
    const expiresInSeconds = Math.max(
      0,
      Math.floor((rechargeCode.expiresAt.getTime() - now.getTime()) / 1000),
    );

    this.logger.log(
      `Código ${code} validado por mozo. Usuario: ${rechargeCode.user.phone}`,
    );

    return {
      codeId: rechargeCode.id,
      code: rechargeCode.code,
      user: {
        id: rechargeCode.user.id,
        name: rechargeCode.user.name,
        phone: rechargeCode.user.phone,
        balance: rechargeCode.user.balance,
      },
      expiresAt: rechargeCode.expiresAt.toISOString(),
      expiresInSeconds,
    };
  }

  // ==================== CARGAR SALDO (MOZO) ====================

  /**
   * Carga de saldo atómica.
   *
   * FLUJO:
   * 1. Re-validar código (puede haber expirado entre validate y load)
   * 2. Verificar staff válido y asignado a un bar
   * 3. TRANSACCIÓN ATÓMICA:
   *    - Lock user para evitar race conditions
   *    - Acreditar saldo al usuario
   *    - Marcar código como usado
   *    - Crear transacción de tipo RECHARGE
   * 4. Si falla → rollback completo
   */
  async loadBalance(
    code: string,
    amount: number,
    paymentMethod: PaymentMethod,
    staffUserId: string,
    notes?: string,
  ): Promise<LoadBalanceResponse> {
    // === Validar código ===
    const rechargeCode = await this.rechargeCodeModel.findOne({
      where: { code },
    });

    if (!rechargeCode) {
      throw new NotFoundException('Código no encontrado.');
    }

    if (rechargeCode.status !== CodeStatus.PENDING) {
      throw new BadRequestException(
        `El código ya no es válido (estado: ${rechargeCode.status}).`,
      );
    }

    if (new Date() > rechargeCode.expiresAt) {
      await rechargeCode.update({ status: CodeStatus.EXPIRED });
      throw new BadRequestException(
        'El código ha expirado. El usuario debe generar uno nuevo.',
      );
    }

    // === Validar staff (buscar por userId del JWT) ===
    const staff = await this.staffModel.findOne({
      where: { userId: staffUserId, isActive: true },
    });
    if (!staff) {
      throw new ForbiddenException(
        'No tienes permisos de staff o tu cuenta está inactiva.',
      );
    }
    if (!staff.barId) {
      throw new ForbiddenException('No tienes un bar asignado.');
    }

    // === Transacción atómica ===
    const txResult = await this.sequelize.transaction(async (transaction) => {
      // Lock del usuario
      const user = await this.userModel.findByPk(rechargeCode.userId, {
        transaction,
        lock: true,
      });

      if (!user || !user.isActive) {
        throw new BadRequestException('Usuario no encontrado o inactivo.');
      }

      // Lock del mozo: el saldo que carga sale de su float asignado por el
      // admin. No puede cargar más de lo que tiene.
      const staffLocked = await this.staffModel.findByPk(staff.id, {
        transaction,
        lock: true,
      });
      if (!staffLocked) {
        throw new ForbiddenException('Tu cuenta de staff no está disponible.');
      }
      const staffBalance = Number(staffLocked.balance);
      if (amount > staffBalance) {
        throw new BadRequestException(
          `Saldo insuficiente. Tu saldo asignado es Gs. ${staffBalance.toLocaleString('es-PY')}.`,
        );
      }

      const balanceBefore = user.balance;

      // 1) Descontar del saldo del mozo y acreditar al usuario
      await staffLocked.decrement('balance', { by: amount, transaction });
      await user.increment('balance', { by: amount, transaction });
      await user.reload({ transaction });

      // 2) Marcar código como usado
      await rechargeCode.update(
        {
          status: CodeStatus.USED,
          usedAt: new Date(),
          usedByStaffId: staff.id,
          amountLoaded: amount,
        },
        { transaction },
      );

      // 3) Crear transacción
      const tx = await this.transactionModel.create(
        {
          userId: user.id,
          barId: staff.barId ?? undefined,
          staffId: staff.id,
          type: TransactionType.RECHARGE,
          amount,
          balanceBefore,
          balanceAfter: user.balance,
          paymentMethod,
          notes: notes || `Recarga por código ${code}`,
        },
        { transaction },
      );

      return { user, transactionId: tx.id };
    });

    this.logger.log(
      `💰 Recarga exitosa - Código: ${code}, Monto: Gs. ${amount.toLocaleString()}, ` +
        `Usuario: ${txResult.user.phone}, Staff: ${staff.id}`,
    );

    return {
      success: true,
      amountLoaded: amount,
      user: {
        id: txResult.user.id,
        name: txResult.user.name,
        newBalance: txResult.user.balance,
      },
      transactionId: txResult.transactionId,
    };
  }
}
