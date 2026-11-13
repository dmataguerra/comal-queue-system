import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TurneroApi } from '../shared/contract.js';
import type { ApiResult } from '../shared/errors.js';
/**
 * Unwraps the ApiResult envelope. A failure rejects with the plain `{ code, message }` object:
 * contextBridge strips custom properties from Error instances, so an Error would lose its code.
 */
async function invocar<T>(canal: string, ...argumentos: unknown[]): Promise<T> {
  const resultado = (await ipcRenderer.invoke(canal, ...argumentos)) as ApiResult<T>;
  if (resultado.ok) return resultado.value;
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- see comment above
  throw resultado.error;
}
function escuchar<T extends unknown[]>(canal: string, fn: (...datos: T) => void): () => void {
  const oyente = (_evento: IpcRendererEvent, ...datos: unknown[]) => fn(...(datos as T));
  ipcRenderer.on(canal, oyente);
  return () => {
    ipcRenderer.removeListener(canal, oyente);
  };
}
const turnero: TurneroApi = {
  diagnostico: () => invocar('turnero:diagnostico'),
  informarSalud: (tipo, estado) => ipcRenderer.send('turnero:salud', tipo, estado),
  confirmarAnuncio: (id, n, estado) => ipcRenderer.send('turnero:anuncio:acuse', id, n, estado),
  configurarYouTube: (url) => invocar('turnero:youtube', url),
  configurarVolumen: (voz, multimedia) => invocar('turnero:volumen', voz, multimedia),
  ajustarVolumenYouTube: (volumen, rampa) => invocar('turnero:youtube:volumen', volumen, rampa),
  obtener: () => invocar('turnero:obtener'),
  despachar: (accion) => invocar('turnero:despachar', accion),
  importarContenido: (categoria) => invocar('turnero:contenido:importar', categoria),
  quitarContenido: (url) => invocar('turnero:contenido:quitar', url),
  abrirCarpetaContenido: (categoria) => invocar('turnero:contenido:abrir', categoria),
  abrirManual: () => invocar('turnero:manual:abrir'),
  alCambiarEstado: (fn) => escuchar('turnero:estado', fn),
  alCambiarConfig: (fn) => escuchar('turnero:config', fn),
  alCambiarContenido: (fn) => escuchar('turnero:contenido', fn),
  alCambiarPantallas: (fn) => escuchar('turnero:pantallas', fn),
  alCambiarEntregaAudio: (fn) => escuchar('turnero:anuncio:estado', fn),
  registrar: (mensaje, nivel) => ipcRenderer.send('turnero:registrar', mensaje, nivel ?? 'warn'),
};
contextBridge.exposeInMainWorld('turnero', turnero);
