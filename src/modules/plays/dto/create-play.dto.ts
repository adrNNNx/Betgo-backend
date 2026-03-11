// src/modules/plays/dto/create-play.dto.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';

export enum PlayTypeRequest {
  FREE = 'free',
  PAID = 'paid',
  POOL = 'pool',
}

export class CreatePlayDto {
  @IsString()
  @IsNotEmpty()
  barSlug: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;
}

export class PlayResponseDto {
  playId: string;
  symbols: string[];
  symbolDetails: Array<{ id: string; name: string; imageUrl: string }>;
  isWinner: boolean;
  prize: {
    id: string;
    name: string;
    type: string;
    value?: number;
    claimCode?: string;
  } | null;
  session: {
    playsRemaining: number;
    playsUsed: number;
    balance: number;
  };
  poolAmount?: number;
}
