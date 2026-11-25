// src/modules/user-daily-plays/user-daily-plays.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { UserDailyPlaysService } from './user-daily-plays.service';
import { ResetFreePlaysDto } from './dto/reset-free-plays.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('user-daily-plays')
export class UserDailyPlaysController {
  constructor(
    private readonly userDailyPlaysService: UserDailyPlaysService,
  ) {}

  /**
   * Obtener resumen de jugadas del día del usuario en todos los bares.
   * GET /user-daily-plays/my-summary
   */
  @Get('my-summary')
  async getMySummary(@CurrentUser() user: User) {
    return this.userDailyPlaysService.getUserDailySummary(user.id);
  }

  /**
   * Obtener historial de jugadas diarias en un bar.
   * GET /user-daily-plays/history/:barId
   */
  @Get('history/:barId')
  async getBarHistory(
    @CurrentUser() user: User,
    @Param('barId') barId: string,
  ) {
    return this.userDailyPlaysService.getUserBarHistory(user.id, barId);
  }

  // ==================== ADMIN ====================

  /**
   * Jugadas gratis de HOY de un jugador, por bar.
   * GET /user-daily-plays/users/:userId/today
   */
  @Get('users/:userId/today')
  @Roles(UserRole.ADMIN)
  getUserToday(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userDailyPlaysService.getTodayForUser(userId);
  }

  /**
   * Resetear las jugadas gratis de HOY de un jugador, en un bar o en todos.
   * POST /user-daily-plays/users/:userId/reset   { barId?, reason? }
   * El userId del jugador va en la ruta; el del admin sale del token.
   */
  @Post('users/:userId/reset')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  resetFreePlays(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ResetFreePlaysDto,
    @CurrentUser() admin: User,
    @Ip() ipAddress: string,
  ) {
    return this.userDailyPlaysService.resetFreePlays({
      userId,
      barId: dto.barId,
      reason: dto.reason,
      adminUserId: admin.id,
      ipAddress,
    });
  }
}
