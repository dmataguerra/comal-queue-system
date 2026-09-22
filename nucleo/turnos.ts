// nucleo/turnos.ts — sin dependencias, sin efectos secundarios (arquitectura §4)

export const MAX_LLAMADOS = 5; // RF-05

export interface Estado {
  actual: number | null;
  llamados: number[];
  deshacer: { actual: number | null; llamados: number[] } | null;
}

export type Efecto =
  | { tipo: 'ANUNCIAR'; n: number }
  | { tipo: 'CAPTURA_INVALIDA'; entrada: unknown };

export interface Transicion {
  estado: Estado;
  efecto: Efecto | null;
}

export const ESTADO_INICIAL: Estado = Object.freeze({ actual: null, llamados: [], deshacer: null }) as Estado;

/** "213298" -> 98 · "98" -> 98 · "8" -> 8 · inválido -> null */
export function normalizar(entrada: unknown): number | null {
  const d = String(entrada ?? '').trim();
  if (!/^\d{1,6}$/.test(d)) return null;
  return Number(d.slice(-2)); // solo los dos últimos dígitos
}

/** 8 -> "08" */
export function formatear(n: number): string {
  return String(n).padStart(2, '0');
}

/** Única transición del sistema. Cubre CU-01, CU-02 y toda la tabla de decisión. */
export function llamar(estado: Estado, entrada: unknown, maxLlamados = MAX_LLAMADOS): Transicion {
  const n = normalizar(entrada);

  // CU-01 3a — captura inválida: la pantalla pública no se toca
  if (n === null) {
    return { estado, efecto: { tipo: 'CAPTURA_INVALIDA', entrada } };
  }

  // RN-05 / CU-01 3c — ya es el actual: solo se repite el anuncio
  if (estado.actual === n) {
    return { estado, efecto: { tipo: 'ANUNCIAR', n } };
  }

  // CU-01 pasos 4-5 + CU-02 paso 3, sin ramas:
  //   · filter saca N si estaba en la lista   -> RF-06 y RN-04
  //   · si actual es null no se agrega nada   -> CU-01 4a
  //   · slice recorta a 5                     -> RF-05
  const llamados = [
    ...(estado.actual === null ? [] : [estado.actual]),
    ...estado.llamados.filter((x) => x !== n),
  ].slice(0, maxLlamados);

  return {
    estado: {
      actual: n,
      llamados,
      deshacer: { actual: estado.actual, llamados: estado.llamados },
    },
    efecto: { tipo: 'ANUNCIAR', n },
  };
}

/**
 * Quita un número de la pantalla, sin anunciar (corrección manual desde el operador).
 *
 * La pantalla pública es una sola lista: `[actual, ...llamados]`, del más reciente al más
 * viejo. Quitar es sacar ese elemento y dejar el resto en su orden; no hay turno «promovido»
 * ni hueco. Si el número no está en pantalla no pasa nada.
 */
export function quitar(estado: Estado, n: number): Transicion {
  if (estado.actual !== n && !estado.llamados.includes(n)) return { estado, efecto: null };
  const [actual = null, ...llamados] = [
    ...(estado.actual === null ? [] : [estado.actual]),
    ...estado.llamados,
  ].filter((x) => x !== n);

  // Borrar es explícito: se descarta la foto previa para que ninguna corrección lo restaure.
  return {
    estado: { actual, llamados, deshacer: null },
    efecto: null,
  };
}

/** CU-03 — un solo nivel, y silencioso */
export function deshacer(estado: Estado): Transicion {
  if (!estado.deshacer) return { estado, efecto: null }; // CU-03 1a
  return { estado: { ...estado.deshacer, deshacer: null }, // CU-03 2a
           efecto: null };                                 // CU-03 paso 3
}
