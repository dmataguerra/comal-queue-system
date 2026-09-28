import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { copyFile } from 'node:fs/promises';
import {
  TIPOS_MIME,
  URL_CONTENIDO,
  importarArchivos,
  inventariar,
  quitarArchivo,
  sembrarContenido,
} from './contenido.js';

test('una copia lenta cede el hilo y no publica archivos parciales; las importaciones concurrentes no sobrescriben', async () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-import-async-'));
  const origen = join(raiz, 'video.mp4');
  const datos = join(raiz, 'datos');
  writeFileSync(origen, 'video');
  let empezar!: () => void, continuar!: () => void;
  const inicio = new Promise<void>((resolve) => {
    empezar = resolve;
  });
  const espera = new Promise<void>((resolve) => {
    continuar = resolve;
  });
  try {
    const primera = importarArchivos(datos, 'videos', [origen], () => {}, {
      copiar: async (desde, hasta) => {
        empezar();
        await espera;
        await copyFile(desde, hasta);
      },
    });
    await inicio;
    let responde = false;
    await new Promise<void>((resolve) =>
      setImmediate(() => {
        responde = true;
        resolve();
      }),
    );
    assert.equal(responde, true);
    assert.deepEqual(inventariar(datos).videos, []);
    const segunda = await importarArchivos(datos, 'videos', [origen]);
    continuar();
    const resultado = await primera;
    assert.deepEqual(segunda.agregados, ['video.mp4']);
    assert.deepEqual(resultado.agregados, ['video (2).mp4']);
    assert.deepEqual(readdirSync(join(datos, 'videos')).sort(), ['video (2).mp4', 'video.mp4']);
    assert.equal(readFileSync(join(datos, 'videos', 'video.mp4'), 'utf8'), 'video');
  } finally {
    continuar?.();
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('una copia truncada se rechaza sin publicar ni dejar temporales', async () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-import-partial-'));
  const origen = join(raiz, 'foto.png');
  writeFileSync(origen, 'imagen completa');
  try {
    const resultado = await importarArchivos(join(raiz, 'datos'), 'banner', [origen], () => {}, {
      copiar: async (_desde, hasta) => {
        writeFileSync(hasta, 'x');
      },
    });
    assert.equal(resultado.agregados.length, 0);
    assert.equal(resultado.omitidos.length, 1);
    assert.deepEqual(readdirSync(join(raiz, 'datos', 'banner')), []);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('el protocolo sirve MP3 con el tipo MIME de audio correcto', () => {
  assert.equal(TIPOS_MIME['.mp3'], 'audio/mpeg');
});

test('un fallo de siembra impide arrancar como si hubiera contenido y permite reintentar', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-siembra-'));
  try {
    const origen = join(raiz, 'fabrica');
    mkdirSync(origen);
    writeFileSync(join(origen, 'aviso.wav'), 'audio');
    const bloqueado = join(raiz, 'bloqueado');
    writeFileSync(bloqueado, 'no es una carpeta');
    assert.throws(
      () => sembrarContenido(origen, join(bloqueado, 'contenido')),
      /preparar el contenido/,
    );
    unlinkSync(bloqueado);
    mkdirSync(bloqueado);
    sembrarContenido(origen, join(bloqueado, 'contenido'));
    assert.equal(readFileSync(join(bloqueado, 'contenido', 'aviso.wav'), 'utf8'), 'audio');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('inventario: videos, banner, voz por número y aviso; lo no soportado se ignora y se registra una vez', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-contenido-'));
  try {
    const vacio = inventariar(raiz);
    assert.deepEqual(
      [vacio.videos, vacio.banner, vacio.aviso, vacio.voz.filter(Boolean)],
      [[], [], null, []],
    );

    for (const archivo of [
      'videos/b.mp4',
      'videos/Café lento.webm',
      'videos/raro.mkv',
      'videos/.gitkeep',
      'banner/evento.JPG',
      'banner/notas.txt',
      'voz/08.wav',
      'voz/08.mp3',
      'voz/40.mp3',
      'voz/99.mp3',
      'voz/8.wav',
      'aviso.wav',
      'aviso.mp3',
    ]) {
      mkdirSync(join(raiz, archivo, '..'), { recursive: true });
      writeFileSync(join(raiz, archivo), 'x');
    }
    writeFileSync(join(raiz, 'voz/40.mp3'), '');
    const registro: string[] = [];
    const reportados = new Set<string>();
    const inventario = inventariar(raiz, (m) => registro.push(m), reportados);
    assert.deepEqual(inventario.videos, [
      `${URL_CONTENIDO}/videos/b.mp4`,
      `${URL_CONTENIDO}/videos/Caf%C3%A9%20lento.webm`,
    ]);
    assert.deepEqual(inventario.banner, [`${URL_CONTENIDO}/banner/evento.JPG`]);
    assert.equal(inventario.voz[8], `${URL_CONTENIDO}/voz/08.mp3`);
    assert.equal(inventario.voz[40], null);
    assert.equal(inventario.voz[99], `${URL_CONTENIDO}/voz/99.mp3`);
    assert.equal(inventario.voz[0], null);
    assert.equal(inventario.aviso, `${URL_CONTENIDO}/aviso.mp3`);
    assert.deepEqual(registro.map((m) => m.split(' ').at(-1)).sort(), [
      'banner/notas.txt',
      'videos/raro.mkv',
      'voz/40.mp3',
      'voz/8.wav',
    ]);

    inventariar(raiz, (m) => registro.push(m), reportados);
    assert.equal(registro.length, 4);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('sembrar: copia el contenido de fábrica una sola vez; lo que borre el administrador no vuelve', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-sembrar-'));
  const fabrica = join(raiz, 'fabrica'),
    datos = join(raiz, 'datos', 'contenido');
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
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('sembrar repara audio obligatorio faltante o vacío sin sobrescribir MP3 personalizados ni banners borrados', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-reparar-'));
  const fabrica = join(raiz, 'fabrica');
  const datos = join(raiz, 'datos');
  try {
    mkdirSync(join(fabrica, 'voz'), { recursive: true });
    mkdirSync(join(datos, 'voz'), { recursive: true });
    writeFileSync(join(fabrica, 'voz', '08.wav'), 'voz de fábrica');
    writeFileSync(join(fabrica, 'voz', '09.wav'), 'voz 09');
    writeFileSync(join(fabrica, 'aviso.wav'), 'aviso');
    writeFileSync(join(datos, 'voz', '08.mp3'), 'voz personalizada');
    writeFileSync(join(datos, 'voz', '09.wav'), '');
    const registro: string[] = [];
    sembrarContenido(fabrica, datos, (mensaje) => registro.push(mensaje));
    assert.equal(readFileSync(join(datos, 'voz', '08.mp3'), 'utf8'), 'voz personalizada');
    assert.equal(existsSync(join(datos, 'voz', '08.wav')), false);
    assert.equal(readFileSync(join(datos, 'voz', '09.wav'), 'utf8'), 'voz 09');
    assert.equal(readFileSync(join(datos, 'aviso.wav'), 'utf8'), 'aviso');
    assert.equal(existsSync(join(datos, 'banner', 'logo.png')), false);
    assert.ok(
      readdirSync(join(datos, 'voz')).some((nombre) => nombre.startsWith('09.wav.incompleto-')),
    );
    assert.equal(registro.filter((mensaje) => mensaje.includes('se reparó')).length, 2);
    sembrarContenido(fabrica, datos, (mensaje) => registro.push(mensaje));
    assert.equal(registro.filter((mensaje) => mensaje.includes('se reparó')).length, 2);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('administración: importa sin sobrescribir y solo elimina archivos multimedia inventariados', async () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-administrar-'));
  const origen = join(raiz, 'origen');
  const contenido = join(raiz, 'contenido');
  try {
    mkdirSync(origen);
    writeFileSync(join(origen, 'promo.mp4'), 'primero');
    writeFileSync(join(origen, 'notas.txt'), 'no permitido');
    const primera = await importarArchivos(contenido, 'videos', [
      join(origen, 'promo.mp4'),
      join(origen, 'notas.txt'),
    ]);
    const segunda = await importarArchivos(contenido, 'videos', [join(origen, 'promo.mp4')]);
    assert.deepEqual(primera, {
      agregados: ['promo.mp4'],
      omitidos: ['notas.txt'],
      cancelado: false,
      motivos: { 'notas.txt': 'notas.txt: formato no compatible.' },
    });
    assert.deepEqual(segunda.agregados, ['promo (2).mp4']);
    assert.equal(quitarArchivo(contenido, `${URL_CONTENIDO}/videos/promo.mp4`), true);
    assert.equal(existsSync(join(contenido, 'videos', 'promo.mp4')), false);
    assert.equal(quitarArchivo(contenido, `${URL_CONTENIDO}/voz/08.wav`), false);
    assert.equal(
      quitarArchivo(contenido, 'turnero://app/contenido/videos/../banner/logo.png'),
      false,
    );
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('importación: un archivo vacío (descarga incompleta) se omite y no se copia', async () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-vacio-'));
  const origen = join(raiz, 'origen');
  const contenido = join(raiz, 'contenido');
  try {
    mkdirSync(origen);
    writeFileSync(join(origen, 'foto.jpeg'), '');
    const resultado = await importarArchivos(contenido, 'banner', [join(origen, 'foto.jpeg')]);
    assert.deepEqual(resultado, {
      agregados: [],
      omitidos: ['foto.jpeg'],
      cancelado: false,
      motivos: { 'foto.jpeg': 'foto.jpeg: está vacío.' },
    });
    assert.equal(existsSync(join(contenido, 'banner', 'foto.jpeg')), false);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('importación rechaza archivos grandes o disco sin reserva y limpia una copia fallida', async () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-limites-'));
  const origen = join(raiz, 'foto.jpeg');
  const contenido = join(raiz, 'contenido');
  try {
    writeFileSync(origen, 'imagen');
    truncateSync(origen, 25 * 1024 ** 2 + 1);
    const demasiadoGrande = await importarArchivos(contenido, 'banner', [origen]);
    assert.match(demasiadoGrande.motivos?.['foto.jpeg'] ?? '', /25 MB/);
    writeFileSync(origen, 'imagen');
    const sinEspacio = await importarArchivos(contenido, 'banner', [origen], () => {}, {
      espacioLibre: () => 0,
    });
    assert.match(sinEspacio.motivos?.['foto.jpeg'] ?? '', /espacio suficiente/);
    const copiaFallida = await importarArchivos(contenido, 'banner', [origen], () => {}, {
      espacioLibre: () => Number.MAX_SAFE_INTEGER,
      copiar: (_origen, destino) => {
        writeFileSync(destino, 'parcial');
        throw new Error('copia fallida');
      },
    });
    assert.match(copiaFallida.motivos?.['foto.jpeg'] ?? '', /no se pudo copiar/);
    assert.deepEqual(readdirSync(join(contenido, 'banner')), []);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
