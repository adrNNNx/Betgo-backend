import { AUTH_CONSTANTS } from '../../modules/auth/constants/auth.constants';

/**
 * Normaliza un teléfono paraguayo a su número local (9XXXXXXXX), replicando
 * el @Transform de los DTOs de auth: quita espacios y los prefijos +595 / 595 / 0.
 * Devuelve null si no cumple el patrón oficial (misma fuente que register/login).
 */
export function normalizeParaguayPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let p = raw.replace(/\s+/g, '');
  if (p.startsWith('+595')) p = p.substring(4);
  else if (p.startsWith('595')) p = p.substring(3);
  else if (p.startsWith('0')) p = p.substring(1);
  return AUTH_CONSTANTS.PATTERNS.PHONE.test(p) ? p : null;
}

/**
 * Convierte un teléfono crudo a la forma almacenada en DB (+5959XXXXXXXX),
 * o null si no es un teléfono válido. Coincide con AuthService.formatPhoneForDB.
 */
export function toDbPhone(raw: unknown): string | null {
  const local = normalizeParaguayPhone(raw);
  return local ? `+595${local}` : null;
}
