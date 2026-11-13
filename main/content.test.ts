import assert from 'node:assert/strict';
import { messageLogger, silentLogger } from '../shared/logging.js';
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
  MIME_TYPES,
  CONTENT_URL,
  importFiles,
  buildInventory,
  removeFile,
  seedContent,
} from './content.js';
test('una copia lenta cede el hilo y no publica archivos parciales; las importaciones concurrentes no sobrescriben', async () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-import-async-'));
  const source = join(root, 'video.mp4');
  const data = join(root, 'datos');
  writeFileSync(source, 'video');
  let signalStart!: () => void, signalProceed!: () => void;
  const copyStarted = new Promise<void>((resolve) => {
    signalStart = resolve;
  });
  const canProceed = new Promise<void>((resolve) => {
    signalProceed = resolve;
  });
  try {
    const firstImport = importFiles(data, 'videos', [source], silentLogger, {
      copiar: async (from, to) => {
        signalStart();
        await canProceed;
        await copyFile(from, to);
      },
    });
    await copyStarted;
    let respond = false;
    await new Promise<void>((resolve) =>
      setImmediate(() => {
        respond = true;
        resolve();
      }),
    );
    assert.equal(respond, true);
    assert.deepEqual(buildInventory(data).videos, []);
    const secondImport = await importFiles(data, 'videos', [source]);
    signalProceed();
    const result = await firstImport;
    assert.deepEqual(secondImport.agregados, ['video.mp4']);
    assert.deepEqual(result.agregados, ['video (2).mp4']);
    assert.deepEqual(readdirSync(join(data, 'videos')).sort(), ['video (2).mp4', 'video.mp4']);
    assert.equal(readFileSync(join(data, 'videos', 'video.mp4'), 'utf8'), 'video');
  } finally {
    signalProceed?.();
    rmSync(root, { recursive: true, force: true });
  }
});
test('una copia truncada se rechaza sin publicar ni dejar temporales', async () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-import-partial-'));
  const source = join(root, 'foto.png');
  writeFileSync(source, 'imagen completa');
  try {
    const result = await importFiles(join(root, 'datos'), 'banner', [source], silentLogger, {
      copiar: async (_from, to) => {
        writeFileSync(to, 'x');
      },
    });
    assert.equal(result.agregados.length, 0);
    assert.equal(result.omitidos.length, 1);
    assert.deepEqual(readdirSync(join(root, 'datos', 'banner')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('el protocolo sirve WAV con el tipo MIME de audio correcto', () => {
  assert.equal(MIME_TYPES['.wav'], 'audio/wav');
});
test('reemplazar una voz con el mismo nombre cambia revisión sin cambiar la URL', () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-revision-audio-'));
  try {
    buildInventory(root);
    writeFileSync(join(root, 'voz', '40.wav'), 'primera voz');
    const previous = buildInventory(root);
    writeFileSync(join(root, 'voz', '40.wav'), 'reemplazo de la voz');
    const updated = buildInventory(root);
    assert.equal(updated.voz[40], previous.voz[40]);
    assert.notEqual(updated.revisionAudio, previous.revisionAudio);
    assert.equal(buildInventory(root).revisionAudio, updated.revisionAudio);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('un fallo de siembra impide arrancar como si hubiera contenido y permite reintentar', () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-siembra-'));
  try {
    const source = join(root, 'fabrica');
    mkdirSync(source);
    writeFileSync(join(source, 'aviso.wav'), 'audio');
    const blocked = join(root, 'bloqueado');
    writeFileSync(blocked, 'no es una carpeta');
    assert.throws(() => seedContent(source, join(blocked, 'contenido')), /preparar el contenido/);
    unlinkSync(blocked);
    mkdirSync(blocked);
    seedContent(source, join(blocked, 'contenido'));
    assert.equal(readFileSync(join(blocked, 'contenido', 'aviso.wav'), 'utf8'), 'audio');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('inventario: videos, banner, voz por número y aviso; lo no soportado se ignora y se registra una vez', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-contenido-'));
  try {
    const empty = buildInventory(root);
    assert.deepEqual(
      [empty.videos, empty.banner, empty.aviso, empty.voz.filter(Boolean)],
      [[], [], null, []],
    );
    for (const file of [
      'videos/b.mp4',
      'videos/Café lento.webm',
      'videos/raro.mkv',
      'videos/.gitkeep',
      'banner/evento.JPG',
      'banner/notas.txt',
      'voz/08.wav',
      'voz/08.mp3',
      'voz/40.wav',
      'voz/99.wav',
      'voz/8.wav',
      'aviso.wav',
      'aviso.mp3',
    ]) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), 'x');
    }
    writeFileSync(join(root, 'voz/40.wav'), '');
    const logs: string[] = [];
    const reported = new Set<string>();
    const inventory = buildInventory(
      root,
      messageLogger((m) => logs.push(m)),
      reported,
    );
    assert.deepEqual(inventory.videos, [
      `${CONTENT_URL}/videos/b.mp4`,
      `${CONTENT_URL}/videos/Caf%C3%A9%20lento.webm`,
    ]);
    assert.deepEqual(inventory.banner, [`${CONTENT_URL}/banner/evento.JPG`]);
    assert.equal(inventory.voz[8], `${CONTENT_URL}/voz/08.wav`);
    assert.equal(inventory.voz[40], null);
    assert.equal(inventory.voz[99], `${CONTENT_URL}/voz/99.wav`);
    assert.equal(inventory.voz[0], null);
    assert.equal(inventory.aviso, `${CONTENT_URL}/aviso.wav`);
    assert.deepEqual(logs.map((m) => m.split(' ').at(-1)).sort(), [
      'banner/notas.txt',
      'videos/raro.mkv',
      'voz/08.mp3',
      'voz/40.wav',
      'voz/8.wav',
    ]);
    buildInventory(
      root,
      messageLogger((m) => logs.push(m)),
      reported,
    );
    assert.equal(logs.length, 5);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('sembrar: copia el contenido de fábrica una sola vez; lo que borre el administrador no vuelve', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-sembrar-'));
  const factory = join(root, 'fabrica'),
    data = join(root, 'datos', 'contenido');
  try {
    for (const file of ['voz/08.wav', 'banner/logo.png', 'aviso.wav']) {
      mkdirSync(join(factory, file, '..'), { recursive: true });
      writeFileSync(join(factory, file), file);
    }
    mkdirSync(join(root, 'datos'));
    seedContent(factory, data);
    assert.equal(readFileSync(join(data, 'voz/08.wav'), 'utf8'), 'voz/08.wav');
    assert.equal(existsSync(join(data, 'aviso.wav')), true);
    assert.equal(existsSync(`${data}.tmp`), false);
    unlinkSync(join(data, 'banner/logo.png'));
    seedContent(factory, data);
    assert.equal(existsSync(join(data, 'banner/logo.png')), false);
    const logs: string[] = [];
    seedContent(
      join(root, 'no-existe'),
      join(root, 'otro'),
      messageLogger((m) => logs.push(m)),
    );
    assert.deepEqual([existsSync(join(root, 'otro')), logs], [false, []]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('sembrar repara audio obligatorio faltante o vacío ignorando MP3 y sin recrear banners borrados', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-reparar-'));
  const factory = join(root, 'fabrica');
  const data = join(root, 'datos');
  try {
    mkdirSync(join(factory, 'voz'), { recursive: true });
    mkdirSync(join(data, 'voz'), { recursive: true });
    writeFileSync(join(factory, 'voz', '08.wav'), 'voz de fábrica');
    writeFileSync(join(factory, 'voz', '09.wav'), 'voz 09');
    writeFileSync(join(factory, 'aviso.wav'), 'aviso');
    writeFileSync(join(data, 'voz', '08.mp3'), 'voz personalizada');
    writeFileSync(join(data, 'voz', '09.wav'), '');
    const logs: string[] = [];
    seedContent(
      factory,
      data,
      messageLogger((message) => logs.push(message)),
    );
    assert.equal(readFileSync(join(data, 'voz', '08.mp3'), 'utf8'), 'voz personalizada');
    assert.equal(readFileSync(join(data, 'voz', '08.wav'), 'utf8'), 'voz de fábrica');
    assert.equal(readFileSync(join(data, 'voz', '09.wav'), 'utf8'), 'voz 09');
    assert.equal(readFileSync(join(data, 'aviso.wav'), 'utf8'), 'aviso');
    assert.equal(existsSync(join(data, 'banner', 'logo.png')), false);
    assert.ok(readdirSync(join(data, 'voz')).some((name) => name.startsWith('09.wav.incompleto-')));
    assert.equal(logs.filter((message) => message.includes('se reparó')).length, 3);
    seedContent(
      factory,
      data,
      messageLogger((message) => logs.push(message)),
    );
    assert.equal(logs.filter((message) => message.includes('se reparó')).length, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('administración: importa sin sobrescribir y solo elimina archivos multimedia inventariados', async () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-administrar-'));
  const source = join(root, 'origen');
  const content = join(root, 'contenido');
  try {
    mkdirSync(source);
    writeFileSync(join(source, 'promo.mp4'), 'primero');
    writeFileSync(join(source, 'notas.txt'), 'no permitido');
    const firstImport = await importFiles(content, 'videos', [
      join(source, 'promo.mp4'),
      join(source, 'notas.txt'),
    ]);
    const secondImport = await importFiles(content, 'videos', [join(source, 'promo.mp4')]);
    assert.deepEqual(firstImport, {
      agregados: ['promo.mp4'],
      omitidos: ['notas.txt'],
      cancelado: false,
      motivos: { 'notas.txt': 'notas.txt: formato no compatible.' },
    });
    assert.deepEqual(secondImport.agregados, ['promo (2).mp4']);
    assert.equal(removeFile(content, `${CONTENT_URL}/videos/promo.mp4`), true);
    assert.equal(existsSync(join(content, 'videos', 'promo.mp4')), false);
    assert.equal(removeFile(content, `${CONTENT_URL}/voz/08.wav`), false);
    assert.equal(removeFile(content, 'turnero://app/contenido/videos/../banner/logo.png'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('importación: un archivo vacío (descarga incompleta) se omite y no se copia', async () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-vacio-'));
  const source = join(root, 'origen');
  const content = join(root, 'contenido');
  try {
    mkdirSync(source);
    writeFileSync(join(source, 'foto.jpeg'), '');
    const result = await importFiles(content, 'banner', [join(source, 'foto.jpeg')]);
    assert.deepEqual(result, {
      agregados: [],
      omitidos: ['foto.jpeg'],
      cancelado: false,
      motivos: { 'foto.jpeg': 'foto.jpeg: está vacío.' },
    });
    assert.equal(existsSync(join(content, 'banner', 'foto.jpeg')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('importación rechaza archivos grandes o disco sin reserva y limpia una copia fallida', async () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-limites-'));
  const source = join(root, 'foto.jpeg');
  const content = join(root, 'contenido');
  try {
    writeFileSync(source, 'imagen');
    truncateSync(source, 25 * 1024 ** 2 + 1);
    const tooLarge = await importFiles(content, 'banner', [source]);
    assert.match(tooLarge.motivos?.['foto.jpeg'] ?? '', /25 MB/);
    writeFileSync(source, 'imagen');
    const noSpace = await importFiles(content, 'banner', [source], silentLogger, {
      espacioLibre: () => 0,
    });
    assert.match(noSpace.motivos?.['foto.jpeg'] ?? '', /espacio suficiente/);
    const failedCopy = await importFiles(content, 'banner', [source], silentLogger, {
      espacioLibre: () => Number.MAX_SAFE_INTEGER,
      copiar: (_source, destination) => {
        writeFileSync(destination, 'parcial');
        throw new Error('copia fallida');
      },
    });
    assert.match(failedCopy.motivos?.['foto.jpeg'] ?? '', /no se pudo copiar/);
    assert.deepEqual(readdirSync(join(content, 'banner')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
