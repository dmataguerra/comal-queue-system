import assert from 'node:assert/strict';
import { test } from 'node:test';
import { iniciarYouTube } from '../vistas/publica/youtubeApi.ts';

function player(events) {
  return {
    mute: () => events.push('mute'),
    setLoop: () => events.push('loop'),
    unMute: () => events.push('unmute'),
    playVideo: () => events.push('play'),
  };
}

test('YouTube no inicia ni quita silencio hasta confirmar volumen', async () => {
  const events = [];
  let confirm;
  const ack = new Promise((resolve) => {
    confirm = resolve;
  });
  const starting = iniciarYouTube(
    player(events),
    () => 0.15,
    async (v) => {
      events.push(v);
      return ack;
    },
    () => true,
  );
  assert.deepEqual(events, ['mute', 'loop', 0.15]);
  confirm(1);
  assert.equal(await starting, true);
  assert.deepEqual(events, ['mute', 'loop', 0.15, 'unmute', 'play']);
});

test('YouTube aplica el ducking nuevo si cambia mientras espera la primera carga', async () => {
  const events = [];
  let volume = 0.6;
  const starting = iniciarYouTube(
    player(events),
    () => volume,
    async (v) => {
      events.push(v);
      volume = 0.09;
      return 1;
    },
    () => true,
  );
  assert.equal(await starting, true);
  assert.deepEqual(events, ['mute', 'loop', 0.6, 0.09, 'unmute', 'play']);
});

test('YouTube sin video o transporte desconectado rechaza sin iniciar', async () => {
  for (const ajustar of [
    async () => 0,
    async () => {
      throw new Error('desconectado');
    },
  ]) {
    const events = [];
    await assert.rejects(
      iniciarYouTube(
        player(events),
        () => 0.6,
        ajustar,
        () => true,
      ),
      /confirmó|desconectado/,
    );
    assert.deepEqual(events, ['mute', 'loop']);
  }
});

test('una carga de YouTube retirada no inicia tras llegar su confirmación', async () => {
  const events = [];
  let active = true;
  const started = await iniciarYouTube(
    player(events),
    () => 0.6,
    async () => {
      active = false;
      return 1;
    },
    () => active,
  );
  assert.equal(started, false);
  assert.deepEqual(events, ['mute', 'loop']);
});
