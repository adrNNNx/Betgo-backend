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
import { CreatePlayDto } from '../plays/dto/create-play.dto';

@Controller('game')
export class GameAccessController {
  constructor(private readonly gameAccessService: GameAccessService) {}

  // ==================== ENDPOINTS PÚBLICOS ====================

  /**
   * Info pública del bar (antes del login).
   * GET /game/bar/:slugOrCode/public
   */
  @Public()
  @Get('bar/:slugOrCode/public')
  async getBarPublicInfo(@Param('slugOrCode') slugOrCode: string) {
    return this.gameAccessService.getBarPublicInfo(slugOrCode);
  }

  /**
   * Estado del pozo global (público).
   * GET /game/pool/status
   */
  @Public()
  @Get('pool/status')
  async getPoolStatus() {
    return this.gameAccessService.getGlobalPoolStatus();
  }

  // ==================== ENDPOINTS AUTENTICADOS ====================

  /**
   * Acceder al bar (después del login).
   * GET /game/bar/:slugOrCode
   *
   * Retorna info del bar + jugadas restantes + pozo global.
   */
  @Get('bar/:slugOrCode')
  async accessBar(
    @Param('slugOrCode') slugOrCode: string,
    @CurrentUser() user: User,
  ) {
    return this.gameAccessService.accessBar(slugOrCode, user.id);
  }

  /**
   * Símbolos del bar para mostrar en el juego.
   * GET /game/bar/:slugOrCode/symbols
   */
  @Get('bar/:slugOrCode/symbols')
  async getBarSymbols(@Param('slugOrCode') slugOrCode: string) {
    return this.gameAccessService.getBarSymbolsForDisplay(slugOrCode);
  }

  /**
   * Símbolos globales para mostrar en el juego del pozo global.
   * Solo retorna símbolos sin bar asociado (bar_id IS NULL).
   * GET /game/pool/symbols
   */
  @Get('pool/symbols')
  async getPoolSymbols() {
    return this.gameAccessService.getGlobalSymbolsForDisplay();
  }

  /**
   * Resumen de jugadas del día del usuario.
   * GET /game/my-plays-today
   */
  @Get('my-plays-today')
  async getMyPlaysToday(@CurrentUser() user: User) {
    return this.gameAccessService.getUserDailySummary(user.id);
  }

  // ==================== EJECUTAR JUGADAS ====================

  /**
   * Ejecutar jugada GRATIS.
   * POST /game/play/free
   */
  @Post('play/free')
  @HttpCode(HttpStatus.OK)
  async playFree(
    @Body() dto: CreatePlayDto,
    @CurrentUser() user: User,
  ) {
    return this.gameAccessService.playFree(
      dto.barSlug,
      user.id,
      dto.tableId,
    );
  }

  /**
   * Ejecutar jugada PAGA (premio local del bar).
   * POST /game/play/paid
   */
  @Post('play/paid')
  @HttpCode(HttpStatus.OK)
  async playPaid(
    @Body() dto: CreatePlayDto,
    @CurrentUser() user: User,
  ) {
    return this.gameAccessService.playPaid(
      dto.barSlug,
      user.id,
      dto.tableId,
    );
  }

  /**
   * Ejecutar jugada por el POZO GLOBAL.
   * POST /game/play/pool
   */
  @Post('play/pool')
  @HttpCode(HttpStatus.OK)
  async playPool(
    @Body() dto: CreatePlayDto,
    @CurrentUser() user: User,
  ) {
    return this.gameAccessService.playPool(
      dto.barSlug,
      user.id,
      dto.tableId,
    );
  }
}
