import assert from 'node:assert/strict';
import { messageLogger, silentLogger } from '../shared/logging.js';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DEFAULT_CONFIG, readConfig, msUntilTime, validateConfig } from './config.js';
test('missing config.json: created with the default values', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-config-'));
  try {
    const filePath = join(root, 'config.json');
    assert.deepEqual(readConfig(filePath), DEFAULT_CONFIG);
    assert.equal(existsSync(filePath), true);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), DEFAULT_CONFIG);
    assert.deepEqual(readdirSync(root), ['config.json']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('a failure creating config.json is reported and does not fake a successful save', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-config-'));
  const messages: string[] = [];
  try {
    const filePath = join(root, 'no-existe', 'config.json');
    assert.throws(
      () =>
        readConfig(
          filePath,
          messageLogger((m) => messages.push(m)),
        ),
      /No se pudo crear config.json/,
    );
    assert.match(messages[0], /No se pudo crear config.json/);
    assert.equal(existsSync(filePath), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('partial values are merged; invalid ones and unknown keys use the default and are logged', () => {
  const logs: string[] = [];
  const config = validateConfig(
    {
      repeticiones: 1,
      volumenMusica: 1.5,
      recargaDiaria: '25:00',
      mensajes: ['Hola'],
      color: 'rojo',
    },
    messageLogger((m) => logs.push(m)),
  );
  assert.equal(config.repeticiones, 1);
  assert.equal(config.volumenMusica, DEFAULT_CONFIG.volumenMusica);
  assert.equal(config.recargaDiaria, '04:00');
  assert.deepEqual(config.mensajes, ['Hola']);
  assert.equal(logs.length, 3);
});
test('an unknown legacy key does not break configuration validation', () => {
  const messages: string[] = [];
  const config = validateConfig(
    JSON.parse('{"__proto__":{"youtubeUrl":"malicioso"}}'),
    messageLogger((m) => messages.push(m)),
  );
  assert.deepEqual(config, DEFAULT_CONFIG);
  assert.match(messages[0], /clave desconocida/);
});
test('corrupt JSON at startup: default values without overwriting the administrator file', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-config-'));
  try {
    const filePath = join(root, 'config.json');
    writeFileSync(filePath, '{ "repeticiones": 1, ');
    assert.deepEqual(readConfig(filePath, silentLogger), DEFAULT_CONFIG);
    assert.equal(readFileSync(filePath, 'utf8'), '{ "repeticiones": 1, ');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('msUntilTime points to the next local occurrence', () => {
  const now = new Date(2026, 8, 11, 3, 30);
  assert.equal(msUntilTime('04:00', now), 30 * 60 * 1000);
  assert.equal(msUntilTime('03:30', now), 24 * 60 * 60 * 1000);
});
