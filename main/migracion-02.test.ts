import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { migrarDesde02 } from './migracion-02.js';

test('migra turnos y configuración de 0.2.0 sin alterar la base anterior ni repetir la migración', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-migracion-'));
  const datos = join(raiz, 'datos');
  const rutaBase = join(raiz, 'comal.sqlite');
  const ahora = new Date(2026, 8, 26, 11, 0);
  try {
    mkdirSync(datos);
    const db = new DatabaseSync(rutaBase);
    db.exec(
      'CREATE TABLE turns(number TEXT, last_announced_at TEXT, status TEXT, rank INTEGER); CREATE TABLE configuration(key TEXT, value TEXT)',
    );
    db.prepare('INSERT INTO turns VALUES (?, ?, ?, ?)').run(
      '42',
      new Date(ahora.getTime() - 2 * 60 * 60_000).toISOString(),
      'ready',
      2,
    );
    db.prepare('INSERT INTO turns VALUES (?, ?, ?, ?)').run('41', ahora.toISOString(), 'ready', 1);
    db.prepare('INSERT INTO turns VALUES (?, ?, ?, ?)').run(
      '40',
      ahora.toISOString(),
      'delivered',
      3,
    );
    db.prepare('INSERT INTO configuration VALUES (?, ?)').run(
      'settings',
      JSON.stringify({ footerMessages: ['Bienvenidos'] }),
    );
    db.close();
    const original = readFileSync(rutaBase);
    assert.equal(
      migrarDesde02(rutaBase, datos, () => {}, ahora),
      true,
    );
    const estado = JSON.parse(readFileSync(join(datos, 'estado.json'), 'utf8'));
    const config = JSON.parse(readFileSync(join(datos, 'config.json'), 'utf8'));
    assert.deepEqual([estado.actual, estado.llamados], [42, [41]]);
    assert.equal(estado.desde['42'], ahora.toISOString());
    assert.deepEqual(config.mensajes, ['Bienvenidos']);
    assert.equal(existsSync(rutaBase), true);
    assert.deepEqual(readFileSync(rutaBase), original);
    assert.equal(
      migrarDesde02(rutaBase, datos, () => {}, ahora),
      false,
    );
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('configuración legacy corrupta rechaza migración sin modificar SQLite ni publicar estado vacío', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-migracion-corrupta-'));
  const datos = join(raiz, 'datos');
  const rutaBase = join(raiz, 'comal.sqlite');
  try {
    mkdirSync(datos);
    const db = new DatabaseSync(rutaBase);
    db.exec(
      'CREATE TABLE turns(number TEXT, last_announced_at TEXT, status TEXT, rank INTEGER); CREATE TABLE configuration(key TEXT, value TEXT)',
    );
    db.prepare('INSERT INTO configuration VALUES (?, ?)').run('settings', '{');
    db.close();
    const original = readFileSync(rutaBase);
    assert.throws(() => migrarDesde02(rutaBase, datos), /No se pudo migrar/);
    assert.deepEqual(readFileSync(rutaBase), original);
    assert.equal(existsSync(join(datos, 'estado.json')), false);
    assert.equal(existsSync(join(datos, 'config.json')), false);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
