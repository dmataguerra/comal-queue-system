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
import { crearRespaldo, restaurarRespaldo } from './respaldo.js';

const estadoValido = JSON.stringify({
  fecha: '2026-09-25',
  actual: 42,
  llamados: [],
  guardadoEn: '2026-09-25T12:00:00.000Z',
});

test('respaldo atómico conserva estructura, crea nombres únicos y restaura solo con app cerrada', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-respaldo-'));
  const datos = join(raiz, 'datos');
  const copias = join(raiz, 'copias');
  try {
    mkdirSync(join(datos, 'contenido', 'voz'), { recursive: true });
    writeFileSync(join(datos, 'config.json'), '{"volumenVoz":1}');
    writeFileSync(join(datos, 'estado.json'), estadoValido);
    writeFileSync(join(datos, 'contenido', 'voz', '42.wav'), 'audio');
    writeFileSync(join(datos, 'contenido', 'voz', '.copia.tmp'), 'temporal');
    writeFileSync(join(datos, 'turnero.log.1'), 'registro anterior');
    writeFileSync(join(datos, 'estado.json.tmp'), 'temporal incompleto');
    const primera = crearRespaldo(datos, copias, new Date('2026-09-25T12:00:00Z'));
    const segunda = crearRespaldo(datos, copias, new Date('2026-09-25T12:00:00Z'));
    assert.notEqual(primera, segunda);
    assert.equal(readFileSync(join(primera, 'contenido', 'voz', '42.wav'), 'utf8'), 'audio');
    assert.equal(existsSync(join(primera, 'contenido', 'voz', '.copia.tmp')), false);
    assert.equal(readFileSync(join(primera, 'turnero.log.1'), 'utf8'), 'registro anterior');
    assert.equal(existsSync(join(primera, 'estado.json.tmp')), false);
    assert.equal(
      readdirSync(copias).some((n) => n.endsWith('.tmp')),
      false,
    );
    writeFileSync(join(datos, 'estado.json'), '{"turno":99}');
    assert.throws(() => restaurarRespaldo(primera, datos, false), /Cierre la aplicación/);
    const anterior = restaurarRespaldo(primera, datos, true);
    assert.equal(readFileSync(join(datos, 'estado.json'), 'utf8'), estadoValido);
    assert.equal(readFileSync(join(datos, 'turnero.log.1'), 'utf8'), 'registro anterior');
    assert.equal(readFileSync(join(anterior!, 'estado.json'), 'utf8'), '{"turno":99}');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('restauración limpia preserva datos válidos y rechaza corrupción antes de tocar el destino', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-restaurar-'));
  try {
    const datos = join(raiz, 'datos');
    mkdirSync(datos);
    writeFileSync(join(datos, 'estado.json'), estadoValido);
    writeFileSync(join(datos, 'config.json'), '{"repeticiones":2}');
    const copia = crearRespaldo(datos, join(raiz, 'copias'));
    const limpio = join(raiz, 'limpio');
    assert.equal(restaurarRespaldo(copia, limpio, true), null);
    assert.throws(() => restaurarRespaldo(copia, join(copia, 'datos'), true), /separados/);
    assert.throws(() => restaurarRespaldo(copia, raiz, true), /separados/);
    assert.equal(readFileSync(join(limpio, 'estado.json'), 'utf8'), estadoValido);
    for (const texto of [
      '{',
      '{}',
      estadoValido.replace('2026-09-25', '2026-02-30'),
      estadoValido.replace('"actual":42', '"actual":100'),
    ]) {
      writeFileSync(join(copia, 'estado.json'), texto);
      assert.throws(() => restaurarRespaldo(copia, limpio, true), /no es JSON|inválid/);
      assert.equal(readFileSync(join(limpio, 'estado.json'), 'utf8'), estadoValido);
      assert.equal(
        readdirSync(raiz).some(
          (n) => n.includes('antes-de-restaurar') || n.includes('.restaurar-'),
        ),
        false,
      );
    }
    writeFileSync(join(copia, 'estado.json'), estadoValido);
    writeFileSync(join(copia, 'config.json'), '{"repeticiones":9}');
    assert.throws(() => restaurarRespaldo(copia, limpio, true), /config.json.*inválidos/);
    assert.equal(readFileSync(join(limpio, 'config.json'), 'utf8'), '{"repeticiones":2}');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('respaldo fallido no publica una carpeta incompleta', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-respaldo-'));
  try {
    const datos = join(raiz, 'datos');
    mkdirSync(datos);
    assert.throws(() => crearRespaldo(datos, join(raiz, 'copias')), /No hay datos/);
    assert.deepEqual(readdirSync(join(raiz, 'copias')), []);
    assert.equal(existsSync(join(datos, 'config.json')), false);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
