import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { silentLogger, type Logger } from '../shared/logging.js';
const PATRON = /^(estado|config)\.json\.\d+\.[0-9a-f-]{36}\.tmp$/i;
const EDAD_MINIMA_MS = 60000;
export function limpiarTemporalesJson(
  carpeta: string,
  logger: Logger = silentLogger,
  ahora = Date.now(),
): number {
  let borrados = 0;
  try {
    for (const nombre of readdirSync(carpeta)) {
      if (!PATRON.test(nombre)) continue;
      const ruta = join(carpeta, nombre);
      try {
        const info = statSync(ruta);
        if (!info.isFile() || ahora - info.mtimeMs < EDAD_MINIMA_MS) continue;
        rmSync(ruta);
        borrados++;
      } catch {
        logger.warn('No se pudo retirar un archivo temporal de JSON; se ignora.');
      }
    }
  } catch {
    logger.warn('No se pudo revisar archivos temporales de JSON; se continúa.');
  }
  if (borrados)
    logger.info(`Se retiraron ${borrados} archivos temporales de JSON de un inicio anterior.`);
  return borrados;
}
