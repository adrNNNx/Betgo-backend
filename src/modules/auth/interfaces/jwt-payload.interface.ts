// src/modules/auth/interfaces/jwt-payload.interface.ts

export interface JwtPayload {
  sub: string; // User ID
  phone: string; // Phone number
  role: string; // User role
  type: 'access' | 'refresh';
  sessionId?: string; // sessionId
  iat?: number; // Issued at
  exp?: number; // Expiration
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthenticatedUser {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  balance: number;
  role: string;
  isActive: boolean;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  tokens: TokenPair;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
