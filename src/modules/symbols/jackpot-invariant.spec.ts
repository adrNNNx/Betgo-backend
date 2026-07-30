import { BadRequestException } from '@nestjs/common';
import { SymbolsService } from './symbols.service';
import type { Symbol } from './entities/symbol.entity';

/**
 * La invariante del símbolo que entrega el pozo. Es una regla de plata: si se
 * rompe, o se emiten comprobantes por un premio que nadie va a entregar, o un
 * bar reparte el pozo nacional por su cuenta.
 */

// Sólo se ejercita resolveJackpot: no toca la base ni Cloudinary.
const service = new SymbolsService(
  null as never,
  null as never,
  null as never,
  null as never,
);

// resolveJackpot es privado a propósito (la invariante no es API pública).
const resolve = (next: {
  isGlobal: boolean;
  isJackpot: boolean;
  prizeId: string | null;
  minMatchToWin: number;
}) =>
  (
    service as unknown as {
      resolveJackpot: (n: typeof next) => {
        isJackpot: boolean;
        minMatchToWin: number;
      };
    }
  ).resolveJackpot(next);

const base = {
  isGlobal: true,
  isJackpot: false,
  prizeId: null as string | null,
  minMatchToWin: 5,
};

describe('invariante del símbolo que entrega el pozo', () => {
  it('un símbolo global sin premio puede entregar el pozo', () => {
    expect(resolve({ ...base, isJackpot: true })).toEqual({
      isJackpot: true,
      minMatchToWin: 5,
    });
  });

  it('fuerza los 5 carriles aunque pidan 3 o 4', () => {
    for (const pedido of [3, 4]) {
      expect(
        resolve({ ...base, isJackpot: true, minMatchToWin: pedido }),
      ).toEqual({ isJackpot: true, minMatchToWin: 5 });
    }
  });

  it('rechaza entregar el pozo si el símbolo tiene premio propio', () => {
    expect(() =>
      resolve({ ...base, isJackpot: true, prizeId: 'premio-1' }),
    ).toThrow(BadRequestException);
  });

  it('rechaza asignarle un premio a un símbolo que ya entrega el pozo', () => {
    // Mismo estado final, se llegue por donde se llegue.
    expect(() =>
      resolve({ ...base, isJackpot: true, prizeId: 'premio-nuevo' }),
    ).toThrow(/no puede tener un premio propio/i);
  });

  it('un símbolo de bar nunca entrega el pozo, aunque lo pidan', () => {
    expect(
      resolve({ ...base, isGlobal: false, isJackpot: true }),
    ).toEqual({ isJackpot: false, minMatchToWin: 5 });
  });

  it('un símbolo de bar con premio no explota: sólo pierde el jackpot', () => {
    expect(
      resolve({
        isGlobal: false,
        isJackpot: true,
        prizeId: 'premio-1',
        minMatchToWin: 3,
      }),
    ).toEqual({ isJackpot: false, minMatchToWin: 3 });
  });

  it('sin jackpot, respeta el umbral que le pidan', () => {
    for (const n of [3, 4, 5]) {
      expect(
        resolve({ ...base, prizeId: 'premio-1', minMatchToWin: n }),
      ).toEqual({ isJackpot: false, minMatchToWin: n });
    }
  });
});

describe('update: se valida el estado FINAL, no el DTO', () => {
  // Un símbolo que hoy entrega el pozo.
  const actual = {
    barId: null,
    isJackpot: true,
    prizeId: null,
    minMatchToWin: 5,
  } as Symbol;

  it('mandar sólo prizeId sobre un símbolo con corona lo rechaza', () => {
    // El DTO no trae isJackpot, pero el estado final sí lo tiene.
    expect(() =>
      resolve({
        isGlobal: actual.barId === null,
        isJackpot: actual.isJackpot,
        prizeId: 'premio-nuevo',
        minMatchToWin: actual.minMatchToWin,
      }),
    ).toThrow(BadRequestException);
  });

  it('limpiar el premio y marcar la corona en un solo PATCH funciona', () => {
    expect(
      resolve({
        isGlobal: true,
        isJackpot: true,
        prizeId: null,
        minMatchToWin: 3,
      }),
    ).toEqual({ isJackpot: true, minMatchToWin: 5 });
  });

  it('sacar la corona libera el umbral otra vez', () => {
    expect(
      resolve({
        isGlobal: true,
        isJackpot: false,
        prizeId: 'premio-1',
        minMatchToWin: 3,
      }),
    ).toEqual({ isJackpot: false, minMatchToWin: 3 });
  });
});
