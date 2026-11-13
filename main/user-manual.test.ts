import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { createManualOpener } from './user-manual.js';
test('the reader receives a real, stable and repairable copy of the PDF, outside asar', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'comal-manual-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'original.pdf');
  const pdf = await readFile(
    join(import.meta.dirname, '../output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf'),
  );
  await writeFile(source, pdf);
  const paths: string[] = [];
  const open = createManualOpener({
    origen: source,
    cache: join(root, 'cache'),
    abrir: async (filePath) => {
      assert.deepEqual(await readFile(filePath), pdf);
      paths.push(filePath);
      return '';
    },
  });
  await Promise.all([open(), open()]);
  assert.equal(paths.length, 1, 'coalesce concurrent requests instead of launching two readers');
  assert.notEqual(paths[0], source);
  await writeFile(paths[0], 'archivo incompleto');
  await open();
  assert.equal(paths[0], paths[1]);
  assert.deepEqual(await readFile(paths[1]), pdf);
});
test('missing or incomplete manual and unavailable reader give recoverable errors', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'comal-manual-error-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'manual.pdf');
  let opens = 0;
  const open = createManualOpener({
    origen: source,
    cache: join(root, 'cache'),
    abrir: async () => {
      opens++;
      return 'No association';
    },
  });
  await assert.rejects(open(), /No se encontró el manual/);
  await writeFile(source, 'no es PDF');
  await assert.rejects(open(), /incompleto/);
  assert.equal(opens, 0);
  await writeFile(source, '%PDF-1.7\n');
  await assert.rejects(open(), /lector de PDF/);
  assert.equal(opens, 1);
});
