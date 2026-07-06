import { normalizeParaguayPhone, toDbPhone } from './phone.util';

describe('phone.util', () => {
  it('normaliza los mismos prefijos que auth (+595 / 595 / 0)', () => {
    for (const raw of ['0981234567', '981234567', '+595981234567', '595981234567', ' 0981 234 567 ']) {
      expect(normalizeParaguayPhone(raw)).toBe('981234567');
    }
  });

  it('devuelve la forma de DB con +595', () => {
    expect(toDbPhone('0981234567')).toBe('+595981234567');
  });

  it('rechaza teléfonos inválidos, emails y no-strings', () => {
    for (const bad of ['123', '0891234567', 'foo@bar.com', '098123456789', '', null, 42]) {
      expect(normalizeParaguayPhone(bad as any)).toBeNull();
      expect(toDbPhone(bad as any)).toBeNull();
    }
  });
});
