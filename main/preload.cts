import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { QueueApi } from '../shared/contract.js';
import type { ApiResult } from '../shared/errors.js';
/**
 * Unwraps the ApiResult envelope. A failure rejects with the plain `{ code, message }` object:
 * contextBridge strips custom properties from Error instances, so an Error would lose its code.
 */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as ApiResult<T>;
  if (result.ok) return result.value;
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- see comment above
  throw result.error;
}
function listen<T extends unknown[]>(channel: string, fn: (...data: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, ...data: unknown[]) => fn(...(data as T));
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}
const queueApi: QueueApi = {
  diagnostico: () => invoke('turnero:diagnostico'),
  informarSalud: (type, state) => ipcRenderer.send('turnero:salud', type, state),
  confirmarAnuncio: (id, n, state) => ipcRenderer.send('turnero:anuncio:acuse', id, n, state),
  configurarYouTube: (url) => invoke('turnero:youtube', url),
  configurarVolumen: (voice, media) => invoke('turnero:volumen', voice, media),
  ajustarVolumenYouTube: (volume, ramp) => invoke('turnero:youtube:volumen', volume, ramp),
  obtener: () => invoke('turnero:obtener'),
  despachar: (action) => invoke('turnero:despachar', action),
  importarContenido: (category) => invoke('turnero:contenido:importar', category),
  quitarContenido: (url) => invoke('turnero:contenido:quitar', url),
  abrirCarpetaContenido: (category) => invoke('turnero:contenido:abrir', category),
  abrirManual: () => invoke('turnero:manual:abrir'),
  alCambiarEstado: (fn) => listen('turnero:estado', fn),
  alCambiarConfig: (fn) => listen('turnero:config', fn),
  alCambiarContenido: (fn) => listen('turnero:contenido', fn),
  alCambiarPantallas: (fn) => listen('turnero:pantallas', fn),
  alCambiarEntregaAudio: (fn) => listen('turnero:anuncio:estado', fn),
  registrar: (message, level) => ipcRenderer.send('turnero:registrar', message, level ?? 'warn'),
};
contextBridge.exposeInMainWorld('turnero', queueApi);
