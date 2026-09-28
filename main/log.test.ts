import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { crearRegistro } from './log.js';

test('crea JSON por línea y suprime errores idénticos', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'comal-log-'));
  try {
    const ruta = join(carpeta, 'turnero.log');
    const registrar = crearRegistro(ruta, { version: '0.3.0', repeticionMs: 30_000 });
    registrar('No se pudo guardar estado.json');
    registrar('No se pudo guardar estado.json');
    registrar('Persistencia restaurada');
    const lineas = readFileSync(ruta, 'utf8')
      .trim()
      .split('\n')
      .map((linea) => JSON.parse(linea));
    assert.equal(lineas.length, 3);
    assert.equal(lineas[0].nivel, 'error');
    assert.equal(lineas[0].version, '0.3.0');
    assert.match(lineas[1].mensaje, /repetido 1 veces/);
    assert.equal(lineas[2].mensaje, 'Persistencia restaurada');
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

test('rota por tamaño y conserva solo el máximo configurado', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'comal-log-'));
  try {
    const ruta = join(carpeta, 'turnero.log');
    const registrar = crearRegistro(ruta, { maxBytes: 300, maxArchivos: 2, repeticionMs: 0 });
    for (let n = 0; n < 12; n++) registrar(`Evento ${n}`);
    assert.deepEqual(readdirSync(carpeta).sort(), [
      'turnero.log',
      'turnero.log.1',
      'turnero.log.2',
    ]);
    assert.match(readFileSync(ruta, 'utf8'), /Evento 11/);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

test('ruta de log no disponible no lanza ni crea archivos ajenos', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'comal-log-'));
  try {
    const ruta = join(carpeta, 'inexistente', 'turnero.log');
    const registrar = crearRegistro(ruta);
    assert.doesNotThrow(() => registrar('Error controlado'));
    assert.equal(existsSync(ruta), false);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});
