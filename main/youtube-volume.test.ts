import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { volumeScript } from './youtube-volume.js';
function scenario() {
  let now = 0;
  const tasks: (() => void)[] = [];
  const videos: {
    volume: number;
    paused: boolean;
    muted: boolean;
  }[] = [];
  const context = createContext({
    window: {},
    document: { querySelectorAll: () => videos },
    performance: { now: () => now },
    setTimeout: (fn: () => void) => tasks.push(fn),
  });
  return {
    videos,
    aplicar: (volume: number, ramp = 0) =>
      runInContext(volumeScript(volume, ramp), context) as Promise<{
        videos: number;
      }>,
    async avanzar(ms: number) {
      now += ms;
      for (const task of tasks.splice(0)) task();
      await Promise.resolve();
    },
  };
}
test('an old request waiting for video does not restore volume over a new ducking', async () => {
  const e = scenario();
  const old = e.aplicar(1);
  const fresh = e.aplicar(0.15);
  e.videos.push({ volume: 1, paused: false, muted: false });
  await e.avanzar(50);
  assert.equal((await old).videos, 0);
  assert.equal((await fresh).videos, 1);
  assert.equal(e.videos[0].volume, 0.15);
});
test('confirms only when the ramp ends and respects pause and silence', async () => {
  const e = scenario();
  e.videos.push({ volume: 1, paused: true, muted: true });
  let confirmed = false;
  const result = e.aplicar(0.15, 150).then(() => {
    confirmed = true;
  });
  await e.avanzar(75);
  assert.equal(confirmed, false);
  assert.ok(e.videos[0].volume > 0.15);
  await e.avanzar(75);
  await result;
  assert.equal(e.videos[0].volume, 0.15);
  assert.equal(e.videos[0].paused, true);
  assert.equal(e.videos[0].muted, true);
});
test('without video it ends without confirming attenuation', async () => {
  const e = scenario();
  const result = e.aplicar(0.15);
  await e.avanzar(6001);
  assert.equal((await result).videos, 0);
});
test('a replaced ramp neither confirms success nor overwrites the new volume', async () => {
  const e = scenario();
  e.videos.push({ volume: 1, paused: false, muted: false });
  const old = assert.rejects(e.aplicar(0.6, 400), /reemplazada/);
  const fresh = e.aplicar(0.1, 150);
  await e.avanzar(150);
  await old;
  assert.equal((await fresh).videos, 1);
  assert.equal(e.videos[0].volume, 0.1);
});
