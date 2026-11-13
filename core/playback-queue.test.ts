import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQueue } from './playback-queue.js';
test('limita activo y pendientes y descarta por espera o pérdida de vigencia', async () => {
  const seen: number[] = [],
    discarded: number[] = [];
  let now = 0,
    finish!: () => void;
  const blocked = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const queue = createQueue<number>(
    async (n) => {
      seen.push(n);
      if (n === 1) await blocked;
    },
    () => {},
    {
      limite: 3,
      esperaMs: 100,
      ahora: () => now,
      alDescartar: (n) => {
        discarded.push(n);
      },
    },
  );
  try {
    assert.equal(queue.agregar(1), true);
    assert.equal(queue.agregar(2), true);
    assert.equal(queue.agregar(3), true);
    assert.equal(queue.agregar(4), false);
    queue.descartar((n) => n === 2);
    now = 101;
    finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(seen, [1]);
    assert.deepEqual(discarded, [4, 2, 3]);
  } finally {
    finish();
    queue.detener();
  }
});
test('el watchdog aborta audio atascado y continúa con el siguiente anuncio', async () => {
  const seen: number[] = [],
    discarded: number[] = [];
  let complete!: () => void;
  const finished = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const queue = createQueue<number>(
    async (n, signal) => {
      seen.push(n);
      if (n === 1)
        await new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        );
      else complete();
    },
    () => {},
    {
      duracionMs: 20,
      alDescartar: (n) => {
        discarded.push(n);
      },
    },
  );
  try {
    queue.agregar(1);
    queue.agregar(2);
    await finished;
    assert.deepEqual(seen, [1, 2]);
    assert.deepEqual(discarded, [1]);
  } finally {
    queue.detener();
  }
});
test('55 termina antes de 66 y los repetidos mantienen su lugar', async () => {
  const events: string[] = [];
  let finish!: () => void;
  const first = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let complete!: () => void;
  const completed = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let count = 0;
  const queue = createQueue<number>(
    async (n) => {
      events.push(`inicio ${n}`);
      if (++count === 1) await first;
      events.push(`fin ${n}`);
      if (count === 3) complete();
    },
    (error) => {
      throw error;
    },
  );
  queue.agregar(55);
  queue.agregar(66);
  queue.agregar(66);
  assert.deepEqual(events, ['inicio 55']);
  finish();
  await completed;
  assert.deepEqual(events, ['inicio 55', 'fin 55', 'inicio 66', 'fin 66', 'inicio 66', 'fin 66']);
  queue.detener();
});
test('un fallo permite continuar y detener rechaza nuevos anuncios', async () => {
  const errors: unknown[] = [];
  const seen: number[] = [];
  let complete!: () => void;
  const completed = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const queue = createQueue<number>(
    async (n) => {
      seen.push(n);
      if (n === 1) throw new Error('audio ausente');
      complete();
    },
    (error) => errors.push(error),
  );
  queue.agregar(1);
  queue.agregar(2);
  await completed;
  queue.detener();
  queue.agregar(3);
  assert.deepEqual(seen, [1, 2]);
  assert.equal(errors.length, 1);
});
