// src/modules/game-access/game-access.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GameAccessService } from './game-access.service';
import { Public, CurrentUser } from '../auth/decorators';
import { User } from '../users/entities/user.entity';

// ==================== DTOs ====================

class PlayRequestDto {
  barSlug: string;
  tableId?: string;
}

// ==================== CONTROLLER ====================

@Controller('game')
export class GameAccessController {
  constructor(private readonly gameAccessService: GameAccessService) {}

  // ==================== ENDPOINTS PÚBLICOS (Sin Auth) ====================

  /**
   * Obtener info pública del bar (antes del login)
   * GET /game/bar/:slugOrCode/public
   *
   * El usuario escanea el QR y ve el logo/nombre del bar
   * antes de hacer login/registro
   */
  @Public()
  @Get('bar/:slugOrCode/public')
  async getBarPublicInfo(@Param('slugOrCode') slugOrCode: string) {
    return this.gameAccessService.getBarPublicInfo(slugOrCode);
  }

  /**
   * Estado del pozo global (público)
   * GET /game/pool/status
   */
  @Public()
  @Get('pool/status')
  async getPoolStatus() {
    return this.gameAccessService.getGlobalPoolStatus();
  }

  // ==================== ENDPOINTS AUTENTICADOS ====================

  /**
   * Acceder al bar (después del login)
   * GET /game/bar/:slugOrCode
   *
   * Retorna la info completa del bar + jugadas restantes del usuario
   */
  @Get('bar/:slugOrCode')
  async accessBar(
    @Param('slugOrCode') slugOrCode: string,
    @CurrentUser() user: User,
  ) {
    return this.gameAccessService.accessBar(slugOrCode, user.id);
  }

  /**
   * Obtener símbolos del bar para mostrar en el juego
   * GET /game/bar/:slugOrCode/symbols
   */
  @Get('bar/:slugOrCode/symbols')
  async getBarSymbols(@Param('slugOrCode') slugOrCode: string) {
    return this.gameAccessService.getBarSymbolsForDisplay(slugOrCode);
  }

  /**
   * Ver resumen de jugadas del día del usuario
   * GET /game/my-plays-today
   */
  @Get('my-plays-today')
  async getMyPlaysToday(@CurrentUser() user: User) {
    return this.gameAccessService.getUserDailySummary(user.id);
  }

  // ==================== EJECUTAR JUGADAS ====================

  /**
   * Ejecutar jugada GRATIS
   * POST /game/play/free
   */
  @Post('play/free')
  @HttpCode(HttpStatus.OK)
  async playFree(
    @Body() playRequest: PlayRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.gameAccessService.playFree(
      playRequest.barSlug,
      user.id,
      playRequest.tableId,
    );
  }

  /**
   * Ejecutar jugada PAGA (premio local del bar)
   * POST /game/play/paid
   */
  @Post('play/paid')
  @HttpCode(HttpStatus.OK)
  async playPaid(
    @Body() playRequest: PlayRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.gameAccessService.playPaid(
      playRequest.barSlug,
      user.id,
      playRequest.tableId,
    );
  }

  /**
   * Ejecutar jugada por el POZO GLOBAL
   * POST /game/play/pool
   */
  @Post('play/pool')
  @HttpCode(HttpStatus.OK)
  async playPool(
    @Body() playRequest: PlayRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.gameAccessService.playPool(
      playRequest.barSlug,
      user.id,
      playRequest.tableId,
    );
  }
}
