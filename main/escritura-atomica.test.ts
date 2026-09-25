import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { escribirJsonAtomico } from './escritura-atomica.js';

test('escritura atómica crea y reemplaza JSON sin dejar temporales', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turnero-atomico-'));
  try {
    const ruta = join(dir, 'config.json');
    escribirJsonAtomico(ruta, { valor: 1 });
    escribirJsonAtomico(ruta, { valor: 2 });
    assert.deepEqual(JSON.parse(readFileSync(ruta, 'utf8')), { valor: 2 });
    assert.deepEqual(readdirSync(dir), ['config.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('reintenta un bloqueo temporal de Windows y luego reemplaza el original', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turnero-atomico-'));
  try {
    const ruta = join(dir, 'config.json');
    writeFileSync(ruta, 'original');
    let intentos = 0;
    escribirJsonAtomico(ruta, { valor: 2 }, undefined, {
      renombrar: (origen, destino) => {
        if (++intentos < 3) throw Object.assign(new Error('ocupado'), { code: 'EBUSY' });
        renameSync(origen, destino);
      },
      esperar: () => {},
    });
    assert.equal(intentos, 3);
    assert.deepEqual(JSON.parse(readFileSync(ruta, 'utf8')), { valor: 2 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('un fallo de rename conserva el original y limpia el temporal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'turnero-atomico-'));
  try {
    const ruta = join(dir, 'config.json');
    writeFileSync(ruta, 'original');
    assert.throws(
      () =>
        escribirJsonAtomico(ruta, { valor: 2 }, undefined, {
          renombrar: () => {
            throw Object.assign(new Error('sin permiso'), { code: 'EACCES' });
          },
          esperar: () => {},
        }),
      /sin permiso/,
    );
    assert.equal(readFileSync(ruta, 'utf8'), 'original');
    assert.deepEqual(readdirSync(dir), ['config.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
