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
import { migrarDatosDocumentos, resolverCarpetaDatos } from './carpeta-datos.js';

test('producción usa el perfil de la aplicación; desarrollo y ruta explícita se conservan', () => {
  const opciones = {
    empaquetada: true,
    perfil: join(tmpdir(), 'perfil'),
    raiz: join(tmpdir(), 'proyecto'),
  };
  assert.equal(resolverCarpetaDatos(opciones), join(opciones.perfil, 'datos'));
  assert.equal(resolverCarpetaDatos({ ...opciones, empaquetada: false }), opciones.raiz);
  assert.equal(
    resolverCarpetaDatos({ ...opciones, personalizada: './datos-prueba' }),
    resolve('./datos-prueba'),
  );
});

test('migra configuración, turnos y multimedia sin alterar el original ni repetir la copia', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-datos-'));
  const origen = join(raiz, 'OneDrive', 'Documentos', 'Turnero Comal');
  const destino = join(raiz, 'perfil', 'datos');
  try {
    mkdirSync(join(origen, 'contenido', 'videos'), { recursive: true });
    writeFileSync(join(origen, 'config.json'), '{"volumenVoz":0.7}');
    writeFileSync(join(origen, 'estado.json'), '{"actual":42}');
    writeFileSync(join(origen, 'contenido', 'videos', 'menu.mp4'), 'video');
    writeFileSync(join(origen, 'estado.json.tmp'), 'incompleto');
    assert.equal(migrarDatosDocumentos(origen, destino), true);
    for (const ruta of ['config.json', 'estado.json', 'contenido/videos/menu.mp4'])
      assert.deepEqual(readFileSync(join(destino, ruta)), readFileSync(join(origen, ruta)));
    assert.equal(existsSync(join(destino, 'estado.json.tmp')), false);
    writeFileSync(join(destino, 'estado.json'), '{"actual":43}');
    assert.equal(migrarDatosDocumentos(origen, destino), false);
    assert.equal(readFileSync(join(destino, 'estado.json'), 'utf8'), '{"actual":43}');
    assert.equal(readFileSync(join(origen, 'estado.json'), 'utf8'), '{"actual":42}');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('una instalación nueva no crea ni escribe en Documentos', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-datos-'));
  try {
    const origen = join(raiz, 'Documentos', 'Turnero Comal');
    assert.equal(migrarDatosDocumentos(origen, join(raiz, 'perfil', 'datos')), false);
    assert.equal(existsSync(join(raiz, 'Documentos')), false);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('un fallo de lectura de la ubicación anterior no se interpreta como datos ausentes', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-datos-'));
  try {
    const origen = join(raiz, 'origen');
    const destino = join(raiz, 'perfil', 'datos');
    writeFileSync(origen, 'no es un directorio');
    assert.throws(() => migrarDatosDocumentos(origen, destino), /No se pudieron leer/);
    assert.equal(existsSync(destino), false);
    assert.equal(readFileSync(origen, 'utf8'), 'no es un directorio');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('una copia interrumpida no publica datos parciales y permite reintentar', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-datos-'));
  const origen = join(raiz, 'origen');
  const destino = join(raiz, 'perfil', 'datos');
  try {
    mkdirSync(origen);
    mkdirSync(join(raiz, 'externo'));
    writeFileSync(join(origen, 'config.json'), '{}');
    symlinkSync(
      join(raiz, 'externo'),
      join(origen, 'contenido'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    assert.throws(() => migrarDatosDocumentos(origen, destino), /No se pudo copiar/);
    assert.equal(existsSync(destino), false);
    assert.deepEqual(readdirSync(join(raiz, 'perfil')), []);
    assert.equal(readFileSync(join(origen, 'config.json'), 'utf8'), '{}');
    rmSync(join(origen, 'contenido'));
    mkdirSync(join(origen, 'contenido'));
    assert.equal(migrarDatosDocumentos(origen, destino), true);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
