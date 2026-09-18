import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CONFIG_POR_DEFECTO, leerConfig, msHastaHora, validarConfig } from './config.js';

test('config.json ausente: se crea con los valores por defecto', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-config-'));
  try {
    const ruta = join(raiz, 'config.json');
    assert.deepEqual(leerConfig(ruta), CONFIG_POR_DEFECTO);
    assert.equal(existsSync(ruta), true);
    assert.deepEqual(JSON.parse(readFileSync(ruta, 'utf8')), CONFIG_POR_DEFECTO);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('valores parciales se mezclan; inválidos y claves desconocidas usan el default y se registran', () => {
  const registro: string[] = [];
  const config = validarConfig({ repeticiones: 1, volumenMusica: 1.5, recargaDiaria: '25:00', mensajes: ['Hola'], color: 'rojo' }, (m) => registro.push(m));
  assert.equal(config.repeticiones, 1);
  assert.equal(config.volumenMusica, CONFIG_POR_DEFECTO.volumenMusica);
  assert.equal(config.recargaDiaria, '04:00');
  assert.deepEqual(config.mensajes, ['Hola']);
  assert.equal(registro.length, 3);
});

test('JSON dañado al arrancar: valores por defecto sin sobrescribir el archivo del administrador', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-config-'));
  try {
    const ruta = join(raiz, 'config.json');
    writeFileSync(ruta, '{ "repeticiones": 1, ');
    assert.deepEqual(leerConfig(ruta, () => {}), CONFIG_POR_DEFECTO);
    assert.equal(readFileSync(ruta, 'utf8'), '{ "repeticiones": 1, ');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('msHastaHora apunta a la próxima ocurrencia local', () => {
  const ahora = new Date(2026, 8, 11, 3, 30);
  assert.equal(msHastaHora('04:00', ahora), 30 * 60 * 1000);
  assert.equal(msHastaHora('03:30', ahora), 24 * 60 * 60 * 1000);
});
