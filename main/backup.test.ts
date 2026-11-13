import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createBackup, restoreBackup } from './backup.js';
const validState = JSON.stringify({
  fecha: '2026-09-25',
  actual: 42,
  llamados: [],
  guardadoEn: '2026-09-25T12:00:00.000Z',
});
test('atomic backup keeps the structure, creates unique names and restores only with the app closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-respaldo-'));
  const data = join(root, 'datos');
  const copies = join(root, 'copias');
  try {
    mkdirSync(join(data, 'contenido', 'voz'), { recursive: true });
    writeFileSync(join(data, 'config.json'), '{"volumenVoz":1}');
    writeFileSync(join(data, 'estado.json'), validState);
    writeFileSync(join(data, 'contenido', 'voz', '42.wav'), 'audio');
    writeFileSync(join(data, 'contenido', 'voz', '.copia.tmp'), 'temporal');
    writeFileSync(join(data, 'turnero.log.1'), 'registro anterior');
    writeFileSync(join(data, 'estado.json.tmp'), 'temporal incompleto');
    const first = createBackup(data, copies, new Date('2026-09-25T12:00:00Z'));
    const second = createBackup(data, copies, new Date('2026-09-25T12:00:00Z'));
    assert.notEqual(first, second);
    assert.equal(readFileSync(join(first, 'contenido', 'voz', '42.wav'), 'utf8'), 'audio');
    assert.equal(existsSync(join(first, 'contenido', 'voz', '.copia.tmp')), false);
    assert.equal(readFileSync(join(first, 'turnero.log.1'), 'utf8'), 'registro anterior');
    assert.equal(existsSync(join(first, 'estado.json.tmp')), false);
    assert.equal(
      readdirSync(copies).some((n) => n.endsWith('.tmp')),
      false,
    );
    writeFileSync(join(data, 'estado.json'), '{"turno":99}');
    assert.throws(() => restoreBackup(first, data, false), /Cierre la aplicación/);
    const previous = restoreBackup(first, data, true);
    assert.equal(readFileSync(join(data, 'estado.json'), 'utf8'), validState);
    assert.equal(readFileSync(join(data, 'turnero.log.1'), 'utf8'), 'registro anterior');
    assert.equal(readFileSync(join(previous!, 'estado.json'), 'utf8'), '{"turno":99}');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('clean restore preserves valid data and rejects corruption before touching the destination', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-restaurar-'));
  try {
    const data = join(root, 'datos');
    mkdirSync(data);
    writeFileSync(join(data, 'estado.json'), validState);
    writeFileSync(join(data, 'config.json'), '{"repeticiones":2}');
    const copy = createBackup(data, join(root, 'copias'));
    const clean = join(root, 'limpio');
    assert.equal(restoreBackup(copy, clean, true), null);
    assert.throws(() => restoreBackup(copy, join(copy, 'datos'), true), /separados/);
    assert.throws(() => restoreBackup(copy, root, true), /separados/);
    assert.equal(readFileSync(join(clean, 'estado.json'), 'utf8'), validState);
    for (const text of [
      '{',
      '{}',
      validState.replace('2026-09-25', '2026-02-30'),
      validState.replace('"actual":42', '"actual":100'),
    ]) {
      writeFileSync(join(copy, 'estado.json'), text);
      assert.throws(() => restoreBackup(copy, clean, true), /no es JSON|inválid/);
      assert.equal(readFileSync(join(clean, 'estado.json'), 'utf8'), validState);
      assert.equal(
        readdirSync(root).some(
          (n) => n.includes('antes-de-restaurar') || n.includes('.restaurar-'),
        ),
        false,
      );
    }
    writeFileSync(join(copy, 'estado.json'), validState);
    writeFileSync(join(copy, 'config.json'), '{"repeticiones":9}');
    assert.throws(() => restoreBackup(copy, clean, true), /config.json.*inválidos/);
    assert.equal(readFileSync(join(clean, 'config.json'), 'utf8'), '{"repeticiones":2}');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('a failed backup does not publish an incomplete folder', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-respaldo-'));
  try {
    const data = join(root, 'datos');
    mkdirSync(data);
    assert.throws(() => createBackup(data, join(root, 'copias')), /No hay datos/);
    assert.deepEqual(readdirSync(join(root, 'copias')), []);
    assert.equal(existsSync(join(data, 'config.json')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
