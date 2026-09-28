import { BrowserWindow, screen, type Display, type WebContents } from 'electron';
import type { Pantallas } from '../shared/contract.js';
import type { Registrar } from './log.js';

export type Vista = 'operador' | 'publica';

interface OpcionesVentanas {
  preload: string;
  url: (vista: Vista) => string;
  pantallaPreferida: () => number | null;
  alCambiarPantallas: (pantallas: Pantallas) => void;
  alCerrarOperador: () => void;
  registrar: Registrar;
}

const FONDO = '#021a28';

/** Displays, pantalla completa y RF-13: el campo de captura nunca se muestra en la TV. */
export function crearVentanas({
  preload,
  url,
  pantallaPreferida,
  alCambiarPantallas,
  alCerrarOperador,
  registrar,
}: OpcionesVentanas) {
  let operador: BrowserWindow | null = null;
  let publica: BrowserWindow | null = null;
  let cerrando = false;
  const temporizadores = new Set<ReturnType<typeof setTimeout>>();
  const despues = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      temporizadores.delete(timer);
      fn();
    }, ms);
    temporizadores.add(timer);
  };
  let pantallas: Pantallas = { publica: 'ninguna' };

  function proteger(ventana: BrowserWindow, vista: Vista) {
    const contenido = ventana.webContents;
    contenido.setWindowOpenHandler(() => ({ action: 'deny' }));
    contenido.on('will-navigate', (evento, destino) => {
      if (destino !== contenido.getURL()) evento.preventDefault();
    });
    // En desarrollo Vite puede tardar en levantar; en producción cubre cualquier fallo transitorio.
    contenido.on('did-fail-load', (_evento, codigo, descripcion, _url, esPrincipal) => {
      if (!esPrincipal || codigo === -3) return; // -3: navegación abortada, no es un fallo
      registrar(`La vista ${vista} no cargó (${descripcion}); se reintenta.`);
      despues(() => {
        if (!ventana.isDestroyed()) void ventana.loadURL(url(vista)).catch(() => {});
      }, 1500);
    });
    contenido.on('render-process-gone', (_evento, detalle) => {
      registrar(`La vista ${vista} terminó (${detalle.reason}); se recarga.`);
      if (!ventana.isDestroyed()) ventana.reload();
    });
    void ventana.loadURL(url(vista)).catch(() => {}); // el fallo se atiende en did-fail-load
  }

  const preferencias = (extra: Electron.WebPreferences = {}): Electron.WebPreferences => ({
    preload,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    spellcheck: false,
    ...extra,
  });

  /** La pública prefiere un display secundario y usa el primario como fallback. */
  function displayPublico(): Display {
    const primario = screen.getPrimaryDisplay();
    const secundarios = screen.getAllDisplays().filter((display) => display.id !== primario.id);
    const preferido = pantallaPreferida();
    return secundarios.find((display) => display.id === preferido) ?? secundarios[0] ?? primario;
  }

  function crearOperador() {
    const { workArea } = screen.getPrimaryDisplay();
    operador = new BrowserWindow({
      ...workArea,
      minWidth: 900,
      minHeight: 600,
      show: false,
      backgroundColor: FONDO,
      autoHideMenuBar: true,
      title: 'Turnero · Operador',
      webPreferences: preferencias(),
    });
    operador.once('ready-to-show', () => {
      operador?.maximize();
      operador?.show();
    });
    operador.on('closed', () => {
      operador = null;
      if (!cerrando) alCerrarOperador();
    });
    proteger(operador, 'operador');
  }

  function crearPublica(display: Display, pantallaCompleta: boolean) {
    const bounds = pantallaCompleta
      ? display.bounds
      : (() => {
          const { x, y, width, height } = display.workArea;
          const ventanaWidth = Math.min(1280, width);
          const ventanaHeight = Math.min(720, height);
          return {
            x: x + Math.floor((width - ventanaWidth) / 2),
            y: y + Math.floor((height - ventanaHeight) / 2),
            width: ventanaWidth,
            height: ventanaHeight,
          };
        })();
    publica = new BrowserWindow({
      ...bounds,
      show: false,
      backgroundColor: FONDO,
      autoHideMenuBar: true,
      title: 'Turnero · Pantalla pública',
      frame: !pantallaCompleta,
      fullscreen: pantallaCompleta,
      // La pública nunca tiene el foco: sin estrangulamiento de temporizadores y con audio sin gesto.
      webPreferences: preferencias({
        autoplayPolicy: 'no-user-gesture-required',
        backgroundThrottling: false,
      }),
    });
    const ventana = publica;
    ventana.once('ready-to-show', () => {
      ventana.showInactive();
      operador?.focus();
    });
    ventana.on('closed', () => {
      if (publica === ventana) publica = null;
      // Si alguien la cierra por accidente, vuelve mientras exista su pantalla.
      if (!cerrando) despues(sincronizar, 1000);
    });
    proteger(ventana, 'publica');
  }

  function sincronizar() {
    if (cerrando) return;
    const display = displayPublico();
    const pantallaCompleta = display.id !== screen.getPrimaryDisplay().id;
    const modo: Pantallas['publica'] = pantallaCompleta ? 'tv' : 'ventana';
    // Al pasar de TV a ventana (o al revés) se recrea: marco y pantalla completa no se cambian en vivo.
    if (publica && modo !== pantallas.publica) {
      publica.destroy();
      publica = null;
    }
    if (!publica) crearPublica(display, pantallaCompleta);
    else if (
      publica &&
      display &&
      screen.getDisplayMatching(publica.getBounds()).id !== display.id
    ) {
      publica.setFullScreen(false);
      publica.setBounds(display.bounds);
      publica.setFullScreen(true);
    }
    if (modo !== pantallas.publica) {
      pantallas = { publica: modo };
      registrar(
        `Pantalla pública: ${modo} (${screen
          .getAllDisplays()
          .map(
            (d) =>
              `${d.id}${d.id === screen.getPrimaryDisplay().id ? '*' : ''} ${d.bounds.width}x${d.bounds.height}`,
          )
          .join(', ')})`,
      );
      alCambiarPantallas(pantallas);
    }
  }

  const alCambiarDisplay = () => despues(sincronizar, 500);

  return {
    iniciar() {
      crearOperador();
      sincronizar();
      // La TV suele encenderse después que la PC: se reacomoda cuando aparece o desaparece.
      screen.on('display-added', alCambiarDisplay);
      screen.on('display-removed', alCambiarDisplay);
      screen.on('display-metrics-changed', alCambiarDisplay);
    },
    sincronizar,
    pantallas: () => pantallas,
    estadoVentanas: () => ({
      operador: Boolean(operador && !operador.isDestroyed()),
      publica: Boolean(publica && !publica.isDestroyed() && !publica.webContents.isCrashed()),
    }),
    destinos: (): WebContents[] =>
      [operador, publica].flatMap((ventana) =>
        ventana && !ventana.isDestroyed() ? [ventana.webContents] : [],
      ),
    esOperador: (remitente: WebContents) =>
      Boolean(operador && !operador.isDestroyed() && remitente === operador.webContents),
    esPublica: (remitente: WebContents) =>
      Boolean(publica && !publica.isDestroyed() && remitente === publica.webContents),
    enfocarOperador() {
      if (!operador) return;
      if (operador.isMinimized()) operador.restore();
      operador.focus();
    },
    recargarPublica() {
      if (publica && !publica.isDestroyed()) publica.webContents.reloadIgnoringCache();
    },
    cerrar() {
      cerrando = true;
      screen.off('display-added', alCambiarDisplay);
      screen.off('display-removed', alCambiarDisplay);
      screen.off('display-metrics-changed', alCambiarDisplay);
      for (const timer of temporizadores) clearTimeout(timer);
      temporizadores.clear();
      if (publica && !publica.isDestroyed()) publica.destroy();
      if (operador && !operador.isDestroyed()) operador.destroy();
    },
  };
}
