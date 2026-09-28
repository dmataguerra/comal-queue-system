import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearCola } from './cola.js';

test('limita activo y pendientes y descarta por espera o pérdida de vigencia', async () => {
  const vistos: number[] = [],
    descartados: number[] = [];
  let ahora = 0,
    terminar!: () => void;
  const bloqueado = new Promise<void>((resolve) => {
    terminar = resolve;
  });
  const cola = crearCola<number>(
    async (n) => {
      vistos.push(n);
      if (n === 1) await bloqueado;
    },
    () => {},
    {
      limite: 3,
      esperaMs: 100,
      ahora: () => ahora,
      alDescartar: (n) => {
        descartados.push(n);
      },
    },
  );
  try {
    assert.equal(cola.agregar(1), true);
    assert.equal(cola.agregar(2), true);
    assert.equal(cola.agregar(3), true);
    assert.equal(cola.agregar(4), false);
    cola.descartar((n) => n === 2);
    ahora = 101;
    terminar();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(vistos, [1]);
    assert.deepEqual(descartados, [4, 2, 3]);
  } finally {
    terminar();
    cola.detener();
  }
});

test('el watchdog aborta audio atascado y continúa con el siguiente anuncio', async () => {
  const vistos: number[] = [],
    descartados: number[] = [];
  let completar!: () => void;
  const fin = new Promise<void>((resolve) => {
    completar = resolve;
  });
  const cola = crearCola<number>(
    async (n, signal) => {
      vistos.push(n);
      if (n === 1)
        await new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        );
      else completar();
    },
    () => {},
    {
      duracionMs: 20,
      alDescartar: (n) => {
        descartados.push(n);
      },
    },
  );
  try {
    cola.agregar(1);
    cola.agregar(2);
    await fin;
    assert.deepEqual(vistos, [1, 2]);
    assert.deepEqual(descartados, [1]);
  } finally {
    cola.detener();
  }
});

test('55 termina antes de 66 y los repetidos mantienen su lugar', async () => {
  const eventos: string[] = [];
  let terminar!: () => void;
  const primero = new Promise<void>((resolve) => {
    terminar = resolve;
  });
  let completar!: () => void;
  const completo = new Promise<void>((resolve) => {
    completar = resolve;
  });
  let cantidad = 0;
  const cola = crearCola<number>(
    async (n) => {
      eventos.push(`inicio ${n}`);
      if (++cantidad === 1) await primero;
      eventos.push(`fin ${n}`);
      if (cantidad === 3) completar();
    },
    (error) => {
      throw error;
    },
  );
  cola.agregar(55);
  cola.agregar(66);
  cola.agregar(66);
  assert.deepEqual(eventos, ['inicio 55']);
  terminar();
  await completo;
  assert.deepEqual(eventos, ['inicio 55', 'fin 55', 'inicio 66', 'fin 66', 'inicio 66', 'fin 66']);
  cola.detener();
});

test('un fallo permite continuar y detener rechaza nuevos anuncios', async () => {
  const errores: unknown[] = [];
  const vistos: number[] = [];
  let completar!: () => void;
  const completo = new Promise<void>((resolve) => {
    completar = resolve;
  });
  const cola = crearCola<number>(
    async (n) => {
      vistos.push(n);
      if (n === 1) throw new Error('audio ausente');
      completar();
    },
    (error) => errores.push(error),
  );
  cola.agregar(1);
  cola.agregar(2);
  await completo;
  cola.detener();
  cola.agregar(3);
  assert.deepEqual(vistos, [1, 2]);
  assert.equal(errores.length, 1);
});
