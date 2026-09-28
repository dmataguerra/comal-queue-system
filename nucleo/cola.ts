import {
  MAX_ANUNCIOS,
  MAX_DURACION_ANUNCIO_MS,
  MAX_ESPERA_ANUNCIO_MS,
} from '../shared/politica-anuncios.js';

interface OpcionesCola<T> {
  limite?: number;
  esperaMs?: number;
  duracionMs?: number;
  ahora?: () => number;
  vigente?: (valor: T) => boolean;
  alDescartar?: (valor: T) => void;
}

/** FIFO acotada: los descartes son explícitos y una tarea termina antes de iniciar otra. */
export function crearCola<T>(
  procesar: (valor: T, signal: AbortSignal) => Promise<void>,
  alFallar: (error: unknown) => void,
  opciones: OpcionesCola<T> = {},
) {
  const pendientes: { valor: T; desde: number }[] = [];
  const ahora = opciones.ahora ?? Date.now;
  const control = new AbortController();
  let actual: { valor: T; control: AbortController } | null = null;
  let trabajando = false;
  async function consumir() {
    if (trabajando || control.signal.aborted) return;
    trabajando = true;
    try {
      while (pendientes.length && !control.signal.aborted) {
        const siguiente = pendientes.shift()!;
        if (
          ahora() - siguiente.desde >= (opciones.esperaMs ?? MAX_ESPERA_ANUNCIO_MS) ||
          opciones.vigente?.(siguiente.valor) === false
        ) {
          opciones.alDescartar?.(siguiente.valor);
          continue;
        }
        const tarea = { valor: siguiente.valor, control: new AbortController() };
        actual = tarea;
        const limite = setTimeout(() => {
          tarea.control.abort();
          opciones.alDescartar?.(tarea.valor);
        }, opciones.duracionMs ?? MAX_DURACION_ANUNCIO_MS);
        try {
          await procesar(siguiente.valor, tarea.control.signal);
        } catch (error) {
          if (!control.signal.aborted) alFallar(error);
        } finally {
          clearTimeout(limite);
          actual = null;
        }
      }
    } finally {
      trabajando = false;
    }
  }
  return {
    agregar(valor: T) {
      if (control.signal.aborted) return false;
      if (pendientes.length + Number(trabajando) >= (opciones.limite ?? MAX_ANUNCIOS)) {
        opciones.alDescartar?.(valor);
        return false;
      }
      pendientes.push({ valor, desde: ahora() });
      void consumir();
      return true;
    },
    descartar(cumple: (valor: T) => boolean) {
      for (let i = pendientes.length - 1; i >= 0; i--) {
        if (cumple(pendientes[i].valor)) {
          const [descartado] = pendientes.splice(i, 1);
          opciones.alDescartar?.(descartado.valor);
        }
      }
      if (actual && cumple(actual.valor)) actual.control.abort();
    },
    detener() {
      pendientes.length = 0;
      control.abort();
      actual?.control.abort();
    },
  };
}
