// src/modules/plays/plays.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlaysService } from './plays.service';
import { CurrentUser } from '../auth/decorators';
import { User } from '../users/entities/user.entity';

@Controller('plays')
export class PlaysController {
  constructor(private readonly playsService: PlaysService) {}

  /**
   * Obtener historial de jugadas del usuario.
   * GET /plays/my-history?barId=xxx&limit=50
   */
  @Get('my-history')
  async getMyHistory(
    @CurrentUser() user: User,
    @Query('barId') barId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.playsService.getUserPlayHistory(
      user.id,
      barId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
