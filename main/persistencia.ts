import { constants, copyFileSync, readFileSync } from 'node:fs';
import { ESTADO_INICIAL, MAX_LLAMADOS, enPantalla, type Estado } from '../nucleo/turnos.js';
import { escribirJsonAtomico } from './escritura-atomica.js';
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
  advertencia?: string;
}

const vacio = (advertencia?: string): Cargado => ({
  estado: ESTADO_INICIAL,
  desde: new Map(),
  ...(advertencia ? { advertencia } : {}),
});

/** Fecha calendario local (YYYY-MM-DD). La jornada 8:30–15:00 nunca cruza la medianoche. */
export function fechaLocal(fecha = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

const esTurno = (x: unknown): x is number =>
  Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 99;

const esFechaIso = (valor: unknown) =>
  typeof valor === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(valor) &&
  Number.isFinite(Date.parse(valor)) &&
  new Date(valor).toISOString() === valor;

function valido(dato: unknown): dato is Persistido {
  if (!dato || typeof dato !== 'object') return false;
  const { fecha, actual, llamados, desde } = dato as Record<string, unknown>;
  return (
    typeof fecha === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(fecha) &&
    esFechaIso(`${fecha}T00:00:00.000Z`) &&
    (desde === undefined || (!!desde && typeof desde === 'object' && !Array.isArray(desde))) &&
    (actual === null || esTurno(actual)) &&
    Array.isArray(llamados) &&
    llamados.length <= MAX_LLAMADOS &&
    llamados.every(esTurno) &&
    new Set(llamados).size === llamados.length &&
    (actual === null || !llamados.includes(actual))
  );
}

function timestampsValidos(dato: Persistido): boolean {
  return (
    esFechaIso(dato.guardadoEn) &&
    (dato.desde === undefined || Object.values(dato.desde).every(esFechaIso))
  );
}

/** Misma validación estricta para arranque y restauración, sin modificar archivos. */
export function esEstadoPersistido(dato: unknown): dato is Persistido {
  return valido(dato) && timestampsValidos(dato);
}

function preservarCorrupto(ruta: string, motivo: string, registrar: Registrar): void {
  const copia = `${ruta}.corrupto-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
  try {
    copyFileSync(ruta, copia, constants.COPYFILE_EXCL);
    registrar(`estado.json ${motivo}; copia diagnóstica en ${copia}; se arranca vacío.`);
  } catch (error) {
    registrar(
      `estado.json ${motivo}; no se pudo crear copia diagnóstica: ${(error as Error).message}; se arranca vacío.`,
    );
  }
}

/** Al arrancar: un archivo ausente o de otra fecha comienza vacío; los daños se preservan. */
export function leerEstado(ruta: string, hoy: string, registrar: Registrar = () => {}): Cargado {
  let texto: string;
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return vacio();
    registrar(`No se pudo leer estado.json: ${(error as Error).message}`);
    throw error;
  }
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    preservarCorrupto(ruta, 'no es JSON válido', registrar);
    return vacio(
      'El estado guardado estaba dañado. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (!valido(dato)) {
    preservarCorrupto(ruta, 'tiene una forma inválida', registrar);
    return vacio(
      'El estado guardado tenía datos inválidos. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (!timestampsValidos(dato)) {
    preservarCorrupto(ruta, 'tiene timestamps inválidos', registrar);
    return vacio(
      'El estado guardado tenía fechas inválidas. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (dato.fecha !== hoy) {
    registrar(`estado.json pertenece a ${dato.fecha}; se inicia la jornada ${hoy} vacía.`);
    return vacio();
  }
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
  escribirJsonAtomico(ruta, dato);
}
