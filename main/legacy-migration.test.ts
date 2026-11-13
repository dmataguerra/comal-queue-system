import assert from 'node:assert/strict';
import { silentLogger } from '../shared/logging.js';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { migrateFrom02 } from './legacy-migration.js';
test('migra turnos y configuración de 0.2.0 sin alterar la base anterior ni repetir la migración', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-migracion-'));
  const data = join(root, 'datos');
  const basePath = join(root, 'comal.sqlite');
  const now = new Date(2026, 8, 26, 11, 0);
  try {
    mkdirSync(data);
    const db = new DatabaseSync(basePath);
    db.exec(
      'CREATE TABLE turns(number TEXT, last_announced_at TEXT, status TEXT, rank INTEGER); CREATE TABLE configuration(key TEXT, value TEXT)',
    );
    db.prepare('INSERT INTO turns VALUES (?, ?, ?, ?)').run(
      '42',
      new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
      'ready',
      2,
    );
    db.prepare('INSERT INTO turns VALUES (?, ?, ?, ?)').run('41', now.toISOString(), 'ready', 1);
    db.prepare('INSERT INTO turns VALUES (?, ?, ?, ?)').run(
      '40',
      now.toISOString(),
      'delivered',
      3,
    );
    db.prepare('INSERT INTO configuration VALUES (?, ?)').run(
      'settings',
      JSON.stringify({ footerMessages: ['Bienvenidos'] }),
    );
    db.close();
    const original = readFileSync(basePath);
    assert.equal(migrateFrom02(basePath, data, silentLogger, now), true);
    const state = JSON.parse(readFileSync(join(data, 'estado.json'), 'utf8'));
    const config = JSON.parse(readFileSync(join(data, 'config.json'), 'utf8'));
    assert.deepEqual([state.actual, state.llamados], [42, [41]]);
    assert.equal(state.desde['42'], now.toISOString());
    assert.deepEqual(config.mensajes, ['Bienvenidos']);
    assert.equal(existsSync(basePath), true);
    assert.deepEqual(readFileSync(basePath), original);
    assert.equal(migrateFrom02(basePath, data, silentLogger, now), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('configuración legacy corrupta rechaza migración sin modificar SQLite ni publicar estado vacío', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-migracion-corrupta-'));
  const data = join(root, 'datos');
  const basePath = join(root, 'comal.sqlite');
  try {
    mkdirSync(data);
    const db = new DatabaseSync(basePath);
    db.exec(
      'CREATE TABLE turns(number TEXT, last_announced_at TEXT, status TEXT, rank INTEGER); CREATE TABLE configuration(key TEXT, value TEXT)',
    );
    db.prepare('INSERT INTO configuration VALUES (?, ?)').run('settings', '{');
    db.close();
    const original = readFileSync(basePath);
    assert.throws(() => migrateFrom02(basePath, data), /No se pudo migrar/);
    assert.deepEqual(readFileSync(basePath), original);
    assert.equal(existsSync(join(data, 'estado.json')), false);
    assert.equal(existsSync(join(data, 'config.json')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
