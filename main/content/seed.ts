import { copyFileSync, cpSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { silentLogger, type Logger } from '../../shared/logging.js';
import { renameWithRetries } from '../atomic-write.js';
import { AUDIO_EXTENSIONS } from './rules.js';
/** Copies factory content into the data folder once, and restores missing required audio. */
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
