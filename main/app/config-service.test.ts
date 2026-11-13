import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { silentLogger } from '../../shared/logging.js';
import { createConfigService } from './config-service.js';
import { readEnv } from './env.js';
test('update keeps validated settings when config.json on disk is invalid', () => {
  const folder = mkdtempSync(join(tmpdir(), 'comal-config-'));
  const path = join(folder, 'config.json');
  const changes: number[] = [];
  const service = createConfigService({
    path,
    logger: silentLogger,
    onChange: (next) => changes.push(next.volumenVoz),
  });
  try {
    service.update({ segundosBanner: 20 });
    // Someone is editing the file by hand and saved it half-way.
    writeFileSync(path, '{ "segundosBanner": ');
    service.update({ volumenVoz: 2 });
    const saved = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    assert.equal(saved.segundosBanner, 20, 'the earlier setting must survive');
    assert.equal(saved.volumenVoz, 2);
    assert.equal(service.get().volumenVoz, 2);
    assert.deepEqual(changes, [1, 2]);
  } finally {
    service.stop();
    rmSync(folder, { recursive: true, force: true });
  }
});
test('update with identical values does not notify', () => {
  const folder = mkdtempSync(join(tmpdir(), 'comal-config-'));
  let notified = 0;
  const service = createConfigService({
    path: join(folder, 'config.json'),
    logger: silentLogger,
    onChange: () => notified++,
  });
  try {
    service.update({ volumenVoz: service.get().volumenVoz });
    assert.equal(notified, 0);
  } finally {
    service.stop();
    rmSync(folder, { recursive: true, force: true });
  }
});
test('readEnv accepts numeric ports, including 0, and ignores invalid values', () => {
  assert.equal(readEnv({ TURNERO_PUERTO: '0' }).serverPort, 0);
  assert.equal(readEnv({ TURNERO_PUERTO: '5000' }).serverPort, 5000);
  assert.equal(readEnv({ TURNERO_PUERTO: '70000' }).serverPort, undefined);
  assert.equal(readEnv({ TURNERO_PUERTO: 'abc' }).serverPort, undefined);
  assert.equal(readEnv({ TURNERO_DATOS: '' }).dataDir, undefined);
});
