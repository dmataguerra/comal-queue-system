import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { limpiarTemporalesJson } from './temporales.js';

test('inicio retira solo temporales JSON antiguos de nombre conocido', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'comal-temporales-'));
  try {
    const viejo = join(carpeta, 'estado.json.123.12345678-1234-1234-1234-123456789abc.tmp');
    const reciente = join(carpeta, 'config.json.456.12345678-1234-1234-1234-123456789abc.tmp');
    const ajeno = join(carpeta, 'otro.json.123.12345678-1234-1234-1234-123456789abc.tmp');
    const original = join(carpeta, 'estado.json');
    for (const ruta of [viejo, reciente, ajeno, original]) writeFileSync(ruta, '{}');
    const ahora = Date.now();
    utimesSync(viejo, new Date(ahora - 120_000), new Date(ahora - 120_000));
    assert.equal(
      limpiarTemporalesJson(carpeta, () => {}, ahora),
      1,
    );
    assert.equal(existsSync(viejo), false);
    assert.equal(existsSync(reciente), true);
    assert.equal(existsSync(ajeno), true);
    assert.equal(existsSync(original), true);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});
