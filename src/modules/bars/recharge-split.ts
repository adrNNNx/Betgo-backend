import Decimal from 'decimal.js';

// Distribución del monto de una recarga según los porcentajes del bar.
// La porción de empresa es el remanente para que las 3 partes sumen
// EXACTAMENTE `amount` (sin drift de centavos por redondeo).
//
// Todo el cálculo se hace con Decimal.js para evitar errores de punto
// flotante en operaciones con dinero.

export interface RechargeSplit {
  amount: number;
  barShare: number;
  poolShare: number;
  platformShare: number;
}

// ponytail: escala fija a 2 decimales (las columnas son DECIMAL(_,2) y hoy
// solo se opera en guaraníes). Si una moneda futura usa otra escala,
// parametrizar `scale` por currency acá.
const SCALE = 2;

export function splitRecharge(
  amount: Decimal.Value,
  barPercentage: Decimal.Value,
  poolPercentage: Decimal.Value,
): RechargeSplit {
  const amt = new Decimal(amount);

  const barShare = amt.mul(barPercentage).div(100).toDecimalPlaces(SCALE);
  const poolShare = amt.mul(poolPercentage).div(100).toDecimalPlaces(SCALE);
  // remanente → garantiza barShare + poolShare + platformShare === amount
  const platformShare = amt.minus(barShare).minus(poolShare).toDecimalPlaces(SCALE);

  return {
    amount: amt.toNumber(),
    barShare: barShare.toNumber(),
    poolShare: poolShare.toNumber(),
    platformShare: platformShare.toNumber(),
  };
}
