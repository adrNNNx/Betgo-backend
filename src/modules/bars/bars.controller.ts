// src/modules/bars/bars.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BarsService } from './bars.service';
import { BarQRService } from './services/bar-qr.service';
import { CreateBarDto } from './dto/create-bar.dto';
import { UpdateBarDto } from './dto/update-bar.dto';
import { RechargeBarDto } from './dto/recharge-bar.dto';
import { ImageFilePipe } from '../banners/pipes/image-file.pipe';
import { Public, Roles } from '../auth/decorators';
import { UserRole } from '../users/entities/user.entity';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB — corte temprano en multer

@Controller('bars')
export class BarsController {
  constructor(
    private readonly barsService: BarsService,
    private readonly barQRService: BarQRService,
  ) {}

  // ==================== CRUD DE BARES ====================

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() createBarDto: CreateBarDto) {
    return this.barsService.create(createBarDto);
  }

  @Public()
  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.barsService.findAll(includeInactive === 'true');
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.barsService.findOne(id);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.barsService.findBySlug(slug);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBarDto: UpdateBarDto,
  ) {
    return this.barsService.update(id, updateBarDto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.barsService.remove(id);
  }

  // ==================== OPERACIONES DE BAR ====================

  /**
   * Recargar saldo del bar. El monto se distribuye según los porcentajes
   * del bar (bar / pozo / empresa). Devuelve el desglose aplicado.
   * POST /bars/:id/recharge  { amount, notes? }
   */
  @Roles(UserRole.ADMIN)
  @Post(':id/recharge')
  rechargeBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RechargeBarDto,
  ) {
    return this.barsService.rechargeBalance(
      id,
      dto.amount,
      dto.notes,
      dto.currency,
    );
  }

  /**
   * Previsualizar el desglose de una recarga sin aplicarla (para el diálogo).
   * GET /bars/:id/recharge/preview?amount=50000
   */
  @Roles(UserRole.ADMIN)
  @Get(':id/recharge/preview')
  previewRecharge(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('amount') amount: string,
  ) {
    return this.barsService.previewRecharge(id, Number(amount));
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/free-plays')
  updateFreePlays(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { freePlaysPerDay: number },
  ) {
    return this.barsService.updateFreePlays(id, body.freePlaysPerDay);
  }

  /**
   * Subir/reemplazar el logo del bar.
   * PATCH /bars/:id/logo  (multipart/form-data, campo 'file')
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  updateLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(ImageFilePipe) file: Express.Multer.File,
  ) {
    return this.barsService.updateLogo(id, file);
  }

  @Get(':id/stats')
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.barsService.getStats(id);
  }

  // ==================== QR CODES ====================

  /**
   * Obtener QR del bar como JSON (incluye base64)
   */
  @Get(':id/qr')
  getQRCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.barQRService.generateQRCode(id);
  }

  /**
   * Descargar QR como imagen PNG
   */
  @Public()
  @Get(':id/qr/download')
  async downloadQRCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const bar = await this.barsService.findOne(id);
    const buffer = await this.barQRService.generateQRCodeBuffer(id);

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${bar.slug}.png"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  /**
   * Obtener QR como SVG (alta calidad)
   */
  @Public()
  @Get(':id/qr/svg')
  async getQRCodeSVG(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const svg = await this.barQRService.generateQRCodeSVG(id);

    res.set({
      'Content-Type': 'image/svg+xml',
    });

    res.send(svg);
  }

  /**
   * Regenerar código de acceso del bar
   */
  @Roles(UserRole.ADMIN)
  @Post(':id/regenerate-code')
  regenerateAccessCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.barQRService.regenerateAccessCode(id);
  }

  /**
   * Obtener todos los bares con sus QRs
   */
  @Roles(UserRole.ADMIN)
  @Get('admin/all-qr')
  getAllBarsWithQR() {
    return this.barQRService.getAllBarsWithQR();
  }

  /**
   * KPIs del módulo de bares: ganancia de la empresa y aporte al pozo
   * (total y por bar). Rango de fechas opcional.
   * GET /bars/admin/kpis?from=2026-06-01&to=2026-06-30
   */
  @Roles(UserRole.ADMIN)
  @Get('admin/kpis')
  getPlatformKpis(@Query('from') from?: string, @Query('to') to?: string) {
    return this.barsService.getPlatformKpis(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
