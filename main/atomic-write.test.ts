import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { writeJsonAtomic } from './atomic-write.js';
test('escritura atómica crea y reemplaza JSON sin dejar temporales', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turnero-atomico-'));
  try {
    const filePath = join(dir, 'config.json');
    writeJsonAtomic(filePath, { valor: 1 });
    writeJsonAtomic(filePath, { valor: 2 });
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), { valor: 2 });
    assert.deepEqual(readdirSync(dir), ['config.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('reintenta un bloqueo temporal de Windows y luego reemplaza el original', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turnero-atomico-'));
  try {
    const filePath = join(dir, 'config.json');
    writeFileSync(filePath, 'original');
    let attempts = 0;
    writeJsonAtomic(filePath, { valor: 2 }, undefined, {
      renombrar: (source, destination) => {
        if (++attempts < 3) throw Object.assign(new Error('ocupado'), { code: 'EBUSY' });
        renameSync(source, destination);
      },
      esperar: () => {},
    });
    assert.equal(attempts, 3);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), { valor: 2 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('un fallo de rename conserva el original y limpia el temporal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turnero-atomico-'));
  try {
    const filePath = join(dir, 'config.json');
    writeFileSync(filePath, 'original');
    assert.throws(
      () =>
        writeJsonAtomic(filePath, { valor: 2 }, undefined, {
          renombrar: () => {
            throw Object.assign(new Error('sin permiso'), { code: 'EACCES' });
          },
          esperar: () => {},
        }),
      /sin permiso/,
    );
    assert.equal(readFileSync(filePath, 'utf8'), 'original');
    assert.deepEqual(readdirSync(dir), ['config.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
