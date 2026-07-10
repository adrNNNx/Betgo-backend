import Decimal from 'decimal.js';

/**
 * Nuevo saldo del pozo tras aplicar un ajuste con signo (+ suma, - resta).
 * Usa Decimal.js para evitar drift de centavos. No valida negativos: eso lo
 * decide el servicio (ver adjust()).
 */
export function nextPoolAmount(
  current: Decimal.Value,
  delta: Decimal.Value,
): number {
  return new Decimal(current).plus(delta).toDecimalPlaces(2).toNumber();
}
