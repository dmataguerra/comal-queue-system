import { ipcMain, type WebContents } from 'electron';
import type {
  CategoriaContenido,
  Config,
  Diagnostico,
  Inicial,
  Inventario,
  Pantallas,
  ResultadoImportacion,
} from './contrato.js';
import type { Registrar } from './log.js';
import type { Store } from './store.js';
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
  validarYouTube,
} from './seguridad-ipc.js';

// Los mismos nombres están escritos en preload.cts: el preload aislado no puede importar módulos.
export const CANALES = {
  obtener: 'turnero:obtener',
  despachar: 'turnero:despachar',
  registrar: 'turnero:registrar',
  estado: 'turnero:estado',
  config: 'turnero:config',
  contenido: 'turnero:contenido',
  importarContenido: 'turnero:contenido:importar',
  quitarContenido: 'turnero:contenido:quitar',
  abrirCarpetaContenido: 'turnero:contenido:abrir',
  pantallas: 'turnero:pantallas',
  volumenYouTube: 'turnero:youtube:volumen',
  diagnostico: 'turnero:diagnostico',
  salud: 'turnero:salud',
} as const;

const ORIGENES_YOUTUBE = ['https://www.youtube.com', 'https://www.youtube-nocookie.com'];

/**
 * RF-11 · el IFrame API habla por postMessage y YouTube no acepta el origen turnero://, así que
 * setVolume se pierde. Desde main se entra al iframe y se mueve el volumen del <video> con la misma
 * rampa que los videos locales. No toca muted ni paused: la pausa o el mute del usuario se respetan.
 */
const scriptVolumen = (volumen: number, rampa: number) => `(() => {
  const destino = ${JSON.stringify(volumen)}, ms = ${JSON.stringify(rampa)};
  const id = (window.__turneroRampa = (window.__turneroRampa || 0) + 1);
  const videos = [...document.querySelectorAll('video')];
  for (const video of videos) {
    const desde = video.volume, inicio = performance.now();
    const paso = (ahora) => {
      if (window.__turneroRampa !== id) return;
      const t = ms ? Math.min(1, (ahora - inicio) / ms) : 1;
      video.volume = desde + (destino - desde) * t;
      if (t < 1) requestAnimationFrame(paso);
    };
    paso(inicio);
  }
  return {
    videos: videos.length,
    sonando: videos.filter((v) => !v.paused && !v.muted && v.volume > 0).length,
  };
})()`;

interface OpcionesIpc {
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
  registrar,
  diagnostico,
  informarSalud,
}: OpcionesIpc) {
  const difundir = (canal: string, ...datos: unknown[]) => {
    for (const destino of destinos()) if (!destino.isDestroyed()) destino.send(canal, ...datos);
  };

  const autorizar = (
    evento: Parameters<typeof autorizarIpc<WebContents>>[0],
    vista: 'operador' | 'publica' | 'cualquiera',
  ) => autorizarIpc(evento, vista, esOperador, esPublica, urlVista);

  ipcMain.handle(CANALES.obtener, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'cualquiera');
    validarSinArgumentos(argumentos);
    return inicial();
  });
  ipcMain.handle(CANALES.diagnostico, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarSinArgumentos(argumentos);
    return diagnostico();
  });
  ipcMain.on(CANALES.salud, (evento, ...argumentos: unknown[]) => {
    try {
      autorizar(evento, 'publica');
      validarCantidad(argumentos, 2);
      const [tipo, estado] = validarSalud(argumentos[0], argumentos[1]);
      informarSalud(tipo, estado);
    } catch {
      // Solo la vista pública principal puede comunicar salud multimedia.
    }
  });
  ipcMain.handle(CANALES.despachar, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    return store.despachar(validarAccion(argumentos[0]));
  });
  ipcMain.handle('turnero:youtube', (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    configurarYouTube(validarYouTube(argumentos[0]));
  });
  ipcMain.handle(CANALES.importarContenido, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    return importarContenido(validarCategoria(argumentos[0]));
  });
  ipcMain.handle(CANALES.quitarContenido, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    return quitarContenido(validarUrlContenido(argumentos[0]));
  });
  ipcMain.handle(CANALES.abrirCarpetaContenido, (evento, ...argumentos: unknown[]) => {
    autorizar(evento, 'operador');
    validarCantidad(argumentos, 1);
    return abrirCarpetaContenido(validarCategoriaOpcional(argumentos[0]));
  });
  ipcMain.on(CANALES.registrar, (evento, ...argumentos: unknown[]) => {
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
  ipcMain.handle(CANALES.volumenYouTube, async (evento, ...argumentos: unknown[]) => {
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
  store.suscribir((instantanea, anuncio) => difundir(CANALES.estado, instantanea, anuncio));

  return {
    difundirConfig: (config: Config) => difundir(CANALES.config, config),
    difundirContenido: (inventario: Inventario) => difundir(CANALES.contenido, inventario),
    difundirPantallas: (pantallas: Pantallas) => difundir(CANALES.pantallas, pantallas),
  };
}
