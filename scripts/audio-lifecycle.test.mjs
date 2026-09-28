import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cerrarAudio, reproducir } from '../vistas/publica/audio.ts';

for (const caso of [
  'termina',
  'cancela',
  'sin-ended',
  'start-falla',
  'resume-bloqueado',
  'carga-bloqueada',
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
        : async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    globalThis.AudioContext = class {
      state = caso === 'resume-bloqueado' ? 'suspended' : 'running';
      async decodeAudioData() {
        return { duration: 1 };
      }
      resume() {
        inicio();
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
      : assert.rejects(resultado, /tiempo|Tiempo|start/);
    if (caso !== 'carga-bloqueada') await iniciado;
    if (caso === 'termina') fuente.onended();
    else if (caso === 'cancela') control.abort();
    else if (caso !== 'start-falla') t.mock.timers.tick(21000);
    await verificacion;
    assert.equal(desconexiones, ['resume-bloqueado', 'carga-bloqueada'].includes(caso) ? 0 : 2);
  });
}
