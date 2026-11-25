import { UserDailyPlaysService } from './user-daily-plays.service';
import { AuditAction } from '../audit-logs/entities/audit-log.entity';

// Dobles mínimos: sólo lo que toca resetFreePlays / verifyAndConsumeFreePlay.
const tx = { id: 'tx' };

const build = (opts: {
  user?: unknown;
  bar?: unknown;
  records?: Array<{ id: string; barId: string; playsUsed: number; playsLimit: number }>;
}) => {
  const dailyModel = {
    findAll: jest.fn(async (q: { lock?: boolean; where?: Record<string, unknown> }) =>
      q.lock ? (opts.records ?? []) : [],
    ),
    update: jest.fn(async () => [opts.records?.length ?? 0]),
    increment: jest.fn(),
  };
  const auditModel = { create: jest.fn() };
  const svc = new UserDailyPlaysService(
    dailyModel as never,
    { findByPk: async () => opts.user ?? null } as never,
    { findByPk: async () => opts.bar ?? null } as never,
    auditModel as never,
    { transaction: async (cb: (t: unknown) => unknown) => cb(tx) } as never,
  );
  return { svc, dailyModel, auditModel };
};

const jugador = { id: 'u1', name: 'Juan', phone: '+595981234567' };
const base = { userId: 'u1', adminUserId: 'admin1' };

describe('resetFreePlays', () => {
  it('pone en 0 lo usado hoy, devuelve cuánto restituyó y audita una vez', async () => {
    const { svc, dailyModel, auditModel } = build({
      user: jugador,
      records: [
        { id: 'r1', barId: 'b1', playsUsed: 3, playsLimit: 3 },
        { id: 'r2', barId: 'b2', playsUsed: 1, playsLimit: 5 },
      ],
    });

    const out = await svc.resetFreePlays({ ...base, reason: 'Falla de red' });

    expect(out.scope).toBe('all');
    expect(out.resetCount).toBe(2);
    expect(out.playsRestored).toBe(4);
    expect(dailyModel.update).toHaveBeenCalledWith(
      { playsUsed: 0 },
      expect.objectContaining({ transaction: tx }),
    );

    expect(auditModel.create).toHaveBeenCalledTimes(1);
    const [audit, auditOpts] = auditModel.create.mock.calls[0];
    expect(audit).toMatchObject({
      userId: 'admin1', // quién lo hizo
      action: AuditAction.FREE_PLAYS_RESET,
      entityId: 'u1', // a quién
    });
    expect(audit.oldValues.bars).toHaveLength(2);
    expect(audit.newValues).toMatchObject({ playsRestored: 4, reason: 'Falla de red' });
    // Reset y auditoría en la misma transacción: no puede quedar uno sin el otro.
    expect(auditOpts).toEqual({ transaction: tx });
  });

  it('con barId acota la búsqueda a ese bar', async () => {
    const { svc, dailyModel } = build({
      user: jugador,
      bar: { id: 'b1' },
      records: [{ id: 'r1', barId: 'b1', playsUsed: 2, playsLimit: 3 }],
    });

    const out = await svc.resetFreePlays({ ...base, barId: 'b1' });

    expect(out.scope).toBe('bar');
    expect(out.barId).toBe('b1');
    const lockedQuery = dailyModel.findAll.mock.calls.find((c) => c[0].lock)![0];
    expect(lockedQuery.where).toMatchObject({ userId: 'u1', barId: 'b1' });
  });

  it('sin nada usado hoy no escribe ni audita (idempotente)', async () => {
    const { svc, dailyModel, auditModel } = build({ user: jugador, records: [] });

    const out = await svc.resetFreePlays(base);

    expect(out.resetCount).toBe(0);
    expect(out.playsRestored).toBe(0);
    expect(dailyModel.update).not.toHaveBeenCalled();
    expect(auditModel.create).not.toHaveBeenCalled();
  });

  it('usuario inexistente → 404', async () => {
    const { svc } = build({ user: null });
    await expect(svc.resetFreePlays(base)).rejects.toThrow(/usuario no encontrado/i);
  });

  it('bar inexistente → 404, sin tocar nada', async () => {
    const { svc, dailyModel } = build({ user: jugador, bar: null });
    await expect(svc.resetFreePlays({ ...base, barId: 'nope' })).rejects.toThrow(
      /bar no encontrado/i,
    );
    expect(dailyModel.update).not.toHaveBeenCalled();
  });
});

describe('verifyAndConsumeFreePlay — incremento condicional', () => {
  const record = {
    id: 'r1',
    playsUsed: 2,
    playsLimit: 3,
    reload: jest.fn(),
  };

  // `update` devuelve [filasAfectadas], como Sequelize v6 en Postgres.
  const withUpdate = (affected: number) => {
    const { svc, dailyModel } = build({});
    jest
      .spyOn(svc, 'getOrCreateDailyRecord')
      .mockResolvedValue(record as never);
    dailyModel.update.mockResolvedValue([affected]);
    return { svc, dailyModel };
  };

  it('incrementa en la base sólo si queda cupo', async () => {
    const { svc, dailyModel } = withUpdate(1);
    await svc.verifyAndConsumeFreePlay('b1', 'u1', 3, 'Bar');
    const [values, opts] = dailyModel.update.mock.calls[0] as unknown as [
      { playsUsed: { val: string } },
      { where: { id: string; playsUsed: unknown } },
    ];
    expect(values.playsUsed.val).toBe('plays_used + 1'); // suma en la base, no en JS
    expect(opts.where.id).toBe('r1');
    expect(opts.where.playsUsed).toBeDefined(); // la condición plays_used < plays_limit
  });

  it('si la base no cambió la fila (sin cupo), rechaza el giro', async () => {
    const { svc } = withUpdate(0);
    await expect(svc.verifyAndConsumeFreePlay('b1', 'u1', 3, 'Bar')).rejects.toThrow(
      /agotado/i,
    );
  });
});
