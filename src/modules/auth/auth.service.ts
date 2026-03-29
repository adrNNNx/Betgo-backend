// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto, ChangePasswordDto } from './dto';
import {
  JwtPayload,
  TokenPair,
  LoginResponse,
  RefreshResponse,
  AuthenticatedUser,
} from './interfaces/jwt-payload.interface';
import { AUTH_CONSTANTS } from './constants/auth.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(RefreshToken)
    private refreshTokenModel: typeof RefreshToken,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ==================== VALIDACIÓN DE USUARIO ====================

  async validateUser(phone: string, password: string): Promise<User | null> {
    const dbPhone = this.formatPhoneForDB(phone);

    const user = await this.userModel.findOne({
      where: { phone: dbPhone },
    });

    if (!user) {
      this.logger.warn(`Intento de login fallido para: ${phone}`);
      return null;
    }

    if (!user.isActive) {
      this.logger.warn(`Intento de login de usuario inactivo: ${phone}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      this.logger.warn(`Contraseña incorrecta para: ${phone}`);
      return null;
    }

    return user;
  }

  // ==================== LOGIN ====================

  async login(
    user: User,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: string,
  ): Promise<LoginResponse> {
    const refreshToken = this.generateRefreshTokenString();

    const refreshTokenRecord = await this.saveRefreshToken(
      user.id,
      refreshToken,
      ipAddress,
      userAgent,
      deviceInfo,
    );

    const accessToken = this.generateAccessToken(user, refreshTokenRecord.id);

    await user.update({ lastLoginAt: new Date() });

    this.logger.log(`Usuario logueado: ${user.phone} desde IP: ${ipAddress}`);

    return {
      user: this.formatUserResponse(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.getAccessTokenExpiryInSeconds(),
      },
    };
  }

  // ==================== REGISTRO ====================

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    const { phone, email, password, name } = registerDto;

    const formattedPhone = this.formatPhoneForDB(phone);

    const existingPhone = await this.userModel.findOne({
      where: { phone: formattedPhone },
    });
    if (existingPhone) {
      throw new ConflictException(AUTH_CONSTANTS.ERRORS.PHONE_ALREADY_EXISTS);
    }

    if (email) {
      const existingEmail = await this.userModel.findOne({ where: { email } });
      if (existingEmail) {
        throw new ConflictException(AUTH_CONSTANTS.ERRORS.EMAIL_ALREADY_EXISTS);
      }
    }

    const passwordHash = await bcrypt.hash(
      password,
      AUTH_CONSTANTS.SALT_ROUNDS,
    );

    const user = await this.userModel.create({
      phone: formattedPhone,
      email: email || null,
      passwordHash,
      name: name || null,
      role: UserRole.PLAYER,
      isActive: true,
    });

    this.logger.log(`Nuevo usuario registrado: ${phone}`);

    const refreshToken = this.generateRefreshTokenString();

    const refreshTokenRecord = await this.saveRefreshToken(
      user.id,
      refreshToken,
    );

    const accessToken = this.generateAccessToken(user, refreshTokenRecord.id);

    return {
      user: this.formatUserResponse(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.getAccessTokenExpiryInSeconds(),
      },
    };
  }

  // ==================== REFRESH TOKEN ====================

  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RefreshResponse> {
    const tokenRecord = await RefreshToken.findByToken(refreshToken);

    if (!tokenRecord) {
      throw new UnauthorizedException(AUTH_CONSTANTS.ERRORS.INVALID_TOKEN);
    }

    if (!tokenRecord.isActive()) {
      if (tokenRecord.isRevoked) {
        await RefreshToken.revokeAllUserTokens(tokenRecord.userId);
        this.logger.warn(
          `Intento de uso de token revocado. Usuario: ${tokenRecord.userId}. Todos los tokens revocados.`,
        );
        throw new UnauthorizedException(
          AUTH_CONSTANTS.ERRORS.REFRESH_TOKEN_REVOKED,
        );
      }
      throw new UnauthorizedException(
        AUTH_CONSTANTS.ERRORS.REFRESH_TOKEN_EXPIRED,
      );
    }

    const user = tokenRecord.user;

    if (!user || !user.isActive) {
      throw new UnauthorizedException(AUTH_CONSTANTS.ERRORS.USER_INACTIVE);
    }

    await tokenRecord.revoke();

    const newRefreshToken = this.generateRefreshTokenString();
    const newRefreshTokenRecord = await this.saveRefreshToken(
      user.id,
      newRefreshToken,
      ipAddress,
      userAgent,
      tokenRecord.deviceInfo,
    );

    const accessToken = this.generateAccessToken(
      user,
      newRefreshTokenRecord.id,
    );

    this.logger.log(`Token refrescado para usuario: ${user.phone}`);

    return {
      accessToken,
      refreshToken: newRefreshToken, // Retornar también el nuevo refresh token
      expiresIn: this.getAccessTokenExpiryInSeconds(),
    };
  }

  // ==================== LOGOUT ====================

  async logout(refreshToken: string): Promise<void> {
    const tokenRecord = await RefreshToken.findByToken(refreshToken);

    if (!tokenRecord) {
      this.logger.log('Logout: Token no encontrado o ya revocado');
      return;
    }

    await tokenRecord.revoke();
    this.logger.log(`Logout exitoso: Usuario ${tokenRecord.userId}`);
  }

  async logoutAll(userId: string): Promise<void> {
    await RefreshToken.revokeAllUserTokens(userId);
    this.logger.log(`Todas las sesiones cerradas para usuario: ${userId}`);
  }

  // ==================== CAMBIO DE CONTRASEÑA ====================

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userModel.findByPk(userId);

    if (!user) {
      throw new UnauthorizedException(AUTH_CONSTANTS.ERRORS.USER_NOT_FOUND);
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException(
        AUTH_CONSTANTS.ERRORS.CURRENT_PASSWORD_INCORRECT,
      );
    }

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      AUTH_CONSTANTS.SALT_ROUNDS,
    );

    await user.update({ passwordHash: newPasswordHash });

    await RefreshToken.revokeAllUserTokens(userId);

    this.logger.log(`Contraseña cambiada para usuario: ${user.phone}`);
  }

  // ==================== MÉTODOS PRIVADOS ====================

  private async generateTokens(user: User): Promise<TokenPair> {
    const refreshToken = this.generateRefreshTokenString();

    const refreshTokenRecord = await this.saveRefreshToken(
      user.id,
      refreshToken,
    );

    const accessToken = this.generateAccessToken(user, refreshTokenRecord.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getAccessTokenExpiryInSeconds(),
    };
  }

  private generateAccessToken(user: User, sessionId: string): string {
    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      type: 'access',
      sessionId,
    };

    return this.jwtService.sign(payload);
  }

  private generateRefreshTokenString(): string {
    return crypto.randomBytes(64).toString('base64url');
  }

  private async saveRefreshToken(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: string,
  ): Promise<RefreshToken> {
    // Calcular fecha de expiración
    const expiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY,
    );
    const expiresAt = this.calculateExpiryDate(expiresIn);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Limpiar sesiones antiguas si hay demasiadas
    await this.cleanupOldSessions(userId);

    return this.refreshTokenModel.create({
      userId,
      token,
      expiresAt,
      tokenHash,
      ipAddress,
      userAgent,
      deviceInfo,
    });
  }

  private async cleanupOldSessions(userId: string): Promise<void> {
    // Contar sesiones activas
    const activeSessions = await this.refreshTokenModel.count({
      where: { userId, isRevoked: false },
    });

    // Si excede el límite, revocar las más antiguas
    if (activeSessions >= AUTH_CONSTANTS.MAX_SESSIONS_PER_USER) {
      const oldestTokens = await this.refreshTokenModel.findAll({
        where: { userId, isRevoked: false },
        order: [['createdAt', 'ASC']],
        limit: activeSessions - AUTH_CONSTANTS.MAX_SESSIONS_PER_USER + 1,
      });

      for (const token of oldestTokens) {
        token.revoke();
        await token.save();
      }
    }
  }

  private calculateExpiryDate(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      // Default: 7 días
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  private getAccessTokenExpiryInSeconds(): number {
    const expiresIn = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY,
    );
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) return 900; // 15 minutos por defecto

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }

  private formatUserResponse(user: User): AuthenticatedUser {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      balance: user.balance,
      role: user.role,
      isActive: user.isActive,
    };
  }

  private formatPhoneForDB(rawPhone: string): string {
    return `+595${rawPhone}`;
  }

  // ==================== UTILIDAD ====================

  async getUserById(userId: string): Promise<User | null> {
    return this.userModel.findByPk(userId, {
      attributes: { exclude: ['passwordHash'] },
    });
  }

  async getActiveSessions(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenModel.findAll({
      where: { userId, isRevoked: false },
      attributes: ['id', 'deviceInfo', 'ipAddress', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const token = await this.refreshTokenModel.findOne({
      where: { id: sessionId, userId },
    });

    if (token) {
      token.revoke();
      await token.save();
    }
  }
}
