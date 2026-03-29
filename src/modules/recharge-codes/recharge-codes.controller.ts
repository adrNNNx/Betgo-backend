// src/modules/recharge-codes/recharge-codes.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RechargeCodesService } from './recharge-codes.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { User, UserRole } from '../users/entities/user.entity';
import { ValidateCodeDto, LoadBalanceDto } from './dto/recharge-code.dto';

@Controller('recharge-codes')
export class RechargeCodesController {
  constructor(
    private readonly rechargeCodesService: RechargeCodesService,
  ) {}

  // ==================== ENDPOINTS DEL USUARIO ====================

  /**
   * Generar código de recarga.
   * POST /recharge-codes/generate
   *
   * El usuario genera un código QR que el mozo escanea.
   * Invalida cualquier código pendiente anterior del usuario.
   * El código expira en 90 segundos.
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateCode(@CurrentUser() user: User) {
    return this.rechargeCodesService.generateCode(user.id);
  }

  /**
   * Consultar estado de un código (polling).
   * GET /recharge-codes/status/:code
   *
   * El frontend hace polling cada ~3s para detectar cuando
   * el mozo carga el saldo (status cambia de 'pending' a 'used').
   */
  @Get('status/:code')
  async getCodeStatus(
    @Param('code') code: string,
    @CurrentUser() user: User,
  ) {
    return this.rechargeCodesService.getCodeStatus(code, user.id);
  }

  // ==================== ENDPOINTS DEL MOZO ====================

  /**
   * Validar código de recarga (mozo escanea o ingresa manualmente).
   * POST /recharge-codes/validate
   *
   * Solo accesible para STAFF y ADMIN.
   * Retorna info del usuario para que el mozo confirme la identidad.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async validateCode(@Body() dto: ValidateCodeDto) {
    return this.rechargeCodesService.validateCode(dto.code);
  }

  /**
   * Ejecutar carga de saldo (mozo confirma).
   * POST /recharge-codes/load
   *
   * Solo accesible para STAFF y ADMIN.
   * Transacción atómica: acredita saldo, marca código como usado,
   * registra la transacción.
   */
  @Post('load')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async loadBalance(
    @Body() dto: LoadBalanceDto,
    @CurrentUser() user: User,
  ) {
    // El user aquí es el staff autenticado — buscar su staffId
    // En el flujo actual, el staff se autentica con su usuario vinculado
    return this.rechargeCodesService.loadBalance(
      dto.code,
      dto.amount,
      dto.paymentMethod,
      user.id, // Se usa como staffId lookup en el service
      dto.notes,
    );
  }
}
