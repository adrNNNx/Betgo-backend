// src/modules/game-access/dto/access-bar.dto.ts
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class AccessBarDto {
  @IsOptional()
  @IsString()
  deviceFingerprint?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class BarAccessResponseDto {
  bar: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    freePlaysPerDay: number;
  };
  session: {
    playsRemaining: number;
    playsUsed: number;
    playsLimit: number;
    isRegisteredUser: boolean;
  };
}
