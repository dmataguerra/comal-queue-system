export const MAX_LLAMADOS = 5;
export const VIGENCIA_MS = 5 * 60000;
export interface Estado {
  actual: number | null;
  llamados: number[];
  deshacer: {
    actual: number | null;
    llamados: number[];
  } | null;
}
export type Efecto =
  | {
      tipo: 'ANUNCIAR';
      n: number;
    }
  | {
      tipo: 'CAPTURA_INVALIDA';
      entrada: unknown;
    };
export interface Transicion {
  estado: Estado;
  efecto: Efecto | null;
}
export const ESTADO_INICIAL: Estado = Object.freeze({
  actual: null,
  llamados: [],
  deshacer: null,
});
// El ticket admite hasta seis dígitos; en la pantalla sólo se usan los dos últimos.
export function normalizar(entrada: unknown): number | null {
  if (typeof entrada !== 'string' && typeof entrada !== 'number') return null;
  const d = String(entrada).trim();
  if (!/^\d{1,6}$/.test(d)) return null;
  return Number(d.slice(-2));
}
export function enPantalla(estado: Estado): number[] {
  return estado.actual === null ? [...estado.llamados] : [estado.actual, ...estado.llamados];
}
export function formatear(n: number): string {
  return String(n).padStart(2, '0');
}
export function llamar(estado: Estado, entrada: unknown, maxLlamados = MAX_LLAMADOS): Transicion {
  const n = normalizar(entrada);
  if (n === null) {
    return { estado, efecto: { tipo: 'CAPTURA_INVALIDA', entrada } };
  }
  if (estado.actual === n) {
    return { estado, efecto: { tipo: 'ANUNCIAR', n } };
  }
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
export function quitar(estado: Estado, n: number): Transicion {
  if (estado.actual !== n && !estado.llamados.includes(n)) return { estado, efecto: null };
  const [actual = null, ...llamados] = enPantalla(estado).filter((x) => x !== n);
  return {
    estado: { actual, llamados, deshacer: null },
    efecto: null,
  };
}
export function vencer(estado: Estado, vencidos: readonly number[]): Transicion {
  const quedan = enPantalla(estado).filter((x) => !vencidos.includes(x));
  if (quedan.length === enPantalla(estado).length) return { estado, efecto: null };
  const [actual = null, ...llamados] = quedan;
  return {
    estado: { actual, llamados, deshacer: actual === estado.actual ? estado.deshacer : null },
    efecto: null,
  };
}
export function deshacer(estado: Estado): Transicion {
  if (!estado.deshacer) return { estado, efecto: null };
  return {
    estado: { ...estado.deshacer, deshacer: null },
    efecto: null,
  };
}
