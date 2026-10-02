import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cerrarAudio, precargar, reproducir } from '../vistas/publica/audio.ts';

test('audio: una nueva revisión recarga bytes bajo la misma URL; una revisión estable usa cache', async (t) => {
  const originalFetch = globalThis.fetch,
    originalContext = globalThis.AudioContext;
  let descargas = 0;
  globalThis.fetch = async () => {
    descargas++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  globalThis.AudioContext = class {
    async decodeAudioData() {
      return { duration: 1 };
    }
    async close() {}
  };
  t.after(() => {
    cerrarAudio();
    globalThis.fetch = originalFetch;
    globalThis.AudioContext = originalContext;
  });
  const inventario = {
    revisionAudio: 'v1',
    aviso: 'https://test.invalid/aviso.wav',
    voz: [],
    videos: [],
    banner: [],
  };
  await precargar(inventario);
  await precargar(inventario);
  assert.equal(descargas, 1);
  await precargar({ ...inventario, revisionAudio: 'v2' });
  assert.equal(descargas, 2);
});

for (const caso of [
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
  test(`audio: ${caso} libera recursos o rechaza la espera`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const originalFetch = globalThis.fetch;
    const originalContext = globalThis.AudioContext;
    let desconexiones = 0;
    let inicio;
    const iniciado = new Promise((resolve) => {
      inicio = resolve;
    });
    const fuente = {
      connect: () => ganancia,
      disconnect: () => {
        desconexiones++;
      },
      stop() {},
      start() {
        inicio();
        if (caso === 'start-falla') throw new Error('start falló');
      },
      onended: null,
    };
    const ganancia = {
      gain: {},
      connect() {},
      disconnect: () => {
        desconexiones++;
      },
    };
    globalThis.fetch =
      caso === 'carga-bloqueada'
        ? () => new Promise(() => {})
        : async () => ({
            ok: caso !== 'http-falla',
            status: 404,
            arrayBuffer: async () => new ArrayBuffer(0),
          });
    let ctx;
    globalThis.AudioContext = class extends EventTarget {
      state = ['resume-bloqueado', 'resume-sin-dispositivo'].includes(caso)
        ? 'suspended'
        : 'running';
      constructor() {
        super();
        ctx = this;
      }
      async decodeAudioData() {
        if (caso === 'decode-falla') throw new Error('decode falló');
        return { duration: 1 };
      }
      resume() {
        inicio();
        if (caso === 'resume-sin-dispositivo') return Promise.resolve();
        return new Promise(() => {});
      }
      createBufferSource() {
        return fuente;
      }
      createGain() {
        return ganancia;
      }
      async close() {}
    };
    t.after(() => {
      cerrarAudio();
      globalThis.fetch = originalFetch;
      globalThis.AudioContext = originalContext;
    });
    const control = new AbortController();
    const resultado = reproducir('https://test.invalid/voz.wav', 1, control.signal);
    const verificacion = ['termina', 'cancela'].includes(caso)
      ? assert.doesNotReject(resultado)
      : assert.rejects(resultado, /tiempo|Tiempo|start|sonido|dispositivo|decodificar|HTTP/);
    if (!['carga-bloqueada', 'decode-falla', 'http-falla'].includes(caso)) await iniciado;
    if (caso === 'termina') fuente.onended();
    else if (caso === 'cancela') control.abort();
    else if (caso === 'dispositivo-desconectado') {
      ctx.state = 'suspended';
      ctx.dispatchEvent(new Event('statechange'));
    } else if (caso !== 'start-falla') t.mock.timers.tick(21000);
    await verificacion;
    assert.equal(
      desconexiones,
      [
        'resume-bloqueado',
        'resume-sin-dispositivo',
        'carga-bloqueada',
        'decode-falla',
        'http-falla',
      ].includes(caso)
        ? 0
        : 2,
    );
  });
}
