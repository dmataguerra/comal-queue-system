import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { migrateDocumentsData, resolveDataDir } from './data-folder.js';
test('production uses the application profile; development and explicit path are preserved', () => {
  const options = {
    empaquetada: true,
    perfil: join(tmpdir(), 'perfil'),
    raiz: join(tmpdir(), 'proyecto'),
  };
  assert.equal(resolveDataDir(options), join(options.perfil, 'datos'));
  assert.equal(resolveDataDir({ ...options, empaquetada: false }), options.raiz);
  assert.equal(
    resolveDataDir({ ...options, personalizada: './datos-prueba' }),
    resolve('./datos-prueba'),
  );
});
test('migrates configuration, turns and media without altering the original or repeating the copy', () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-datos-'));
  const source = join(root, 'OneDrive', 'Documentos', 'Turnero Comal');
  const destination = join(root, 'perfil', 'datos');
  try {
    mkdirSync(join(source, 'contenido', 'videos'), { recursive: true });
    writeFileSync(join(source, 'config.json'), '{"volumenVoz":0.7}');
    writeFileSync(join(source, 'estado.json'), '{"actual":42}');
    writeFileSync(join(source, 'contenido', 'videos', 'menu.mp4'), 'video');
    writeFileSync(join(source, 'estado.json.tmp'), 'incompleto');
    assert.equal(migrateDocumentsData(source, destination), true);
    for (const filePath of ['config.json', 'estado.json', 'contenido/videos/menu.mp4'])
      assert.deepEqual(
        readFileSync(join(destination, filePath)),
        readFileSync(join(source, filePath)),
      );
    assert.equal(existsSync(join(destination, 'estado.json.tmp')), false);
    writeFileSync(join(destination, 'estado.json'), '{"actual":43}');
    assert.equal(migrateDocumentsData(source, destination), false);
    assert.equal(readFileSync(join(destination, 'estado.json'), 'utf8'), '{"actual":43}');
    assert.equal(readFileSync(join(source, 'estado.json'), 'utf8'), '{"actual":42}');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('a new installation neither creates nor writes to Documents', () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-datos-'));
  try {
    const source = join(root, 'Documentos', 'Turnero Comal');
    assert.equal(migrateDocumentsData(source, join(root, 'perfil', 'datos')), false);
    assert.equal(existsSync(join(root, 'Documentos')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('a read failure of the previous location is not interpreted as missing data', () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-datos-'));
  try {
    const source = join(root, 'origen');
    const destination = join(root, 'perfil', 'datos');
    writeFileSync(source, 'no es un directorio');
    assert.throws(() => migrateDocumentsData(source, destination), /No se pudieron leer/);
    assert.equal(existsSync(destination), false);
    assert.equal(readFileSync(source, 'utf8'), 'no es un directorio');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('an interrupted copy does not publish partial data and allows retrying', () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-datos-'));
  const source = join(root, 'origen');
  const destination = join(root, 'perfil', 'datos');
  try {
    mkdirSync(source);
    mkdirSync(join(root, 'externo'));
    writeFileSync(join(source, 'config.json'), '{}');
    symlinkSync(
      join(root, 'externo'),
      join(source, 'contenido'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    assert.throws(() => migrateDocumentsData(source, destination), /No se pudo copiar/);
    assert.equal(existsSync(destination), false);
    assert.deepEqual(readdirSync(join(root, 'perfil')), []);
    assert.equal(readFileSync(join(source, 'config.json'), 'utf8'), '{}');
    rmSync(join(source, 'contenido'));
    mkdirSync(join(source, 'contenido'));
    assert.equal(migrateDocumentsData(source, destination), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
