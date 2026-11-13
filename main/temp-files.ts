import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { silentLogger, type Logger } from '../shared/logging.js';
const PATTERN = /^(estado|config)\.json\.\d+\.[0-9a-f-]{36}\.tmp$/i;
const MIN_AGE_MS = 60000;
export function cleanTempJsonFiles(
  folder: string,
  logger: Logger = silentLogger,
  now = Date.now(),
): number {
  let deleted = 0;
  try {
    for (const name of readdirSync(folder)) {
      if (!PATTERN.test(name)) continue;
      const filePath = join(folder, name);
      try {
        const info = statSync(filePath);
        if (!info.isFile() || now - info.mtimeMs < MIN_AGE_MS) continue;
        rmSync(filePath);
        deleted++;
      } catch {
        logger.warn('No se pudo retirar un archivo temporal de JSON; se ignora.');
      }
    }
  } catch {
    logger.warn('No se pudo revisar archivos temporales de JSON; se continúa.');
  }
  if (deleted)
    logger.info(`Se retiraron ${deleted} archivos temporales de JSON de un inicio anterior.`);
  return deleted;
}
