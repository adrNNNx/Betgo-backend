// src/modules/auth/constants/auth.constants.ts

export const AUTH_CONSTANTS = {
  // Bcrypt
  SALT_ROUNDS: 12,

  // JWT tiempos por defecto
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',

  // Refresh token en días para cálculo de fecha
  REFRESH_TOKEN_DAYS: 7,

  // Máximo de sesiones activas por usuario
  MAX_SESSIONS_PER_USER: 5,

  // Mensajes de error
  ERRORS: {
    INVALID_CREDENTIALS: 'Credenciales inválidas',
    USER_NOT_FOUND: 'Usuario no encontrado',
    USER_INACTIVE: 'Usuario inactivo',
    INVALID_TOKEN: 'Token inválido o expirado',
    REFRESH_TOKEN_EXPIRED: 'Sesión expirada, inicie sesión nuevamente',
    REFRESH_TOKEN_REVOKED: 'Token revocado',
    UNAUTHORIZED: 'No autorizado',
    FORBIDDEN: 'Acceso denegado',
    TOO_MANY_REQUESTS: 'Demasiados intentos, intente más tarde',
    PHONE_ALREADY_EXISTS: 'El teléfono ya está registrado',
    EMAIL_ALREADY_EXISTS: 'El email ya está registrado',
    WEAK_PASSWORD: 'La contraseña no cumple los requisitos de seguridad',
    PASSWORDS_DO_NOT_MATCH: 'Las contraseñas no coinciden',
    CURRENT_PASSWORD_INCORRECT: 'La contraseña actual es incorrecta',
    SESSION_REVOKED: 'Sesión revocada. Por favor, inicia sesión nuevamente.',
    SESSION_EXPIRED: 'Sesión expirada. Por favor, inicia sesión nuevamente.',
  },

  // Regex para validaciones
  PATTERNS: {
    // Teléfono paraguayo: 09XX XXX XXX o 0XXX XXX XXX
    PHONE: /^9\d{8}$/,
    // Contraseña: mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula, 1 número
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  },
} as const;

export const JWT_STRATEGY_NAME = 'jwt';
export const LOCAL_STRATEGY_NAME = 'local';

// Metadata keys para decoradores
export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
