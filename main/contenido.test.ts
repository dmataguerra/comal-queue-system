import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { URL_CONTENIDO, inventariar, sembrarContenido } from './contenido.js';

test('inventario: videos, banner, voz por número y aviso; lo no soportado se ignora y se registra una vez', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-contenido-'));
  try {
    const vacio = inventariar(raiz);
    assert.deepEqual([vacio.videos, vacio.banner, vacio.aviso, vacio.voz.filter(Boolean)], [[], [], null, []]);

    for (const archivo of ['videos/b.mp4', 'videos/Café lento.webm', 'videos/raro.mkv', 'videos/.gitkeep',
      'banner/evento.JPG', 'banner/notas.txt', 'voz/08.wav', 'voz/99.wav', 'voz/8.wav', 'aviso.wav']) {
      mkdirSync(join(raiz, archivo, '..'), { recursive: true });
      writeFileSync(join(raiz, archivo), 'x');
    }
    const registro: string[] = [];
    const reportados = new Set<string>();
    const inventario = inventariar(raiz, (m) => registro.push(m), reportados);
    assert.deepEqual(inventario.videos, [`${URL_CONTENIDO}/videos/b.mp4`, `${URL_CONTENIDO}/videos/Caf%C3%A9%20lento.webm`]);
    assert.deepEqual(inventario.banner, [`${URL_CONTENIDO}/banner/evento.JPG`]);
    assert.equal(inventario.voz[8], `${URL_CONTENIDO}/voz/08.wav`);
    assert.equal(inventario.voz[99], `${URL_CONTENIDO}/voz/99.wav`);
    assert.equal(inventario.voz[0], null);
    assert.equal(inventario.aviso, `${URL_CONTENIDO}/aviso.wav`);
    assert.deepEqual(registro.map((m) => m.split(' ').at(-1)).sort(), ['banner/notas.txt', 'videos/raro.mkv', 'voz/8.wav']);

    inventariar(raiz, (m) => registro.push(m), reportados);
    assert.equal(registro.length, 3);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('sembrar: copia el contenido de fábrica una sola vez; lo que borre el administrador no vuelve', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-sembrar-'));
  const fabrica = join(raiz, 'fabrica'), datos = join(raiz, 'datos', 'contenido');
  try {
    for (const archivo of ['voz/08.wav', 'banner/logo.png', 'aviso.wav']) {
      mkdirSync(join(fabrica, archivo, '..'), { recursive: true });
      writeFileSync(join(fabrica, archivo), archivo);
    }
    mkdirSync(join(raiz, 'datos'));
    sembrarContenido(fabrica, datos);
    assert.equal(readFileSync(join(datos, 'voz/08.wav'), 'utf8'), 'voz/08.wav');
    assert.equal(existsSync(join(datos, 'aviso.wav')), true);
    assert.equal(existsSync(`${datos}.tmp`), false);

    unlinkSync(join(datos, 'banner/logo.png'));
    sembrarContenido(fabrica, datos);
    assert.equal(existsSync(join(datos, 'banner/logo.png')), false);

    const registro: string[] = [];
    sembrarContenido(join(raiz, 'no-existe'), join(raiz, 'otro'), (m) => registro.push(m));
    assert.deepEqual([existsSync(join(raiz, 'otro')), registro], [false, []]);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
