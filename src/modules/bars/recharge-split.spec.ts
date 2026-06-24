import { splitRecharge } from './recharge-split';

describe('splitRecharge', () => {
  it('reparte según los porcentajes', () => {
    const s = splitRecharge(100000, 50, 30);
    expect(s.barShare).toBe(50000);
    expect(s.poolShare).toBe(30000);
    expect(s.platformShare).toBe(20000);
  });

  it('las 3 partes suman exactamente el monto (sin drift)', () => {
    // montos/porcentajes que provocan redondeo
    const cases: Array<[number, number, number]> = [
      [100000, 50, 30],
      [33333.33, 33, 33],
      [10, 33, 33],
      [99999.99, 45, 35],
      [1, 50, 30],
    ];
    for (const [amount, barPct, poolPct] of cases) {
      const s = splitRecharge(amount, barPct, poolPct);
      expect(s.barShare + s.poolShare + s.platformShare).toBeCloseTo(amount, 2);
    }
  });
});
