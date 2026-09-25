import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const pausa = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const transitorio = new Set(['EPERM', 'EBUSY', 'EACCES']);

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
    for (let intento = 1; ; intento++) {
      try {
        (opciones.renombrar ?? renameSync)(temporal, ruta);
        return;
      } catch (error) {
        if (intento >= 4 || !transitorio.has((error as NodeJS.ErrnoException).code ?? ''))
          throw error;
        (opciones.esperar ?? pausa)(25 * intento);
      }
    }
  } finally {
    if (creado) rmSync(temporal, { force: true });
  }
}
