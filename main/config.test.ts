import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
    assert.deepEqual(readdirSync(raiz), ['config.json']);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('un fallo al crear config.json se informa y no simula guardado correcto', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-config-'));
  const mensajes: string[] = [];
  try {
    const ruta = join(raiz, 'no-existe', 'config.json');
    assert.throws(() => leerConfig(ruta, (m) => mensajes.push(m)), /No se pudo crear config.json/);
    assert.match(mensajes[0], /No se pudo crear config.json/);
    assert.equal(existsSync(ruta), false);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('valores parciales se mezclan; inválidos y claves desconocidas usan el default y se registran', () => {
  const registro: string[] = [];
  const config = validarConfig(
    {
      repeticiones: 1,
      volumenMusica: 1.5,
      recargaDiaria: '25:00',
      mensajes: ['Hola'],
      color: 'rojo',
    },
    (m) => registro.push(m),
  );
  assert.equal(config.repeticiones, 1);
  assert.equal(config.volumenMusica, CONFIG_POR_DEFECTO.volumenMusica);
  assert.equal(config.recargaDiaria, '04:00');
  assert.deepEqual(config.mensajes, ['Hola']);
  assert.equal(registro.length, 3);
});

test('una clave heredada desconocida no rompe la validación de configuración', () => {
  const mensajes: string[] = [];
  const config = validarConfig(JSON.parse('{"__proto__":{"youtubeUrl":"malicioso"}}'), (m) =>
    mensajes.push(m),
  );
  assert.deepEqual(config, CONFIG_POR_DEFECTO);
  assert.match(mensajes[0], /clave desconocida/);
});

test('JSON dañado al arrancar: valores por defecto sin sobrescribir el archivo del administrador', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-config-'));
  try {
    const ruta = join(raiz, 'config.json');
    writeFileSync(ruta, '{ "repeticiones": 1, ');
    assert.deepEqual(
      leerConfig(ruta, () => {}),
      CONFIG_POR_DEFECTO,
    );
    assert.equal(readFileSync(ruta, 'utf8'), '{ "repeticiones": 1, ');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('msHastaHora apunta a la próxima ocurrencia local', () => {
  const ahora = new Date(2026, 8, 11, 3, 30);
  assert.equal(msHastaHora('04:00', ahora), 30 * 60 * 1000);
  assert.equal(msHastaHora('03:30', ahora), 24 * 60 * 60 * 1000);
});
