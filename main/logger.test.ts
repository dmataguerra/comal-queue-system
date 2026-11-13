import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLogger, type LogEntry } from './logger.js';
const withFolder = (run: (folder: string) => void) => {
  const folder = mkdtempSync(join(tmpdir(), 'comal-log-'));
  try {
    run(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};
const read = (path: string) =>
  readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as LogEntry);
test('writes one JSON entry per line with explicit level and collapses repeats', () =>
  withFolder((folder) => {
    const path = join(folder, 'turnero.log');
    const logger = createLogger(path, { version: '0.3.0', repeatWindowMs: 30000 });
    logger.error('No se pudo guardar estado.json', { code: 'STATE_SAVE_FAILED' });
    logger.error('No se pudo guardar estado.json', { code: 'STATE_SAVE_FAILED' });
    logger.info('Persistencia restaurada');
    const lines = read(path);
    assert.equal(lines.length, 3);
    assert.equal(lines[0].level, 'error');
    assert.equal(lines[0].version, '0.3.0');
    assert.deepEqual(lines[0].context, { code: 'STATE_SAVE_FAILED' });
    assert.match(lines[1].message, /repeated 1 times/);
    assert.equal(lines[2].message, 'Persistencia restaurada');
    assert.equal(lines[2].level, 'info');
  }));
test('level comes from the call, never from the message text', () =>
  withFolder((folder) => {
    const path = join(folder, 'turnero.log');
    const logger = createLogger(path, { repeatWindowMs: 0 });
    logger.info('contenido: se importaron fallas-error.png');
    logger.warn('Todo en orden');
    assert.deepEqual(
      read(path).map((line) => line.level),
      ['info', 'warn'],
    );
    assert.equal(logger.lastError(), null);
    logger.error('Fallo real');
    assert.equal(logger.lastError()?.message, 'Fallo real');
  }));
test('minLevel filters entries and child loggers tag the component', () =>
  withFolder((folder) => {
    const path = join(folder, 'turnero.log');
    const logger = createLogger(path, { minLevel: 'info', repeatWindowMs: 0 });
    logger.debug('oculto');
    logger.child('renderer:public').warn('visible');
    const lines = read(path);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].component, 'renderer:public');
  }));
test('rotates by size and keeps only the configured number of files', () =>
  withFolder((folder) => {
    const path = join(folder, 'turnero.log');
    const logger = createLogger(path, { maxBytes: 300, maxFiles: 2, repeatWindowMs: 0 });
    for (let n = 0; n < 12; n++) logger.info(`Evento ${n}`);
    assert.deepEqual(readdirSync(folder).sort(), ['turnero.log', 'turnero.log.1', 'turnero.log.2']);
    assert.match(readFileSync(path, 'utf8'), /Evento 11/);
  }));
test('an unavailable log path neither throws nor creates stray files', () =>
  withFolder((folder) => {
    const path = join(folder, 'missing', 'turnero.log');
    const logger = createLogger(path);
    const warn = console.warn;
    console.warn = () => {};
    try {
      assert.doesNotThrow(() => logger.error('Error controlado'));
    } finally {
      console.warn = warn;
    }
    assert.equal(existsSync(path), false);
  }));
