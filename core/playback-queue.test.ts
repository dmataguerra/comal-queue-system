import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQueue } from './playback-queue.js';
test('limits active and pending items and discards them on wait timeout or loss of validity', async () => {
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
      limit: 3,
      waitMs: 100,
      now: () => now,
      onDiscard: (n) => {
        discarded.push(n);
      },
    },
  );
  try {
    assert.equal(queue.add(1), true);
    assert.equal(queue.add(2), true);
    assert.equal(queue.add(3), true);
    assert.equal(queue.add(4), false);
    queue.discard((n) => n === 2);
    now = 101;
    finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(seen, [1]);
    assert.deepEqual(discarded, [4, 2, 3]);
  } finally {
    finish();
    queue.stop();
  }
});
test('the watchdog aborts stuck audio and continues with the next announcement', async () => {
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
      durationMs: 20,
      onDiscard: (n) => {
        discarded.push(n);
      },
    },
  );
  try {
    queue.add(1);
    queue.add(2);
    await finished;
    assert.deepEqual(seen, [1, 2]);
    assert.deepEqual(discarded, [1]);
  } finally {
    queue.stop();
  }
});
test('55 finishes before 66 and repeats keep their place', async () => {
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
  queue.add(55);
  queue.add(66);
  queue.add(66);
  assert.deepEqual(events, ['inicio 55']);
  finish();
  await completed;
  assert.deepEqual(events, ['inicio 55', 'fin 55', 'inicio 66', 'fin 66', 'inicio 66', 'fin 66']);
  queue.stop();
});
test('a failure allows continuing and stopping rejects new announcements', async () => {
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
  queue.add(1);
  queue.add(2);
  await completed;
  queue.stop();
  queue.add(3);
  assert.deepEqual(seen, [1, 2]);
  assert.equal(errors.length, 1);
});
