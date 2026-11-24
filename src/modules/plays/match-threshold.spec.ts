import { PlaysService, REELS } from './plays.service';
import type { Symbol } from '../symbols/entities/symbol.entity';
import type { Prize } from '../prizes/entities/prize.entity';

// Símbolos mínimos: solo lo que leen generatePlayResult y getPrizeForResult.
const sym = (
  id: string,
  { weight = 100, minMatchToWin = 5, prizeId = null as string | null } = {},
) => ({ id, name: id, imageUrl: `${id}.png`, weight, minMatchToWin, prizeId }) as Symbol;

// Transacción de mentira: estos tests miran umbrales, no concurrencia. El stock
// y el lock tienen su propio spec (prizes/prize-inventory.service.spec.ts).
const tx = { id: 'tx' } as never;

// El inventario otorga el premio si está activo; el resto de los modelos no se toca.
const serviceWith = (prize: Partial<Prize> | null) =>
  new PlaysService(
    null as never,
    null as never,
    {
      lockForAward: () => Promise.resolve(prize?.isActive ? prize : null),
    } as never,
    null as never,
  );

const service = serviceWith(null);

describe('generatePlayResult — giro y conteo', () => {
  const symbols = [sym('a'), sym('b'), sym('c'), sym('d')];

  afterEach(() => {
    delete process.env.FORCE_WIN;
  });

  it('siempre devuelve 5 carriles', () => {
    expect(service.generatePlayResult(symbols).symbolIds).toHaveLength(REELS);
  });

  it('matchCount es la repetición más alta, y topSymbol ese símbolo', () => {
    for (let i = 0; i < 300; i++) {
      const r = service.generatePlayResult(symbols);
      const veces = r.symbolIds.filter((id) => id === r.topSymbol?.id).length;
      expect(r.matchCount).toBe(veces);
      // Nadie puede repetirse más que el top.
      for (const s of symbols) {
        expect(r.symbolIds.filter((id) => id === s.id).length).toBeLessThanOrEqual(
          r.matchCount,
        );
      }
    }
  });

  it('con 3 o más, el top es único (no hay empate posible en 5 carriles)', () => {
    for (let i = 0; i < 500; i++) {
      const r = service.generatePlayResult(symbols);
      if (r.matchCount < 3) continue;
      const conMismoConteo = symbols.filter(
        (s) => r.symbolIds.filter((id) => id === s.id).length === r.matchCount,
      );
      expect(conMismoConteo).toHaveLength(1);
    }
  });

  describe('con FORCE_WIN fuerza exactamente la cantidad pedida', () => {
    beforeEach(() => {
      process.env.FORCE_WIN = 'true';
    });

    it.each([3, 4, 5])('forceMatch %i → matchCount %i sobre el símbolo "a"', (n) => {
      const r = service.generatePlayResult(symbols, n);
      expect(r.matchCount).toBe(n);
      expect(r.topSymbol?.id).toBe('a');
    });

    it('con 3 no reparte de más: quedan 2 carriles distintos', () => {
      const r = service.generatePlayResult(symbols, 3);
      expect(r.symbolIds.filter((id) => id === 'a')).toHaveLength(3);
      expect(r.symbolIds.filter((id) => id !== 'a')).toHaveLength(2);
    });
  });
});

describe('getPrizeForResult — manda el símbolo', () => {
  const activo = { id: 'p1', name: 'Cerveza', isActive: true } as Prize;
  const resultado = (symbol: Symbol, matchCount: number) => ({
    symbolIds: [],
    symbolDetails: [],
    matchCount,
    topSymbol: symbol,
  });

  it('paga desde su propio umbral, no antes', async () => {
    const cereza = sym('cereza', { minMatchToWin: 3, prizeId: 'p1' });
    const svc = serviceWith(activo);
    await expect(svc.getPrizeForResult(resultado(cereza, 2), tx)).resolves.toBeNull();
    await expect(svc.getPrizeForResult(resultado(cereza, 3), tx)).resolves.toBe(activo);
    await expect(svc.getPrizeForResult(resultado(cereza, 5), tx)).resolves.toBe(activo);
  });

  it('cada símbolo tiene su propio umbral', async () => {
    const diamante = sym('diamante', { minMatchToWin: 4, prizeId: 'p1' });
    const svc = serviceWith(activo);
    // Con 3 la cereza ya pagaría, el diamante todavía no.
    await expect(svc.getPrizeForResult(resultado(diamante, 3), tx)).resolves.toBeNull();
    await expect(svc.getPrizeForResult(resultado(diamante, 4), tx)).resolves.toBe(activo);
  });

  it('sin premio asignado no paga aunque salgan los 5', async () => {
    const pelado = sym('pelado', { minMatchToWin: 3 });
    await expect(
      serviceWith(activo).getPrizeForResult(resultado(pelado, 5), tx),
    ).resolves.toBeNull();
  });

  it('premio inactivo no paga (y no rompe la jugada)', async () => {
    const cereza = sym('cereza', { minMatchToWin: 3, prizeId: 'p1' });
    const inactivo = { id: 'p1', name: 'Cerveza', isActive: false } as Prize;
    await expect(
      serviceWith(inactivo).getPrizeForResult(resultado(cereza, 5), tx),
    ).resolves.toBeNull();
  });

  it('el default 5 mantiene la conducta histórica', async () => {
    const clasico = sym('clasico', { prizeId: 'p1' });
    const svc = serviceWith(activo);
    await expect(svc.getPrizeForResult(resultado(clasico, 4), tx)).resolves.toBeNull();
    await expect(svc.getPrizeForResult(resultado(clasico, 5), tx)).resolves.toBe(activo);
  });
});

describe('getPrizeForResult — delega el stock en el inventario', () => {
  const cereza = sym('cereza', { minMatchToWin: 3, prizeId: 'p1' });
  const giro = (matchCount: number) => ({
    symbolIds: [],
    symbolDetails: [],
    matchCount,
    topSymbol: cereza,
  });
  const conInventario = (lockForAward: jest.Mock) =>
    new PlaysService(
      null as never,
      null as never,
      { lockForAward } as never,
      null as never,
    );

  it('pide el premio al inventario dentro de la transacción de la jugada', async () => {
    const lockForAward = jest.fn().mockResolvedValue(null);
    await conInventario(lockForAward).getPrizeForResult(giro(3), tx);
    expect(lockForAward).toHaveBeenCalledWith('p1', tx);
  });

  it('un giro perdedor no toca el inventario: no bloquea ningún premio', async () => {
    const lockForAward = jest.fn().mockResolvedValue(null);
    await conInventario(lockForAward).getPrizeForResult(giro(2), tx);
    expect(lockForAward).not.toHaveBeenCalled();
  });

  it('si el inventario dice que no hay stock, el giro no paga', async () => {
    const lockForAward = jest.fn().mockResolvedValue(null);
    await expect(
      conInventario(lockForAward).getPrizeForResult(giro(5), tx),
    ).resolves.toBeNull();
  });
});
