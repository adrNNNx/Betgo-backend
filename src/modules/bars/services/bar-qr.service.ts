// src/modules/bars/services/bar-qr.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { Bar } from '../entities/bar.entity';
import * as QRCode from 'qrcode';

export interface BarQRData {
  barId: string;
  slug: string;
  accessCode: string;
  url: string;
  qrDataUrl: string; // Base64 del QR
}

@Injectable()
export class BarQRService {
  private readonly baseUrl: string;

  constructor(
    @InjectModel(Bar)
    private barModel: typeof Bar,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:4200');
  }

  /**
   * Generar URL de acceso al juego para un bar
   */
  generateBarUrl(bar: Bar): string {
    // URL que el usuario visitará al escanear el QR
    // Puede ser por slug (más legible) o por accessCode (más seguro)
    return `${this.baseUrl}/play/${bar.slug}`;
  }

  /**
   * Generar código QR para un bar
   */
  async generateQRCode(barId: string): Promise<BarQRData> {
    const bar = await this.barModel.findByPk(barId);

    if (!bar) {
      throw new NotFoundException('Bar no encontrado');
    }

    const url = this.generateBarUrl(bar);

    // Generar QR como Data URL (base64)
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H', // Alto nivel de corrección de errores
    });

    return {
      barId: bar.id,
      slug: bar.slug,
      accessCode: bar.accessCode,
      url,
      qrDataUrl,
    };
  }

  /**
   * Generar QR como buffer PNG (para descargar)
   */
  async generateQRCodeBuffer(barId: string): Promise<Buffer> {
    const bar = await this.barModel.findByPk(barId);

    if (!bar) {
      throw new NotFoundException('Bar no encontrado');
    }

    const url = this.generateBarUrl(bar);

    return QRCode.toBuffer(url, {
      width: 800,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  }

  /**
   * Generar QR como SVG (para alta calidad)
   */
  async generateQRCodeSVG(barId: string): Promise<string> {
    const bar = await this.barModel.findByPk(barId);

    if (!bar) {
      throw new NotFoundException('Bar no encontrado');
    }

    const url = this.generateBarUrl(bar);

    return QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'H',
    });
  }

  /**
   * Regenerar código de acceso de un bar
   */
  async regenerateAccessCode(barId: string): Promise<Bar> {
    const bar = await this.barModel.findByPk(barId);

    if (!bar) {
      throw new NotFoundException('Bar no encontrado');
    }

    // Generar nuevo código
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = '';
    for (let i = 0; i < 8; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    await bar.update({ accessCode: newCode });

    return bar;
  }

  /**
   * Obtener todos los bares con sus URLs de QR
   */
  async getAllBarsWithQR(): Promise<BarQRData[]> {
    const bars = await this.barModel.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });

    const results: BarQRData[] = [];

    for (const bar of bars) {
      const url = this.generateBarUrl(bar);
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      results.push({
        barId: bar.id,
        slug: bar.slug,
        accessCode: bar.accessCode,
        url,
        qrDataUrl,
      });
    }

    return results;
  }
}
