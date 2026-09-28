import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { IPC_CHANNELS } from '../shared/ipc-channels.js';

test('the sandboxed preload exposes only declared IPC channels', () => {
  // Electron's sandboxed preload cannot import local modules, so its literals are checked here.
  const preload = readFileSync(join(import.meta.dirname, 'preload.cts'), 'utf8');
  const channels = [...preload.matchAll(/['"](turnero:[^'"]+)['"]/g)].map((match) => match[1]);
  assert.deepEqual(channels.sort(), Object.values(IPC_CHANNELS).sort());
});
