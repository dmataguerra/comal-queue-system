import { ipcMain, type WebContents } from 'electron';
import type {
  CategoriaContenido,
  Config,
  Diagnostico,
  EntregaAudio,
  Inicial,
  Inventario,
  Pantallas,
  ResultadoImportacion,
} from '../shared/contract.js';
import type { Registrar } from './log.js';
import type { Store } from './store.js';
import { IPC_CHANNELS } from '../shared/ipc-channels.js';
import {
  autorizarIpc,
  validarAccion,
  validarCantidad,
  validarCategoria,
  validarCategoriaOpcional,
  validarMensaje,
  validarSalud,
  validarSinArgumentos,
  validarUrlContenido,
  validarVolumen,
  validarVolumenes,
  validarYouTube,
} from './seguridad-ipc.js';

const ORIGENES_YOUTUBE = ['https://www.youtube.com', 'https://www.youtube-nocookie.com'];

import { scriptVolumen } from './volumen-youtube.js';

interface OpcionesIpc {
  configurarVolumen: (voz: number, multimedia: number) => void;
  configurarYouTube: (url: string | null) => void;
  store: Store;
  inicial: () => Inicial;
  esOperador: (remitente: WebContents) => boolean;
  esPublica: (remitente: WebContents) => boolean;
  urlVista: (vista: 'operador' | 'publica') => string;
  destinos: () => WebContents[];
  importarContenido: (categoria: CategoriaContenido) => Promise<ResultadoImportacion>;
  quitarContenido: (url: string) => boolean;
  abrirCarpetaContenido: (categoria?: CategoriaContenido) => Promise<void>;
  registrar: Registrar;
  diagnostico: () => Diagnostico;
  informarSalud: (tipo: 'audio' | 'youtube', estado: 'correcto' | 'degradado') => void;
  confirmarAnuncio: (
    id: number,
    n: number,
    estado: 'reproduciendo' | 'reproducido' | 'fallo',
  ) => void;
}

/** Adaptador de la topología A: las dos ventanas hablan con el store por IPC, sin red. */
export function conectarIpc({
  store,
  inicial,
  esOperador,
  esPublica,
  urlVista,
  destinos,
  importarContenido,
  quitarContenido,
  abrirCarpetaContenido,
  configurarYouTube,
  configurarVolumen,
  registrar,
  diagnostico,
  informarSalud,
  confirmarAnuncio,
}: OpcionesIpc) {
  const difundir = (canal: string, ...datos: unknown[]) => {
    for (const destino of destinos()) if (!destino.isDestroyed()) destino.send(canal, ...datos);
  };

  const autorizar = (
    evento: Parameters<typeof autorizarIpc<WebContents>>[0],
    vista: 'operador' | 'publica' | 'cualquiera',
  ) => autorizarIpc(evento, vista, esOperador, esPublica, urlVista);

  ipcMain.handle(IPC_CHANNELS.getInitial, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'cualquiera');
    validarSinArgumentos(argumentos);
    return inicial();
  });
  ipcMain.handle(IPC_CHANNELS.diagnostics, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarSinArgumentos(argumentos);
    return diagnostico();
  });
  ipcMain.on(IPC_CHANNELS.health, (evento, ...argumentos: unknown[]) => {
    try {
      autorizar(evento, 'publica');
      validarCantidad(argumentos, 2);
      const [tipo, estado] = validarSalud(argumentos[0], argumentos[1]);
      informarSalud(tipo, estado);
    } catch {
      // Solo la vista pública principal puede comunicar salud multimedia.
    }
  });
  ipcMain.on(IPC_CHANNELS.audioReceipt, (evento, ...argumentos: unknown[]) => {
    try {
      autorizar(evento, 'publica');
      validarCantidad(argumentos, 3);
      const [id, n, estado] = argumentos;
      if (
        !Number.isInteger(id) ||
        (id as number) < 1 ||
        !Number.isInteger(n) ||
        (n as number) < 0 ||
        (n as number) > 99 ||
        (estado !== 'reproduciendo' && estado !== 'reproducido' && estado !== 'fallo')
      )
        return;
      confirmarAnuncio(id as number, n as number, estado);
    } catch {
      // Solo la vista pública registrada puede confirmar su reproducción.
    }
  });
  ipcMain.handle(IPC_CHANNELS.dispatch, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    return store.despachar(validarAccion(argumentos[0]));
  });
  ipcMain.handle(IPC_CHANNELS.setYouTube, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    configurarYouTube(validarYouTube(argumentos[0]));
  });
  ipcMain.handle(IPC_CHANNELS.setVolume, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 2);
    configurarVolumen(...validarVolumenes(argumentos[0], argumentos[1]));
  });
  ipcMain.handle(IPC_CHANNELS.importContent, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    return importarContenido(validarCategoria(argumentos[0]));
  });
  ipcMain.handle(IPC_CHANNELS.removeContent, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    return quitarContenido(validarUrlContenido(argumentos[0]));
  });
  ipcMain.handle(IPC_CHANNELS.openContentFolder, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    return abrirCarpetaContenido(validarCategoriaOpcional(argumentos[0]));
  });
  ipcMain.on(IPC_CHANNELS.log, (evento, ...argumentos: unknown[]) => {
    try {
      const vista = autorizar(evento, 'cualquiera');
      validarCantidad(argumentos, 1);
      registrar(
        `[${vista === 'operador' ? 'operador' : 'pública'}] ${validarMensaje(argumentos[0])}`,
      );
    } catch {
      // `send` no tiene respuesta; no se debe lanzar desde este oyente del proceso principal.
    }
  });
  let avisoYouTube = '';
  ipcMain.handle(IPC_CHANNELS.setYouTubeVolume, async (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'publica');
    validarCantidad(argumentos, 2);
    const [volumen, rampa] = validarVolumen(argumentos[0], argumentos[1]);
    const frames = evento.sender.mainFrame.framesInSubtree.filter((frame) =>
      ORIGENES_YOUTUBE.includes(frame.origin),
    );
    const resultados = await Promise.all(
      frames.map((frame) =>
        frame
          .executeJavaScript(scriptVolumen(volumen, rampa))
          .then((r) => r as { videos: number; sonando: number })
          .catch(() => ({ videos: 0, sonando: 0 })),
      ),
    );
    const videos = resultados.reduce((total, r) => total + r.videos, 0);
    const sonando = resultados.reduce((total, r) => total + r.sonando, 0);
    // Más de un reproductor explica audio que sigue sonando tras pausar el visible.
    const aviso =
      frames.length > 1 || sonando > 1
        ? `YouTube duplicado: ${frames.length} iframes, ${videos} videos, ${sonando} sonando.`
        : '';
    if (aviso && aviso !== avisoYouTube) registrar(aviso);
    avisoYouTube = aviso;
    return videos;
  });
  store.suscribir((instantanea, anuncio) =>
    difundir(IPC_CHANNELS.stateChanged, instantanea, anuncio),
  );

  return {
    difundirEntregaAudio: (entrega: EntregaAudio) =>
      difundir(IPC_CHANNELS.audioReceiptChanged, entrega),
    difundirConfig: (config: Config) => difundir(IPC_CHANNELS.configChanged, config),
    difundirContenido: (inventario: Inventario) =>
      difundir(IPC_CHANNELS.contentChanged, inventario),
    difundirPantallas: (pantallas: Pantallas) => difundir(IPC_CHANNELS.screensChanged, pantallas),
  };
}
