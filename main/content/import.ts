import { copyFile, link, mkdir, rm, stat, statfs } from 'node:fs/promises';
import { existsSync, rmSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import type { ContentCategory, ImportResult } from '../../shared/contract.js';
import { silentLogger, type Logger } from '../../shared/logging.js';
import { buildInventory } from './inventory.js';
import { DISK_RESERVE, extensions, IMAGE_LIMIT, VIDEO_LIMIT } from './rules.js';
/** Operator imports into videos/ and banner/, and removal of those files. */
interface ImportOptions {
  freeSpace?: (folder: string) => number | null | Promise<number | null>;
  copy?: (source: string, destination: string) => void | Promise<void>;
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
      const free = await (options.freeSpace ?? freeSpace)(folder);
      if (free !== null && free - info.size < DISK_RESERVE) {
        skip(name, `${name}: no hay espacio suficiente en la unidad de datos.`);
        continue;
      }
      let destination = name;
      const tempPath = join(folder, `.${crypto.randomUUID()}.tmp`);
      try {
        await (options.copy ?? copyFile)(source, tempPath);
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
