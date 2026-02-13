// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Delete,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard, JwtAuthGuard, RolesGuard } from './guards';
import { Public, CurrentUser, Roles } from './decorators';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ChangePasswordDto,
} from './dto';
import { User } from '../users/entities/user.entity';
import {
  LoginResponse,
  RefreshResponse,
} from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== REGISTRO ====================

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
  ): Promise<LoginResponse> {
    const ipAddress = this.getIpAddress(req);
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.register(registerDto);

    // Guardar refresh token con info del dispositivo
    // (ya se hace en el servicio, pero podemos agregar más contexto)

    return result;
  }

  // ==================== LOGIN ====================

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 intentos por minuto
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ): Promise<LoginResponse> {
    const ipAddress = this.getIpAddress(req);
    const userAgent = req.headers['user-agent'];
    const deviceInfo = loginDto.deviceInfo;

    return this.authService.login(user, ipAddress, userAgent, deviceInfo);
  }

  // ==================== REFRESH TOKEN ====================

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 por minuto
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<RefreshResponse> {
    const ipAddress = this.getIpAddress(req);
    const userAgent = req.headers['user-agent'];

    return this.authService.refreshTokens(
      refreshTokenDto.refreshToken,
      ipAddress,
      userAgent,
    );
  }

  // ==================== LOGOUT ====================

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(refreshTokenDto.refreshToken);
    return { message: 'Sesión cerrada exitosamente' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string }> {
    await this.authService.logoutAll(userId);
    return { message: 'Todas las sesiones cerradas exitosamente' };
  }

  // ==================== PERFIL ====================

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: User): Promise<User | null> {
    return this.authService.getUserById(user.id);
  }

  // ==================== CAMBIO DE CONTRASEÑA ====================

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(userId, changePasswordDto);
    return { message: 'Contraseña actualizada exitosamente' };
  }

  // ==================== GESTIÓN DE SESIONES ====================

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  async getActiveSessions(@CurrentUser('id') userId: string) {
    const sessions = await this.authService.getActiveSessions(userId);
    return {
      count: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
      })),
    };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<{ message: string }> {
    await this.authService.revokeSession(userId, sessionId);
    return { message: 'Sesión revocada exitosamente' };
  }

  // ==================== VERIFICACIÓN DE TOKEN ====================

  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verifyToken(
    @CurrentUser() user: User,
  ): Promise<{ valid: boolean; user: any }> {
    return {
      valid: true,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  // ==================== UTILIDADES ====================

  private getIpAddress(req: Request): string {
    // Obtener IP real considerando proxies
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
