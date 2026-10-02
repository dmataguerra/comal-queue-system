import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const pausa = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const transitorio = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** También aplica al publicar carpetas de contenido o respaldos bloqueadas brevemente por Windows. */
export function renombrarConReintentos(
  origen: string,
  destino: string,
  opciones: { renombrar?: typeof renameSync; esperar?: (ms: number) => void } = {},
) {
  for (let intento = 1; ; intento++) {
    try {
      (opciones.renombrar ?? renameSync)(origen, destino);
      return;
    } catch (error) {
      if (intento >= 4 || !transitorio.has((error as NodeJS.ErrnoException).code ?? ''))
        throw error;
      (opciones.esperar ?? pausa)(25 * intento);
    }
  }
}

/** Escribe en el mismo volumen y sustituye el destino solo después de cerrar el archivo completo. */
export function escribirJsonAtomico(
  ruta: string,
  dato: unknown,
  espacios?: number,
  opciones: { renombrar?: typeof renameSync; esperar?: (ms: number) => void } = {},
): void {
  const temporal = `${ruta}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let creado = false;
  try {
    const fd = openSync(temporal, 'wx');
    creado = true;
    try {
      writeFileSync(fd, `${JSON.stringify(dato, null, espacios)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renombrarConReintentos(temporal, ruta, opciones);
  } finally {
    if (creado) rmSync(temporal, { force: true });
  }
}
