import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isYouTube, parseYouTube } from './youtube.js';
test('YouTube accepts videos, short links and playlists', () => {
  for (const url of [
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
  ]) {
    assert.equal(parseYouTube(url).videoId, 'dQw4w9WgXcQ');
  }
  assert.equal(
    parseYouTube('https://youtube.com/playlist?list=PL1234567890').playlistId,
    'PL1234567890',
  );
});
test('YouTube rejects look-alike domains, protocols and malformed parameters', () => {
  for (const url of [
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    'https://youtube.com',
    'https://youtube.com/watch?v=bad',
    'https://evil@youtube.com/watch?v=dQw4w9WgXcQ',
  ])
    assert.equal(isYouTube(url), false);
});
