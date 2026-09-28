import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { scriptVolumen } from './volumen-youtube.js';

function escenario() {
  let ahora = 0;
  const tareas: (() => void)[] = [];
  const videos: { volume: number; paused: boolean; muted: boolean }[] = [];
  const contexto = createContext({
    window: {},
    document: { querySelectorAll: () => videos },
    performance: { now: () => ahora },
    setTimeout: (fn: () => void) => tareas.push(fn),
  });
  return {
    videos,
    aplicar: (volumen: number, rampa = 0) =>
      runInContext(scriptVolumen(volumen, rampa), contexto) as Promise<{ videos: number }>,
    async avanzar(ms: number) {
      ahora += ms;
      for (const tarea of tareas.splice(0)) tarea();
      await Promise.resolve();
    },
  };
}

test('una solicitud antigua esperando video no restaura volumen sobre un ducking nuevo', async () => {
  const e = escenario();
  const antigua = e.aplicar(1);
  const nueva = e.aplicar(0.15);
  e.videos.push({ volume: 1, paused: false, muted: false });
  await e.avanzar(50);
  assert.equal((await antigua).videos, 0);
  assert.equal((await nueva).videos, 1);
  assert.equal(e.videos[0].volume, 0.15);
});

test('confirma solo al terminar la rampa y respeta pausa y silencio', async () => {
  const e = escenario();
  e.videos.push({ volume: 1, paused: true, muted: true });
  let confirmado = false;
  const resultado = e.aplicar(0.15, 150).then(() => {
    confirmado = true;
  });
  await e.avanzar(75);
  assert.equal(confirmado, false);
  assert.ok(e.videos[0].volume > 0.15);
  await e.avanzar(75);
  await resultado;
  assert.equal(e.videos[0].volume, 0.15);
  assert.equal(e.videos[0].paused, true);
  assert.equal(e.videos[0].muted, true);
});

test('sin video termina sin confirmar atenuación', async () => {
  const e = escenario();
  const resultado = e.aplicar(0.15);
  await e.avanzar(6001);
  assert.equal((await resultado).videos, 0);
});
