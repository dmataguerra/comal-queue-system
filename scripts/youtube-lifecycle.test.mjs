import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startYouTube } from '../views/display/youtubeApi.js';
function player(events) {
  return {
    mute: () => events.push('mute'),
    setLoop: () => events.push('loop'),
    unMute: () => events.push('unmute'),
    playVideo: () => events.push('play'),
  };
}
test('YouTube neither starts nor unmutes until volume is confirmed', async () => {
  const events = [];
  let confirm;
  const ack = new Promise((resolve) => {
    confirm = resolve;
  });
  const starting = startYouTube(
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
test('YouTube applies the new ducking if it changes while waiting for the first load', async () => {
  const events = [];
  let volume = 0.6;
  const starting = startYouTube(
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
test('YouTube with no video or a disconnected transport rejects without starting', async () => {
  for (const adjustVolume of [
    async () => 0,
    async () => {
      throw new Error('desconectado');
    },
  ]) {
    const events = [];
    await assert.rejects(
      startYouTube(
        player(events),
        () => 0.6,
        adjustVolume,
        () => true,
      ),
      /confirmó|desconectado/,
    );
    assert.deepEqual(events, ['mute', 'loop']);
  }
});
test('a withdrawn YouTube load does not start after its confirmation arrives', async () => {
  const events = [];
  let active = true;
  const started = await startYouTube(
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
