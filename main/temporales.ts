import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Registrar } from './log.js';

const PATRON = /^(estado|config)\.json\.\d+\.[0-9a-f-]{36}\.tmp$/i;
const EDAD_MINIMA_MS = 60_000;

/** Retira solo temporales atómicos conocidos de una ejecución anterior. */
export function limpiarTemporalesJson(
  carpeta: string,
  registrar: Registrar = () => {},
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
        registrar('No se pudo retirar un archivo temporal de JSON; se ignora.');
      }
    }
  } catch {
    registrar('No se pudo revisar archivos temporales de JSON; se continúa.');
  }
  if (borrados)
    registrar(`Se retiraron ${borrados} archivos temporales de JSON de un inicio anterior.`);
  return borrados;
}
