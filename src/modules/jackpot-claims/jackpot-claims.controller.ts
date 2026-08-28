import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { JackpotClaimsService } from './jackpot-claims.service';
import { JackpotClaimStatus } from './entities/jackpot-claim.entity';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('jackpot-claims')
export class JackpotClaimsController {
  constructor(private readonly service: JackpotClaimsService) {}

  // ==================== JUGADOR ====================

  /**
   * Comprobantes de pozo del usuario autenticado.
   * GET /jackpot-claims/my?limit=&offset=  →  { data, total }
   *
   * Sin @Roles: requiere JWT válido, cualquier rol (guards globales).
   */
  @Get('my')
  getMyClaims(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getMyClaims(user.id, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * El ganador avisa que contactó a administración: pending_contact → in_review.
   * POST /jackpot-claims/:folio/contact
   */
  @Post(':folio/contact')
  @HttpCode(HttpStatus.OK)
  async markContacted(
    @Param('folio') folio: string,
    @CurrentUser() user: User,
  ) {
    const claim = await this.service.markContacted(folio, user.id);
    return {
      folio: claim.folio,
      status: claim.status,
      contactedAt: claim.contactedAt,
    };
  }

  // ==================== ADMIN ====================

  /**
   * Pozos ganados pendientes de resolver. GET /jackpot-claims?status=&limit=&offset=
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('status') status?: JackpotClaimStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.findAll({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * Badge del panel: cuántos pozos esperan resolución y cuánto se adeuda.
   * GET /jackpot-claims/pending-count
   */
  @Get('pending-count')
  @Roles(UserRole.ADMIN)
  getPendingCount() {
    return this.service.getPendingCount();
  }

  /**
   * Marcar el pozo como pagado. POST /jackpot-claims/:folio/pay
   * Requiere perfil de staff activo (paid_by_id apunta a staff).
   */
  @Post(':folio/pay')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async markPaid(
    @Param('folio') folio: string,
    @Body() dto: MarkPaidDto,
    @CurrentUser() user: User,
  ) {
    const claim = await this.service.markPaid(folio, user.id, dto.notes);
    return {
      folio: claim.folio,
      status: claim.status,
      amount: claim.amount,
      paidAt: claim.paidAt,
    };
  }
}
