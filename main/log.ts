import { appendFileSync, existsSync, renameSync, statSync, unlinkSync } from 'node:fs';

export type Registrar = (mensaje: string) => void;
export type NivelLog = 'info' | 'warning' | 'error';
export interface OpcionesRegistro {
  version?: string;
  componente?: string;
  maxBytes?: number;
  maxArchivos?: number;
  repeticionMs?: number;
  ahora?: () => Date;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVOS = 5;
const MAX_MENSAJE = 500;

/** JSON por línea; conserva la interfaz anterior y nunca interrumpe la operación. */
export function crearRegistro(ruta: string, opciones: OpcionesRegistro = {}): Registrar {
  const ahora = opciones.ahora ?? (() => new Date());
  const maxBytes = opciones.maxBytes ?? MAX_BYTES;
  const maxArchivos = opciones.maxArchivos ?? MAX_ARCHIVOS;
  const repeticionMs = opciones.repeticionMs ?? 30_000;
  const sesion = `${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  let anterior = '';
  let ultimaVez = 0;
  let omitidos = 0;

  function escribir(mensaje: string, fecha: Date) {
    const nivel: NivelLog = /error|fall|no se pudo|falta|rechazad|terminó/i.test(mensaje)
      ? 'error'
      : /advertencia|restaurad|recuperad|degradad|no disponible|sin espacio/i.test(mensaje)
        ? 'warning'
        : 'info';
    const linea =
      JSON.stringify({
        iso: fecha.toISOString(),
        local: fecha.toLocaleString(),
        nivel,
        componente: opciones.componente ?? 'main',
        version: opciones.version ?? 'desconocida',
        sesion,
        mensaje: mensaje.slice(0, MAX_MENSAJE),
      }) + '\n';
    try {
      if (
        maxBytes > 0 &&
        existsSync(ruta) &&
        statSync(ruta).size + Buffer.byteLength(linea) > maxBytes
      ) {
        if (maxArchivos > 0) {
          const ultimo = `${ruta}.${maxArchivos}`;
          if (existsSync(ultimo)) unlinkSync(ultimo);
          for (let n = maxArchivos - 1; n >= 1; n--) {
            if (existsSync(`${ruta}.${n}`)) renameSync(`${ruta}.${n}`, `${ruta}.${n + 1}`);
          }
          renameSync(ruta, `${ruta}.1`);
        } else unlinkSync(ruta);
      }
      appendFileSync(ruta, linea);
    } catch {
      try {
        console.warn(linea.trimEnd());
      } catch {
        // Incluso stderr puede fallar durante el apagado.
      }
    }
  }

  return (mensaje) => {
    const fecha = ahora();
    const limpio = String(mensaje)
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, MAX_MENSAJE);
    if (limpio === anterior && fecha.getTime() - ultimaVez < repeticionMs) {
      omitidos++;
      return;
    }
    if (omitidos) escribir(`Mensaje anterior repetido ${omitidos} veces.`, fecha);
    omitidos = 0;
    anterior = limpio;
    ultimaVez = fecha.getTime();
    escribir(limpio, fecha);
  };
}
