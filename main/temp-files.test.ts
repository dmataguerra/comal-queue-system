import assert from 'node:assert/strict';
import { silentLogger } from '../shared/logging.js';
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { cleanTempJsonFiles } from './temp-files.js';
test('inicio retira solo temporales JSON antiguos de nombre conocido', () => {
  const folder = mkdtempSync(join(tmpdir(), 'comal-temporales-'));
  try {
    const old = join(folder, 'estado.json.123.12345678-1234-1234-1234-123456789abc.tmp');
    const recent = join(folder, 'config.json.456.12345678-1234-1234-1234-123456789abc.tmp');
    const foreign = join(folder, 'otro.json.123.12345678-1234-1234-1234-123456789abc.tmp');
    const original = join(folder, 'estado.json');
    for (const filePath of [old, recent, foreign, original]) writeFileSync(filePath, '{}');
    const now = Date.now();
    utimesSync(old, new Date(now - 120000), new Date(now - 120000));
    assert.equal(cleanTempJsonFiles(folder, silentLogger, now), 1);
    assert.equal(existsSync(old), false);
    assert.equal(existsSync(recent), true);
    assert.equal(existsSync(foreign), true);
    assert.equal(existsSync(original), true);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
