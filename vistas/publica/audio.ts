import type { Inventario } from '../../shared/contract';

// §6 · Todo el audio se decodifica al arrancar: en el camino crítico nunca se lee disco.
let contexto: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let revisionAudio: string | undefined;
const obtenerContexto = () => (contexto ??= new AudioContext());

/** Al cerrar o recargar la vista se liberan el dispositivo y los buffers decodificados. */
export function cerrarAudio() {
  const anterior = contexto;
  contexto = null;
  buffers.clear();
  revisionAudio = undefined;
  if (anterior) void anterior.close();
}

function cargar(url: string) {
  let buffer = buffers.get(url);
  if (!buffer) {
    const archivo = decodeURIComponent(url.split('/').pop() ?? url);
    buffer = fetch(url, { signal: AbortSignal.timeout(15000) })
      .catch(() => {
        throw new Error(
          `No se pudo acceder al audio local ${archivo}. Revisa la ruta y los permisos del contenido.`,
        );
      })
      .then((r) => {
        if (!r.ok)
          throw new Error(`No se pudo abrir el audio local ${archivo} (HTTP ${r.status}).`);
        return r.arrayBuffer();
      })
      .then((datos) =>
        obtenerContexto()
          .decodeAudioData(datos)
          .catch(() => {
            throw new Error(`El audio local ${archivo} no se pudo decodificar.`);
          }),
      );
    buffer.catch(() => {
      if (buffers.get(url) === buffer) buffers.delete(url);
    });
    buffers.set(url, buffer);
  }
  return buffer;
}

/** Precarga el aviso y las 100 voces del inventario; descarta lo que ya no existe. */
export async function precargar(inventario: Inventario) {
  if (inventario.revisionAudio !== revisionAudio) buffers.clear();
  revisionAudio = inventario.revisionAudio;
  const urls = [inventario.aviso, ...inventario.voz].filter((url): url is string => Boolean(url));
  for (const url of buffers.keys()) if (!urls.includes(url)) buffers.delete(url);
  await Promise.all(urls.map(cargar));
}

export function pausa(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const fin = () => {
      clearTimeout(id);
      signal.removeEventListener('abort', fin);
      resolve();
    };
    const id = setTimeout(fin, ms);
    signal.addEventListener('abort', fin, { once: true });
  });
}

function esperarAudio<T>(operacion: Promise<T>, signal: AbortSignal, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancelar = () => terminar(new DOMException('Anuncio cancelado', 'AbortError'));
    const limite = setTimeout(
      () => terminar(new Error('Tiempo agotado al preparar el audio.')),
      ms,
    );
    const limpiar = () => {
      clearTimeout(limite);
      signal.removeEventListener('abort', cancelar);
    };
    const terminar = (error: unknown) => {
      limpiar();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    operacion.then((valor) => {
      limpiar();
      resolve(valor);
    }, terminar);
    if (signal.aborted) cancelar();
    else signal.addEventListener('abort', cancelar, { once: true });
  });
}

export async function reproducir(url: string, volumen: number, signal: AbortSignal) {
  if (signal.aborted) return;
  const buffer = await esperarAudio(cargar(url), signal, 20000);
  if (signal.aborted) return;
  const ctx = obtenerContexto();
  if (ctx.state !== 'running') await esperarAudio(ctx.resume(), signal, 5000);
  if (signal.aborted) return;
  if (ctx.state !== 'running') throw new Error('La salida de sonido no está disponible.');
  await new Promise<void>((resolve, reject) => {
    const fuente = ctx.createBufferSource(),
      ganancia = ctx.createGain();
    fuente.buffer = buffer;
    ganancia.gain.value = volumen;
    fuente.connect(ganancia).connect(ctx.destination);
    let terminado = false;
    const finalizar = (error?: Error) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(limite);
      signal.removeEventListener('abort', detener);
      ctx.removeEventListener('statechange', comprobarDispositivo);
      fuente.onended = null;
      try {
        fuente.stop();
      } catch {
        // El nodo puede haber terminado antes de recibir la cancelación.
      }
      fuente.disconnect();
      ganancia.disconnect();
      if (error) reject(error);
      else resolve();
    };
    const detener = () => finalizar();
    const comprobarDispositivo = () => {
      if (ctx.state !== 'running')
        finalizar(
          new Error('La salida de sonido se interrumpió. Revisa el dispositivo y vuelve a llamar.'),
        );
    };
    // El dispositivo puede suspenderse sin emitir onended. Liberar la cola y
    // reportar fallo, en lugar de esperar indefinidamente a ese evento.
    const limite = setTimeout(
      () =>
        finalizar(
          new Error('El audio no terminó en el tiempo esperado. Revisa la salida de sonido.'),
        ),
      Math.ceil(buffer.duration * 1000) + 5000,
    );
    signal.addEventListener('abort', detener, { once: true });
    ctx.addEventListener('statechange', comprobarDispositivo);
    fuente.onended = () => finalizar();
    try {
      fuente.start();
    } catch (error) {
      finalizar(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
