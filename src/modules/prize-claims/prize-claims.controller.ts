// src/modules/prize-claims/prize-claims.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrizeClaimsService } from './prize-claims.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { User, UserRole } from '../users/entities/user.entity';
import { ValidateClaimDto, DeliverPrizeDto } from './dto/prize-claim.dto';
import { ClaimStatus } from './entities/prize-claim.entity';

@Controller('prize-claims')
export class PrizeClaimsController {
  constructor(private readonly prizeClaimsService: PrizeClaimsService) {}

  /**
   * Validar código de premio (mozo escanea o ingresa manualmente).
   * POST /prize-claims/validate
   *
   * Solo STAFF y ADMIN.
   * Verifica que el premio sea local y del bar del mozo.
   * Retorna info del premio y del usuario para confirmar.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async validateClaimCode(
    @Body() dto: ValidateClaimDto,
    @CurrentUser() user: User,
  ) {
    return this.prizeClaimsService.validateClaimCode(dto.code, user.id);
  }

  /**
   * Marcar premio como entregado.
   * POST /prize-claims/deliver
   *
   * Solo STAFF y ADMIN.
   * Registra quién entregó, cuándo, y decrementa stock.
   */
  @Post('deliver')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async deliverPrize(
    @Body() dto: DeliverPrizeDto,
    @CurrentUser() user: User,
  ) {
    return this.prizeClaimsService.deliverPrize(
      dto.code,
      user.id,
      dto.notes,
    );
  }

  /**
   * Listar premios pendientes del bar del mozo.
   * GET /prize-claims/pending
   *
   * Solo STAFF y ADMIN.
   * Retorna premios locales pendientes de entregar.
   * Auto-expira los vencidos.
   */
  @Get('pending')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async getPendingClaims(@CurrentUser() user: User) {
    return this.prizeClaimsService.getPendingByBar(user.id);
  }

  /**
   * Premios MAYORES (type=jackpot) pendientes, de todos los bares.
   * GET /prize-claims/major?barId=&status=&limit=&offset=  →  { data, total }
   *
   * Solo ADMIN. Son los premios grandes del catálogo que el mozo no puede
   * entregar. El pozo global no aparece acá: se acredita al saldo y no genera claim.
   */
  @Get('major')
  @Roles(UserRole.ADMIN)
  async getMajorClaims(
    @Query('barId') barId?: string,
    @Query('status') status?: ClaimStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.prizeClaimsService.getMajorClaims({
      barId: barId || undefined,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * Entregar un premio mayor. POST /prize-claims/major/deliver
   * Solo ADMIN. Requiere que el admin tenga perfil de staff activo,
   * porque delivered_by_id apunta a staff.
   */
  @Post('major/deliver')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async deliverMajorPrize(
    @Body() dto: DeliverPrizeDto,
    @CurrentUser() user: User,
  ) {
    return this.prizeClaimsService.deliverMajorPrize(
      dto.code,
      user.id,
      dto.notes,
    );
  }
}
