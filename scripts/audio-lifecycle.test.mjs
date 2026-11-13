import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeAudio, preload, play } from '../views/display/audio.js';
test('audio: una nueva revisión recarga bytes bajo la misma URL; una revisión estable usa cache', async (t) => {
  const originalFetch = globalThis.fetch,
    originalContext = globalThis.AudioContext;
  let downloads = 0;
  globalThis.fetch = async () => {
    downloads++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  globalThis.AudioContext = class {
    async decodeAudioData() {
      return { duration: 1 };
    }
    async close() {}
  };
  t.after(() => {
    closeAudio();
    globalThis.fetch = originalFetch;
    globalThis.AudioContext = originalContext;
  });
  const inventory = {
    revisionAudio: 'v1',
    aviso: 'https://test.invalid/aviso.wav',
    voz: [],
    videos: [],
    banner: [],
  };
  await preload(inventory);
  await preload(inventory);
  assert.equal(downloads, 1);
  await preload({ ...inventory, revisionAudio: 'v2' });
  assert.equal(downloads, 2);
});
for (const scenario of [
  'termina',
  'cancela',
  'sin-ended',
  'start-falla',
  'resume-bloqueado',
  'carga-bloqueada',
  'resume-sin-dispositivo',
  'dispositivo-desconectado',
  'decode-falla',
  'http-falla',
]) {
  test(`audio: ${scenario} libera recursos o rechaza la espera`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const originalFetch = globalThis.fetch;
    const originalContext = globalThis.AudioContext;
    let disconnections = 0;
    let signalStarted;
    const started = new Promise((resolve) => {
      signalStarted = resolve;
    });
    const source = {
      connect: () => gainNode,
      disconnect: () => {
        disconnections++;
      },
      stop() {},
      start() {
        signalStarted();
        if (scenario === 'start-falla') throw new Error('start falló');
      },
      onended: null,
    };
    const gainNode = {
      gain: {},
      connect() {},
      disconnect: () => {
        disconnections++;
      },
    };
    globalThis.fetch =
      scenario === 'carga-bloqueada'
        ? () => new Promise(() => {})
        : async () => ({
            ok: scenario !== 'http-falla',
            status: 404,
            arrayBuffer: async () => new ArrayBuffer(0),
          });
    let ctx;
    globalThis.AudioContext = class extends EventTarget {
      state = ['resume-bloqueado', 'resume-sin-dispositivo'].includes(scenario)
        ? 'suspended'
        : 'running';
      constructor() {
        super();
        ctx = this;
      }
      async decodeAudioData() {
        if (scenario === 'decode-falla') throw new Error('decode falló');
        return { duration: 1 };
      }
      resume() {
        signalStarted();
        if (scenario === 'resume-sin-dispositivo') return Promise.resolve();
        return new Promise(() => {});
      }
      createBufferSource() {
        return source;
      }
      createGain() {
        return gainNode;
      }
      async close() {}
    };
    t.after(() => {
      closeAudio();
      globalThis.fetch = originalFetch;
      globalThis.AudioContext = originalContext;
    });
    const control = new AbortController();
    const result = play('https://test.invalid/voz.wav', 1, control.signal);
    const verification = ['termina', 'cancela'].includes(scenario)
      ? assert.doesNotReject(result)
      : assert.rejects(result, /tiempo|Tiempo|start|sonido|dispositivo|decodificar|HTTP/);
    if (!['carga-bloqueada', 'decode-falla', 'http-falla'].includes(scenario)) await started;
    if (scenario === 'termina') source.onended();
    else if (scenario === 'cancela') control.abort();
    else if (scenario === 'dispositivo-desconectado') {
      ctx.state = 'suspended';
      ctx.dispatchEvent(new Event('statechange'));
    } else if (scenario !== 'start-falla') t.mock.timers.tick(21000);
    await verification;
    assert.equal(
      disconnections,
      [
        'resume-bloqueado',
        'resume-sin-dispositivo',
        'carga-bloqueada',
        'decode-falla',
        'http-falla',
      ].includes(scenario)
        ? 0
        : 2,
    );
  });
}
