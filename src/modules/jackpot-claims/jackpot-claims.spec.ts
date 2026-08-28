import { JackpotClaimsService } from './jackpot-claims.service';
import { JackpotClaimStatus } from './entities/jackpot-claim.entity';

// Doble mínimo de un claim: solo lo que toca la máquina de estados.
// `update` muta el propio objeto, como hace una instancia de Sequelize.
const claimDoble = (over: Record<string, unknown> = {}) => {
  const claim: Record<string, unknown> = {
    id: 'c1',
    folio: 'J-ABC123',
    userId: 'u1',
    amount: 500000,
    status: JackpotClaimStatus.PENDING_CONTACT,
    contactedAt: null,
    paidAt: null,
    paidById: null,
    notes: null,
    ...over,
  };
  claim.update = jest.fn(async (patch: Record<string, unknown>) => {
    Object.assign(claim, patch);
    return claim;
  });
  return claim as Record<string, unknown> & { update: jest.Mock };
};

const build = (claim: unknown, pool?: unknown) =>
  new JackpotClaimsService(
    { findOne: async () => claim } as never,
    { findByPk: async () => pool ?? null } as never,
    { get: () => undefined } as never,
    { findActiveByUserId: async () => ({ id: 'staff1' }) } as never,
  );

describe('markContacted — el ganador avisa', () => {
  it('pending_contact → in_review y sella la fecha', async () => {
    const claim = claimDoble();
    const svc = build(claim);
    const out = await svc.markContacted('J-ABC123', 'u1');
    expect(out.status).toBe(JackpotClaimStatus.IN_REVIEW);
    expect(claim.contactedAt).toBeInstanceOf(Date);
  });

  it('reintentar el contacto no rompe: devuelve el estado actual', async () => {
    const claim = claimDoble({
      status: JackpotClaimStatus.IN_REVIEW,
      contactedAt: new Date('2026-01-01'),
    });
    const svc = build(claim);
    const out = await svc.markContacted('J-ABC123', 'u1');
    expect(out.status).toBe(JackpotClaimStatus.IN_REVIEW);
    expect(claim.update).not.toHaveBeenCalled(); // no repisa la fecha original
  });

  it('un comprobante ajeno no se puede tocar', async () => {
    const svc = build(claimDoble());
    await expect(svc.markContacted('J-ABC123', 'OTRO')).rejects.toThrow(
      /no es tuyo/i,
    );
  });

  it('no se re-abre un pozo ya pagado', async () => {
    const svc = build(claimDoble({ status: JackpotClaimStatus.PAID }));
    await expect(svc.markContacted('J-ABC123', 'u1')).rejects.toThrow(
      /ya fue pagado/i,
    );
  });

  it('folio inexistente → 404', async () => {
    const svc = build(null);
    await expect(svc.markContacted('J-NOPE', 'u1')).rejects.toThrow(
      /no encontrado/i,
    );
  });
});

describe('markPaid — administración cierra el circuito', () => {
  it('marca pagado, sella quién y suma a totalPaid del pozo', async () => {
    const claim = claimDoble({ status: JackpotClaimStatus.IN_REVIEW });
    const pool = { increment: jest.fn() };
    const svc = build(claim, pool);

    const out = await svc.markPaid('J-ABC123', 'admin1', 'Transferencia 123');

    expect(out.status).toBe(JackpotClaimStatus.PAID);
    expect(claim.paidById).toBe('staff1');
    expect(claim.paidAt).toBeInstanceOf(Date);
    // El pozo recién ahora registra el pago: al ganar solo nacía la deuda.
    expect(pool.increment).toHaveBeenCalledWith('totalPaid', { by: 500000 });
  });

  it('se puede pagar sin pasar por in_review (el ganador vino en persona)', async () => {
    const claim = claimDoble({ status: JackpotClaimStatus.PENDING_CONTACT });
    const svc = build(claim, { increment: jest.fn() });
    const out = await svc.markPaid('J-ABC123', 'admin1');
    expect(out.status).toBe(JackpotClaimStatus.PAID);
  });

  it('pagar dos veces se rechaza (no duplica totalPaid)', async () => {
    const claim = claimDoble({ status: JackpotClaimStatus.PAID });
    const pool = { increment: jest.fn() };
    const svc = build(claim, pool);
    await expect(svc.markPaid('J-ABC123', 'admin1')).rejects.toThrow(
      /ya fue pagado/i,
    );
    expect(pool.increment).not.toHaveBeenCalled();
  });
});

describe('buildContactHref — link de WhatsApp', () => {
  const svcCon = (phone?: string) =>
    new JackpotClaimsService(
      {} as never,
      {} as never,
      { get: () => phone } as never,
      {} as never,
    );

  it('arma el link con el folio dentro del mensaje', () => {
    const href = svcCon('595981234567').buildContactHref('J-ABC123');
    expect(href).toContain('https://wa.me/595981234567');
    expect(href).toContain('J-ABC123');
  });

  it('limpia los signos del número', () => {
    const href = svcCon('+595 98 123-4567').buildContactHref('J-ABC123');
    expect(href).toContain('wa.me/595981234567');
  });

  it('sin número configurado devuelve null (el front oculta el botón)', () => {
    expect(svcCon(undefined).buildContactHref('J-ABC123')).toBeNull();
  });
});
