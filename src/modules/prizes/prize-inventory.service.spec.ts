import { Op } from 'sequelize';
import { PrizeInventoryService } from './prize-inventory.service';
import { ClaimStatus } from '../prize-claims/entities/prize-claim.entity';
import type { Prize } from './entities/prize.entity';

// La transacción sólo se pasa de mano en mano: basta con una identidad.
const tx = { id: 'tx' } as never;

const premio = (over: Partial<Prize> = {}) =>
  ({ id: 'p1', name: 'TV 65"', isActive: true, stock: 1, ...over }) as Prize;

const build = (prize: Prize | null, committed = 0) => {
  const prizeModel = {
    findByPk: jest.fn().mockResolvedValue(prize),
    decrement: jest.fn().mockResolvedValue(undefined),
  };
  const claimModel = {
    count: jest.fn().mockResolvedValue(committed),
  };
  const svc = new PrizeInventoryService(
    prizeModel as never,
    claimModel as never,
  );
  return { svc, prizeModel, claimModel };
};

describe('PrizeInventoryService.lockForAward — ¿se puede otorgar?', () => {
  it('bloquea la fila del premio dentro de la transacción', async () => {
    const { svc, prizeModel } = build(premio());
    await svc.lockForAward('p1', tx);
    expect(prizeModel.findByPk).toHaveBeenCalledWith('p1', {
      transaction: tx,
      lock: true,
    });
  });

  it('con unidades libres, otorga', async () => {
    const p = premio({ stock: 1 });
    await expect(build(p, 0).svc.lockForAward('p1', tx)).resolves.toBe(p);
  });

  it('una unidad ganada y sin retirar ya agota el stock (el bug original)', async () => {
    // TV con stock 1: alguien la ganó hace 2 días y todavía no la retiró.
    await expect(
      build(premio({ stock: 1 }), 1).svc.lockForAward('p1', tx),
    ).resolves.toBeNull();
  });

  it('otorga hasta la última unidad libre y ni una más', async () => {
    const p = premio({ stock: 3 });
    await expect(build(p, 2).svc.lockForAward('p1', tx)).resolves.toBe(p);
    await expect(build(p, 3).svc.lockForAward('p1', tx)).resolves.toBeNull();
  });

  it('con comprobantes de más (datos previos al arreglo) no otorga hasta normalizarse', async () => {
    await expect(
      build(premio({ stock: 3 }), 5).svc.lockForAward('p1', tx),
    ).resolves.toBeNull();
  });

  it('stock null es ilimitado y ni siquiera cuenta comprobantes', async () => {
    const p = premio({ stock: null });
    const { svc, claimModel } = build(p, 999);
    await expect(svc.lockForAward('p1', tx)).resolves.toBe(p);
    expect(claimModel.count).not.toHaveBeenCalled();
  });

  it('premio inactivo o inexistente no se otorga', async () => {
    await expect(
      build(premio({ isActive: false })).svc.lockForAward('p1', tx),
    ).resolves.toBeNull();
    await expect(build(null).svc.lockForAward('p1', tx)).resolves.toBeNull();
  });

  it('sólo cuentan los comprobantes pendientes y vigentes, en la misma transacción', async () => {
    const { svc, claimModel } = build(premio({ stock: 5 }));
    await svc.lockForAward('p1', tx);

    const [[opts]] = claimModel.count.mock.calls as [
      [{ where: Record<PropertyKey, unknown>; transaction: unknown }],
    ];
    expect(opts.transaction).toBe(tx);
    expect(opts.where.prizeId).toBe('p1');
    expect(opts.where.status).toBe(ClaimStatus.PENDING);
    // Un vencido que todavía figura "pending" en la base no reserva nada.
    const expiresAt = opts.where.expiresAt as Record<symbol, unknown>;
    expect(expiresAt[Op.gt]).toBeInstanceOf(Date);
  });
});

describe('PrizeInventoryService.consumeOnDelivery — entrega física', () => {
  it('descuenta una unidad de forma condicional: nunca por debajo de 0', async () => {
    const { svc, prizeModel } = build(premio());
    await svc.consumeOnDelivery('p1', tx);
    expect(prizeModel.decrement).toHaveBeenCalledWith('stock', {
      by: 1,
      where: { id: 'p1', stock: { [Op.gt]: 0 } },
      transaction: tx,
    });
  });
});
