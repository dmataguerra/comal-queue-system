import type { Inventory } from '../../shared/contract';
let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let audioRevision: string | undefined;
const getContext = () => (context ??= new AudioContext());
export function closeAudio() {
  const previous = context;
  context = null;
  buffers.clear();
  audioRevision = undefined;
  if (previous) void previous.close();
}
function load(url: string) {
  let buffer = buffers.get(url);
  if (!buffer) {
    const file = decodeURIComponent(url.split('/').pop() ?? url);
    buffer = fetch(url, { signal: AbortSignal.timeout(15000) })
      .catch(() => {
        throw new Error(
          `No se pudo acceder al audio local ${file}. Revisa la ruta y los permisos del contenido.`,
        );
      })
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo abrir el audio local ${file} (HTTP ${r.status}).`);
        return r.arrayBuffer();
      })
      .then((data) =>
        getContext()
          .decodeAudioData(data)
          .catch(() => {
            throw new Error(`El audio local ${file} no se pudo decodificar.`);
          }),
      );
    buffer.catch(() => {
      if (buffers.get(url) === buffer) buffers.delete(url);
    });
    buffers.set(url, buffer);
  }
  return buffer;
}
export async function preload(inventory: Inventory) {
  if (inventory.revisionAudio !== audioRevision) buffers.clear();
  audioRevision = inventory.revisionAudio;
  const urls = [inventory.aviso, ...inventory.voz].filter((url): url is string => Boolean(url));
  for (const url of buffers.keys()) if (!urls.includes(url)) buffers.delete(url);
  await Promise.all(urls.map(load));
}
export function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const end = () => {
      clearTimeout(id);
      signal.removeEventListener('abort', end);
      resolve();
    };
    const id = setTimeout(end, ms);
    signal.addEventListener('abort', end, { once: true });
  });
}
function awaitAudio<T>(operation: Promise<T>, signal: AbortSignal, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => finish(new DOMException('Anuncio cancelado', 'AbortError'));
    const timeoutId = setTimeout(
      () => finish(new Error('Tiempo agotado al preparar el audio.')),
      ms,
    );
    const cleanup = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', cancel);
    };
    const finish = (error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    operation.then((value) => {
      cleanup();
      resolve(value);
    }, finish);
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });
  });
}
export async function play(url: string, volume: number, signal: AbortSignal) {
  if (signal.aborted) return;
  const buffer = await awaitAudio(load(url), signal, 20000);
  if (signal.aborted) return;
  const ctx = getContext();
  if (ctx.state !== 'running') await awaitAudio(ctx.resume(), signal, 5000);
  if (signal.aborted) return;
  if (ctx.state !== 'running') throw new Error('La salida de sonido no está disponible.');
  await new Promise<void>((resolve, reject) => {
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    let finished = false;
    const finalize = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', stop);
      ctx.removeEventListener('statechange', checkDevice);
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* El cierre del audio puede coincidir con su limpieza. */
      }
      source.disconnect();
      gain.disconnect();
      if (error) reject(error);
      else resolve();
    };
    const stop = () => finalize();
    const checkDevice = () => {
      if (ctx.state !== 'running')
        finalize(
          new Error('La salida de sonido se interrumpió. Revisa el dispositivo y vuelve a llamar.'),
        );
    };
    const timeoutId = setTimeout(
      () =>
        finalize(
          new Error('El audio no terminó en el tiempo esperado. Revisa la salida de sonido.'),
        ),
      Math.ceil(buffer.duration * 1000) + 5000,
    );
    signal.addEventListener('abort', stop, { once: true });
    ctx.addEventListener('statechange', checkDevice);
    source.onended = () => finalize();
    try {
      source.start();
    } catch (error) {
      finalize(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
