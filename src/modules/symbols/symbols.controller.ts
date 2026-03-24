// src/modules/symbols/symbols.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SymbolsService } from './symbols.service';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';

@Controller('symbols')
export class SymbolsController {
  constructor(private readonly symbolsService: SymbolsService) {}

  /**
   * Crear símbolo.
   * POST /symbols
   *
   * Si barId es null → global (isJackpot = true automáticamente).
   * Si barId tiene valor → local del bar (isJackpot = false).
   */
  @Post()
  create(@Body() dto: CreateSymbolDto) {
    return this.symbolsService.create(dto);
  }

  /**
   * Listar símbolos con filtros opcionales.
   * GET /symbols?barId=xxx&isActive=true&isGlobal=true
   */
  @Get()
  findAll(
    @Query('barId') barId?: string,
    @Query('isActive') isActive?: string,
    @Query('isGlobal') isGlobal?: string,
  ) {
    return this.symbolsService.findAll({
      barId: barId || undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      isGlobal: isGlobal !== undefined ? isGlobal === 'true' : undefined,
    });
  }

  /**
   * Obtener símbolos de un bar (globales + locales activos).
   * GET /symbols/bar/:barId
   */
  @Get('bar/:barId')
  findByBar(@Param('barId', ParseUUIDPipe) barId: string) {
    return this.symbolsService.findByBar(barId);
  }

  /**
   * Obtener solo símbolos globales (pozo).
   * GET /symbols/global
   */
  @Get('global')
  findGlobal() {
    return this.symbolsService.findGlobal();
  }

  /**
   * Obtener un símbolo por ID.
   * GET /symbols/:id
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.symbolsService.findOne(id);
  }

  /**
   * Actualizar símbolo.
   * PATCH /symbols/:id
   *
   * Si barId cambia, isJackpot se recalcula automáticamente.
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSymbolDto,
  ) {
    return this.symbolsService.update(id, dto);
  }

  /**
   * Activar/desactivar símbolo.
   * PATCH /symbols/:id/toggle
   */
  @Patch(':id/toggle')
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.symbolsService.toggleActive(id);
  }

  /**
   * Eliminar símbolo.
   * DELETE /symbols/:id
   */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.symbolsService.remove(id);
  }
}
