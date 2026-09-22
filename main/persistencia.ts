import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import { ESTADO_INICIAL, MAX_LLAMADOS, enPantalla, type Estado } from '../nucleo/turnos.js';
import type { Registrar } from './log.js';

/** Forma de estado.json (arquitectura §9). `deshacer` no se persiste. */
export interface Persistido {
  fecha: string;
  actual: number | null;
  llamados: number[];
  /** Hora ISO del último anuncio de cada número en pantalla. Falta en el formato anterior. */
  desde?: Record<string, string>;
  guardadoEn: string;
}

/** Estado leído al arrancar, con la hora (ms) del último anuncio de cada número en pantalla. */
export interface Cargado {
  estado: Estado;
  desde: Map<number, number>;
}

const vacio = (): Cargado => ({ estado: ESTADO_INICIAL, desde: new Map() });

/** Fecha calendario local (YYYY-MM-DD). La jornada 8:30–15:00 nunca cruza la medianoche. */
export function fechaLocal(fecha = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

const esTurno = (x: unknown): x is number =>
  Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 99;

function valido(dato: unknown): dato is Persistido {
  if (!dato || typeof dato !== 'object') return false;
  const { fecha, actual, llamados, desde } = dato as Record<string, unknown>;
  return (
    typeof fecha === 'string' &&
    (desde === undefined || (!!desde && typeof desde === 'object' && !Array.isArray(desde))) &&
    (actual === null || esTurno(actual)) &&
    Array.isArray(llamados) &&
    llamados.length <= MAX_LLAMADOS &&
    llamados.every(esTurno) &&
    new Set(llamados).size === llamados.length &&
    (actual === null || !llamados.includes(actual))
  );
}

/** Al arrancar: si falta, está dañado o es de otro día, se arranca vacío (CU-05 paso 4). */
export function leerEstado(ruta: string, hoy: string, registrar: Registrar = () => {}): Cargado {
  let texto: string;
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch {
    return vacio();
  }
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    registrar(`estado.json no es JSON válido; se arranca vacío.`);
    return vacio();
  }
  if (!valido(dato)) {
    registrar(`estado.json tiene una forma inválida; se arranca vacío.`);
    return vacio();
  }
  if (dato.fecha !== hoy) return vacio();
  const estado: Estado = { actual: dato.actual, llamados: dato.llamados, deshacer: null };
  // Un número sin hora propia (formato anterior) cuenta desde el último guardado.
  const hora = (valor: unknown) => (typeof valor === 'string' ? Date.parse(valor) : NaN);
  const respaldo = hora(dato.guardadoEn);
  const desde = new Map<number, number>();
  for (const n of enPantalla(estado)) {
    const t = hora(dato.desde?.[n]);
    if (!Number.isNaN(t)) desde.set(n, t);
    else if (!Number.isNaN(respaldo)) desde.set(n, respaldo);
  }
  return { estado, desde };
}

const pausa = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Escritura atómica: .tmp con fsync y rename sobre el original (mismo volumen). */
export function guardarEstado(
  ruta: string,
  estado: Estado,
  fecha: string,
  desde: ReadonlyMap<number, number> = new Map(),
  ahora = new Date(),
): void {
  const dato: Persistido = {
    fecha,
    actual: estado.actual,
    llamados: estado.llamados,
    desde: Object.fromEntries([...desde].map(([n, t]) => [n, new Date(t).toISOString()])),
    guardadoEn: ahora.toISOString(),
  };
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
      if (intento >= 4 || (codigo !== 'EPERM' && codigo !== 'EBUSY' && codigo !== 'EACCES'))
        throw error;
      pausa(25 * intento);
    }
  }
}
