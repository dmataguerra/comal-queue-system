import type { Inventario } from '../../main/contrato';

// §6 · Todo el audio se decodifica al arrancar: en el camino crítico nunca se lee disco.
let contexto: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
const obtenerContexto = () => (contexto ??= new AudioContext());

function cargar(url: string) {
  let buffer = buffers.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((r) => {
        if (!r.ok)
          throw new Error(
            `Falta un archivo de audio: ${decodeURIComponent(url.split('/').pop() ?? url)}`,
          );
        return r.arrayBuffer();
      })
      .then((datos) => obtenerContexto().decodeAudioData(datos));
    buffer.catch(() => buffers.delete(url));
    buffers.set(url, buffer);
  }
  return buffer;
}

/** Precarga el aviso y las 100 voces del inventario; descarta lo que ya no existe. */
export async function precargar(inventario: Inventario) {
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

export async function reproducir(url: string, volumen: number, signal: AbortSignal) {
  const buffer = await cargar(url);
  if (signal.aborted) return;
  const ctx = obtenerContexto();
  if (ctx.state !== 'running') await ctx.resume();
  if (signal.aborted) return;
  await new Promise<void>((resolve, reject) => {
    const fuente = ctx.createBufferSource(),
      ganancia = ctx.createGain();
    fuente.buffer = buffer;
    ganancia.gain.value = volumen;
    fuente.connect(ganancia).connect(ctx.destination);
    const detener = () => {
      try {
        fuente.stop();
      } catch {}
    };
    signal.addEventListener('abort', detener, { once: true });
    fuente.onended = () => {
      signal.removeEventListener('abort', detener);
      fuente.disconnect();
      ganancia.disconnect();
      resolve();
    };
    try {
      fuente.start();
    } catch (error) {
      signal.removeEventListener('abort', detener);
      reject(error);
    }
  });
}
