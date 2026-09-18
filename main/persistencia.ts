import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import { ESTADO_INICIAL, MAX_LLAMADOS, type Estado } from '../nucleo/turnos.js';
import type { Registrar } from './log.js';

/** Forma de estado.json (arquitectura §9). `deshacer` no se persiste. */
export interface Persistido {
  fecha: string;
  actual: number | null;
  llamados: number[];
  guardadoEn: string;
}

/** Fecha calendario local (YYYY-MM-DD). La jornada 8:30–15:00 nunca cruza la medianoche. */
export function fechaLocal(fecha = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

const esTurno = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 99;

function valido(dato: unknown): dato is Persistido {
  if (!dato || typeof dato !== 'object') return false;
  const { fecha, actual, llamados } = dato as Record<string, unknown>;
  return typeof fecha === 'string'
    && (actual === null || esTurno(actual))
    && Array.isArray(llamados)
    && llamados.length <= MAX_LLAMADOS
    && llamados.every(esTurno)
    && new Set(llamados).size === llamados.length
    && (actual === null || !llamados.includes(actual));
}

/** Al arrancar: si falta, está dañado o es de otro día, se arranca vacío (CU-05 paso 4). */
export function leerEstado(ruta: string, hoy: string, registrar: Registrar = () => {}): Estado {
  let texto: string;
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch {
    return ESTADO_INICIAL;
  }
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    registrar(`estado.json no es JSON válido; se arranca vacío.`);
    return ESTADO_INICIAL;
  }
  if (!valido(dato)) {
    registrar(`estado.json tiene una forma inválida; se arranca vacío.`);
    return ESTADO_INICIAL;
  }
  if (dato.fecha !== hoy) return ESTADO_INICIAL;
  return { actual: dato.actual, llamados: dato.llamados, deshacer: null };
}

const pausa = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Escritura atómica: .tmp con fsync y rename sobre el original (mismo volumen). */
export function guardarEstado(ruta: string, estado: Estado, fecha: string, ahora = new Date()): void {
  const dato: Persistido = { fecha, actual: estado.actual, llamados: estado.llamados, guardadoEn: ahora.toISOString() };
  const temporal = `${ruta}.tmp`;
  const fd = openSync(temporal, 'w');
  try {
    writeSync(fd, `${JSON.stringify(dato)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  // En Windows un antivirus o el indexador pueden retener el archivo unos milisegundos.
  for (let intento = 1; ; intento++) {
    try {
      renameSync(temporal, ruta);
      return;
    } catch (error) {
      const codigo = (error as NodeJS.ErrnoException).code;
      if (intento >= 4 || (codigo !== 'EPERM' && codigo !== 'EBUSY' && codigo !== 'EACCES')) throw error;
      pausa(25 * intento);
    }
  }
}
