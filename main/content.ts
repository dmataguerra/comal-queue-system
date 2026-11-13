import { copyFile, link, mkdir, rm, stat, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  watch,
} from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import type { ContentCategory, Inventory, ImportResult } from '../shared/contract.js';
import { silentLogger, type Logger } from '../shared/logging.js';
import { renameWithRetries } from './atomic-write.js';
export const CONTENT_URL = 'turnero://app/contenido';
const VIDEOS = new Set(['.mp4', '.webm']);
const IMAGES = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VOICE = /^(\d{2})\.wav$/i;
const AUDIO_EXTENSIONS = ['.wav'] as const;
export const VIDEO_LIMIT = 2 * 1024 ** 3;
export const IMAGE_LIMIT = 25 * 1024 ** 2;
export const DISK_RESERVE = 512 * 1024 ** 2;
interface ImportOptions {
  espacioLibre?: (folder: string) => number | null | Promise<number | null>;
  copiar?: (source: string, destination: string) => void | Promise<void>;
}
const freeSpace = async (folder: string): Promise<number | null> => {
  try {
    const info = await statfs(folder);
    return info.bavail * info.bsize;
  } catch (error) {
    if (['ENOSYS', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code ?? '')) return null;
    throw error;
  }
};
export const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
function files(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((input) => input.isFile() && !input.name.startsWith('.'))
    .map((input) => input.name)
    .sort((a, b) => a.localeCompare(b, 'es'));
}
const url = (base: string, folder: string, name: string) =>
  `${base}/${folder}/${encodeURIComponent(name)}`;
const extensions = (category: ContentCategory) => (category === 'videos' ? VIDEOS : IMAGES);
export async function importFiles(
  root: string,
  category: ContentCategory,
  sources: string[],
  logger: Logger = silentLogger,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const folder = join(root, category);
  await mkdir(folder, { recursive: true });
  const added: string[] = [],
    skipped: string[] = [];
  const reasons: Record<string, string> = {};
  const skip = (name: string, reason: string) => {
    skipped.push(name);
    reasons[name] = reason;
    logger.warn(`contenido: importación rechazada (${reason})`);
  };
  for (const source of sources) {
    const name = basename(source);
    if (!extensions(category).has(extname(name).toLowerCase())) {
      skip(name, `${name}: formato no compatible.`);
      continue;
    }
    try {
      const info = await stat(source);
      if (!info.isFile()) {
        skip(name, `${name}: no es un archivo.`);
        continue;
      }
      if (info.size === 0) {
        skip(name, `${name}: está vacío.`);
        continue;
      }
      const limit = category === 'videos' ? VIDEO_LIMIT : IMAGE_LIMIT;
      if (info.size > limit) {
        skip(name, `${name}: supera el límite de ${category === 'videos' ? '2 GB' : '25 MB'}.`);
        continue;
      }
      const free = await (options.espacioLibre ?? freeSpace)(folder);
      if (free !== null && free - info.size < DISK_RESERVE) {
        skip(name, `${name}: no hay espacio suficiente en la unidad de datos.`);
        continue;
      }
      let destination = name;
      const tempPath = join(folder, `.${crypto.randomUUID()}.tmp`);
      try {
        await (options.copiar ?? copyFile)(source, tempPath);
        if ((await stat(tempPath)).size !== info.size)
          throw new Error('La copia quedó incompleta.');
        const parts = parse(name);
        for (let index = 1; ; index++) {
          destination = index === 1 ? name : `${parts.name} (${index})${parts.ext}`;
          try {
            await link(tempPath, join(folder, destination));
            break;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          }
        }
      } finally {
        await rm(tempPath, { force: true });
      }
      added.push(destination);
    } catch (error) {
      skip(name, `${name}: no se pudo copiar el archivo. Revise permisos y espacio disponible.`);
      logger.error(`contenido: error al copiar ${name} (${(error as Error).message})`);
    }
  }
  return {
    agregados: added,
    omitidos: skipped,
    cancelado: false,
    ...(skipped.length ? { motivos: reasons } : {}),
  };
}
export function removeFile(root: string, mediaUrl: string): boolean {
  const inventory = buildInventory(root);
  if (![...inventory.videos, ...inventory.banner].includes(mediaUrl)) return false;
  let filePath: string;
  try {
    const destination = new URL(mediaUrl);
    if (`${destination.protocol}//${destination.host}` !== 'turnero://app') return false;
    filePath = decodeURIComponent(destination.pathname).replace(/^\/contenido\//, '');
  } catch {
    return false;
  }
  const parts = filePath.split('/');
  if (parts.length !== 2 || (parts[0] !== 'videos' && parts[0] !== 'banner')) return false;
  const absolute = resolve(root, parts[0], parts[1]);
  const relativePath = relative(root, absolute);
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    isAbsolute(relativePath) ||
    !existsSync(absolute) ||
    !statSync(absolute).isFile()
  )
    return false;
  rmSync(absolute);
  return true;
}
export function buildInventory(
  root: string,
  logger: Logger = silentLogger,
  reported = new Set<string>(),
  base = CONTENT_URL,
): Inventory {
  for (const folder of ['videos', 'banner', 'voz'])
    mkdirSync(join(root, folder), { recursive: true });
  const ignore = (filePath: string, reason = 'formato no soportado') => {
    if (reported.has(filePath)) return;
    reported.add(filePath);
    logger.warn(`contenido: ${reason}, se ignora ${filePath}`);
  };
  const hasContent = (filePath: string) => existsSync(filePath) && statSync(filePath).size > 0;
  const filter = (folder: string, allowed: Set<string>) =>
    files(join(root, folder))
      .filter((name) => {
        if (allowed.has(extname(name).toLowerCase())) return true;
        ignore(`${folder}/${name}`);
        return false;
      })
      .map((name) => url(base, folder, name));
  const voice = Array.from({ length: 100 }, (): string | null => null);
  for (const name of files(join(root, 'voz'))) {
    const match = VOICE.exec(name);
    if (match) {
      if (!hasContent(join(root, 'voz', name))) {
        ignore(`voz/${name}`, 'archivo vacío');
        continue;
      }
      const voiceNumber = Number(match[1]);
      voice[voiceNumber] = url(base, 'voz', name);
    } else ignore(`voz/${name}`);
  }
  const chime = AUDIO_EXTENSIONS.map((extension) => `aviso${extension}`).find((name) =>
    hasContent(join(root, name)),
  );
  const selection = [
    ...voice
      .filter((url): url is string => Boolean(url))
      .map((url) => join(root, 'voz', decodeURIComponent(url.split('/').pop()!))),
    ...(chime ? [join(root, chime)] : []),
  ];
  const audioRevision = createHash('sha256')
    .update(
      JSON.stringify(
        selection.map((filePath) => {
          const info = statSync(filePath);
          return [filePath, info.size, info.mtimeMs, info.ctimeMs];
        }),
      ),
    )
    .digest('hex');
  return {
    revisionAudio: audioRevision,
    videos: filter('videos', VIDEOS),
    banner: filter('banner', IMAGES),
    voz: voice,
    aviso: chime ? `${base}/${chime}` : null,
  };
}
export function seedContent(
  source: string,
  destination: string,
  logger: Logger = silentLogger,
): void {
  if (!existsSync(source)) return;
  if (existsSync(destination)) {
    repairFactoryAudio(source, destination, logger);
    return;
  }
  const tempPath = `${destination}.tmp`;
  try {
    rmSync(tempPath, { recursive: true, force: true });
    cpSync(source, tempPath, { recursive: true });
    renameWithRetries(tempPath, destination);
    logger.info(`contenido: se copió el contenido de fábrica a ${destination}`);
  } catch (error) {
    logger.error(
      `contenido: no se pudo copiar el contenido de fábrica (${(error as Error).message})`,
    );
    throw new Error(
      'No se pudo preparar el contenido de fábrica. Revisa los permisos y vuelve a abrir la aplicación.',
      { cause: error },
    );
  }
}
function repairFactoryAudio(source: string, destination: string, logger: Logger) {
  const isUsableFile = (filePath: string) => {
    if (!existsSync(filePath)) return false;
    const info = statSync(filePath);
    return info.isFile() && info.size > 0;
  };
  const repair = (file: string) => {
    const sourcePath = join(source, file);
    const target = join(destination, file);
    if (!isUsableFile(sourcePath)) return;
    const tempPath = `${target}.${crypto.randomUUID()}.tmp`;
    const copy = `${target}.incompleto-${crypto.randomUUID()}`;
    try {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(sourcePath, tempPath);
      if (existsSync(target)) renameSync(target, copy);
      try {
        renameSync(tempPath, target);
      } catch (error) {
        if (existsSync(copy)) renameSync(copy, target);
        throw error;
      }
      logger.info(
        `contenido: se reparó ${file}${existsSync(copy) ? `; archivo vacío conservado en ${copy}` : ''}`,
      );
    } catch (error) {
      logger.error(`contenido: no se pudo reparar ${file} (${(error as Error).message})`);
    } finally {
      rmSync(tempPath, { force: true });
    }
  };
  for (let n = 0; n < 100; n++) {
    const voiceNumber = String(n).padStart(2, '0');
    if (
      AUDIO_EXTENSIONS.some((extension) =>
        isUsableFile(join(destination, 'voz', `${voiceNumber}${extension}`)),
      )
    )
      continue;
    const available = AUDIO_EXTENSIONS.map((extension) => `voz/${voiceNumber}${extension}`).find(
      (file) => isUsableFile(join(source, file)),
    );
    if (available) repair(available);
  }
  if (!AUDIO_EXTENSIONS.some((extension) => isUsableFile(join(destination, `aviso${extension}`)))) {
    const available = AUDIO_EXTENSIONS.map((extension) => `aviso${extension}`).find((file) =>
      isUsableFile(join(source, file)),
    );
    if (available) repair(available);
  }
}
export function watchContent(
  root: string,
  onChange: (inventory: Inventory) => void,
  logger: Logger = silentLogger,
): {
  inicial: Inventory;
  detener: () => void;
} {
  const reported = new Set<string>();
  const initialState = buildInventory(root, logger, reported);
  let last = JSON.stringify(initialState);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watcher = watch(root, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const inventory = buildInventory(root, logger, reported);
        const text = JSON.stringify(inventory);
        if (text === last) return;
        last = text;
        onChange(inventory);
      } catch (error) {
        logger.error(
          `contenido: no se pudo actualizar el inventario (${(error as Error).message}); se conserva el anterior.`,
        );
      }
    }, 500);
  });
  return {
    inicial: initialState,
    detener: () => {
      clearTimeout(timer);
      watcher.close();
    },
  };
}
