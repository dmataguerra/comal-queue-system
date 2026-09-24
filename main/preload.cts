import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TurneroApi } from './contrato.js';

// Mismos nombres que CANALES en adaptador-ipc.ts.
function escuchar<T extends unknown[]>(canal: string, fn: (...datos: T) => void): () => void {
  const oyente = (_evento: IpcRendererEvent, ...datos: unknown[]) => fn(...(datos as T));
  ipcRenderer.on(canal, oyente);
  return () => {
    ipcRenderer.removeListener(canal, oyente);
  };
}

const turnero: TurneroApi = {
  configurarYouTube: (url) => ipcRenderer.invoke('turnero:youtube', url),
  ajustarVolumenYouTube: (volumen, rampa) =>
    ipcRenderer.invoke('turnero:youtube:volumen', volumen, rampa),
  obtener: () => ipcRenderer.invoke('turnero:obtener'),
  despachar: (accion) => ipcRenderer.invoke('turnero:despachar', accion),
  importarContenido: (categoria) => ipcRenderer.invoke('turnero:contenido:importar', categoria),
  quitarContenido: (url) => ipcRenderer.invoke('turnero:contenido:quitar', url),
  abrirCarpetaContenido: (categoria) => ipcRenderer.invoke('turnero:contenido:abrir', categoria),
  alCambiarEstado: (fn) => escuchar('turnero:estado', fn),
  alCambiarConfig: (fn) => escuchar('turnero:config', fn),
  alCambiarContenido: (fn) => escuchar('turnero:contenido', fn),
  alCambiarPantallas: (fn) => escuchar('turnero:pantallas', fn),
  registrar: (mensaje) => ipcRenderer.send('turnero:registrar', mensaje),
};

contextBridge.exposeInMainWorld('turnero', turnero);
