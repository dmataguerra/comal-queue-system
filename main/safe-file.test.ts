import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileWithin } from './safe-file.js';

test('only regular files within the content root are served', async () => {
  const base = mkdtempSync(join(tmpdir(), 'comal-safe-file-'));
  const root = join(base, 'content');
  try {
    mkdirSync(join(root, 'videos'), { recursive: true });
    writeFileSync(join(root, 'videos', 'clip.webm'), 'video');
    writeFileSync(join(base, 'private.txt'), 'private');

    // Windows runners can expose TEMP through an 8.3 alias (RUNNER~1).
    assert.equal(
      await fileWithin(root, 'videos/clip.webm'),
      await realpath(resolve(root, 'videos/clip.webm')),
    );
    assert.equal(await fileWithin(root, 'videos'), null);
    assert.equal(await fileWithin(root, 'videos/missing.webm'), null);
    assert.equal(await fileWithin(root, '../private.txt'), null);
    assert.equal(await fileWithin(root, ''), null);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
