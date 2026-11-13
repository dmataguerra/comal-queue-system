import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync, watch } from 'node:fs';
import { extname, join } from 'node:path';
import type { Inventory } from '../../shared/contract.js';
import { silentLogger, type Logger } from '../../shared/logging.js';
import { AUDIO_EXTENSIONS, CONTENT_URL, files, IMAGES, url, VIDEOS, VOICE } from './rules.js';
/** Builds the media/voice inventory for the views and watches the folder for changes. */
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
export function watchContent(
  root: string,
  onChange: (inventory: Inventory) => void,
  logger: Logger = silentLogger,
): {
  initial: Inventory;
  stop: () => void;
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
    initial: initialState,
    stop: () => {
      clearTimeout(timer);
      watcher.close();
    },
  };
}
