import { nextPoolAmount } from './pool-math';

describe('nextPoolAmount', () => {
  it('suma y resta con signo', () => {
    expect(nextPoolAmount(100000, -30000)).toBe(70000);
    expect(nextPoolAmount(100000, 30000)).toBe(130000);
  });

  it('no arrastra error de punto flotante', () => {
    expect(nextPoolAmount(0.1, 0.2)).toBe(0.3);
  });

  it('permite calcular negativos (el guard vive en el servicio)', () => {
    expect(nextPoolAmount(100, -150)).toBe(-50);
  });
});
