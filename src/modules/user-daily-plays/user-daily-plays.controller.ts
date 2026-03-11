// src/modules/user-daily-plays/user-daily-plays.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { UserDailyPlaysService } from './user-daily-plays.service';
import { CurrentUser } from '../auth/decorators';
import { User } from '../users/entities/user.entity';

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
}
