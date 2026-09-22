/** Cola FIFO: una tarea termina antes de iniciar la siguiente. */
export function crearCola<T>(
  procesar: (valor: T, signal: AbortSignal) => Promise<void>,
  alFallar: (error: unknown) => void,
) {
  const pendientes: T[] = [];
  const control = new AbortController();
  let trabajando = false;
  async function consumir() {
    if (trabajando || control.signal.aborted) return;
    trabajando = true;
    try {
      while (pendientes.length && !control.signal.aborted) {
        const siguiente = pendientes.shift()!;
        try {
          await procesar(siguiente, control.signal);
        } catch (error) {
          if (!control.signal.aborted) alFallar(error);
        }
      }
    } finally {
      trabajando = false;
    }
  }
  return {
    agregar(valor: T) {
      if (control.signal.aborted) return;
      pendientes.push(valor);
      void consumir();
    },
    detener() {
      pendientes.length = 0;
      control.abort();
    },
  };
}
