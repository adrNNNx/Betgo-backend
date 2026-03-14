import { DateTime } from 'luxon';

export const PARAGUAY_TZ = 'America/Asuncion';

/**
 * Retorna la fecha actual en Paraguay como string 'YYYY-MM-DD'
 * Ej: si son las 23:30 UTC del martes, en Paraguay son las 19:30 del lunes
 */
export function getTodayInParaguay(): string {
  return DateTime.now().setZone(PARAGUAY_TZ).toISODate()!;
}

/**
 * Convierte un timestamp UTC a fecha Paraguay
 */
export function toParaguayDate(date: Date): string {
  return DateTime.fromJSDate(date).setZone(PARAGUAY_TZ).toISODate()!;
}
