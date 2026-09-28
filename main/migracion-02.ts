import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CONFIG_POR_DEFECTO, validarConfig } from './config.js';
import { escribirJsonAtomico } from './escritura-atomica.js';
import { fechaLocal } from './persistencia.js';
import type { Registrar } from './log.js';
import { esYouTube } from '../nucleo/youtube.js';

/** Lee la base SQLite de 0.2.0 sin modificarla y migra una sola vez a los JSON de 0.3.0. */
export function migrarDesde02(
  baseAnterior: string,
  carpetaDatos: string,
  registrar: Registrar = () => {},
  ahora = new Date(),
): boolean {
  const rutaEstado = join(carpetaDatos, 'estado.json');
  const rutaConfig = join(carpetaDatos, 'config.json');
  if (!existsSync(baseAnterior) || existsSync(rutaEstado)) return false;
  const db = new DatabaseSync(baseAnterior, { readOnly: true });
  try {
    const filas = db
      .prepare(
        "SELECT number, last_announced_at AS fecha FROM turns WHERE status = 'ready' ORDER BY rank DESC",
      )
      .all() as { number: string; fecha: string }[];
    const hoy = fechaLocal(ahora);
    const vistos = new Set<number>();
    const vigentes = filas
      .filter((fila) => {
        const numero = Number(fila.number);
        if (!/^\d{2}$/.test(fila.number) || numero > 99 || vistos.has(numero)) return false;
        const fecha = new Date(fila.fecha);
        if (!Number.isFinite(fecha.getTime()) || fechaLocal(fecha) !== hoy) return false;
        vistos.add(numero);
        return true;
      })
      .slice(0, 6);
    if (!existsSync(rutaConfig)) {
      const filasConfig = db
        .prepare("SELECT key, value FROM configuration WHERE key IN ('settings', 'multimedia')")
        .all() as { key: string; value: string }[];
      const anterior = Object.fromEntries(
        filasConfig.map((fila) => [fila.key, JSON.parse(fila.value)]),
      );
      const settings = anterior.settings as { footerMessages?: unknown } | undefined;
      const multimedia = anterior.multimedia as { type?: unknown; url?: unknown } | undefined;
      const config = validarConfig(
        {
          ...CONFIG_POR_DEFECTO,
          ...(settings?.footerMessages ? { mensajes: settings.footerMessages } : {}),
          ...(multimedia?.type === 'youtube' && esYouTube(multimedia.url)
            ? { youtubeUrl: multimedia.url }
            : {}),
        },
        registrar,
      );
      escribirJsonAtomico(rutaConfig, config, 2);
    }
    const numeros = vigentes.map((fila) => Number(fila.number));
    const estado = {
      fecha: hoy,
      actual: numeros[0] ?? null,
      llamados: numeros.slice(1),
      // 0.2.0 no vencía turnos listos: concederles una ventana completa al migrar.
      desde: Object.fromEntries(vigentes.map((fila) => [Number(fila.number), ahora.toISOString()])),
      guardadoEn: ahora.toISOString(),
    };
    escribirJsonAtomico(rutaEstado, estado);
    registrar(
      `Se migró 0.2.0: ${vigentes.length} turnos vigentes a ${rutaEstado}. La base anterior permanece en ${baseAnterior}.`,
    );
    return true;
  } catch (error) {
    registrar(`No se pudo migrar 0.2.0 desde ${baseAnterior}: ${(error as Error).message}`);
    throw new Error('No se pudo migrar la base de 0.2.0. La base anterior no se modificó.', {
      cause: error,
    });
  } finally {
    db.close();
  }
}
