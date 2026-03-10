// src/modules/game-access/dto/play-request.dto.ts
import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';

export enum PlayTypeRequest {
  FREE = 'free',
  PAID = 'paid',
  POOL = 'pool',
}

export class PlayRequestDto {
  @IsString()
  barSlug: string;

  @IsEnum(PlayTypeRequest)
  playType: PlayTypeRequest;

  @IsString()
  deviceFingerprint: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  tableId?: string;
}

export class PlayResultDto {
  playId: string;
  symbols: string[];
  isWinner: boolean;
  prize: {
    id: string;
    name: string;
    type: string;
    claimCode?: string;
  } | null;
  session: {
    playsRemaining: number;
    playsUsed: number;
    balance?: number;
  };
  poolAmount?: number;
}
