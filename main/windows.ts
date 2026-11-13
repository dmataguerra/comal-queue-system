import { BrowserWindow, screen, type Display, type WebContents } from 'electron';
import type { Screens } from '../shared/contract.js';
import type { Logger } from '../shared/logging.js';
export type View = 'operador' | 'publica';
interface WindowOptions {
  preload: string;
  icon: string;
  url: (view: View) => string;
  preferredDisplay: () => number | null;
  onScreensChanged: (screens: Screens) => void;
  onOperatorClosed: () => void;
  logger: Logger;
  /** The public view is about to be replaced (navigation, reload or renderer crash). */
  onDisplayReplaced?: () => void;
}
const BACKGROUND = '#021a28';
export function createWindows({
  preload,
  icon,
  url,
  preferredDisplay: preferredScreen,
  onScreensChanged: onScreensChanged,
  onOperatorClosed: onOperatorClosed,
  logger,
  onDisplayReplaced: onPublicReload = () => {},
}: WindowOptions) {
  let operatorWindow: BrowserWindow | null = null;
  let publicWindow: BrowserWindow | null = null;
  let closing = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };
  let screens: Screens = { publica: 'ninguna' };
  function protect(win: BrowserWindow, view: View) {
    const content = win.webContents;
    content.setWindowOpenHandler(() => ({ action: 'deny' }));
    content.on('will-navigate', (event, destination) => {
      if (destination !== content.getURL()) event.preventDefault();
    });
    content.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
      if (!isMainFrame || code === -3) return;
      logger.warn(`La vista ${view} no cargó (${description}); se reintenta.`);
      later(() => {
        if (!win.isDestroyed()) void win.loadURL(url(view)).catch(() => {});
      }, 1500);
    });
    // did-navigate fires once the old document is gone, so it can no longer acknowledge audio.
    if (view === 'publica') content.on('did-navigate', () => onPublicReload());
    content.on('render-process-gone', (_event, detail) => {
      if (view === 'publica') onPublicReload();
      logger.error(`La vista ${view} terminó (${detail.reason}); se recarga.`);
      if (!win.isDestroyed()) win.reload();
    });
    void win.loadURL(url(view)).catch(() => {});
  }
  const preferences = (extra: Electron.WebPreferences = {}): Electron.WebPreferences => ({
    preload,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    spellcheck: false,
    ...extra,
  });
  function publicDisplay(): Display {
    const primary = screen.getPrimaryDisplay();
    const secondary = screen.getAllDisplays().filter((display) => display.id !== primary.id);
    const preferred = preferredScreen();
    return secondary.find((display) => display.id === preferred) ?? secondary[0] ?? primary;
  }
  function createOperator() {
    const { workArea } = screen.getPrimaryDisplay();
    operatorWindow = new BrowserWindow({
      ...workArea,
      minWidth: 900,
      minHeight: 600,
      show: false,
      backgroundColor: BACKGROUND,
      autoHideMenuBar: true,
      title: 'Turnero · Operador',
      icon,
      webPreferences: preferences(),
    });
    operatorWindow.once('ready-to-show', () => {
      operatorWindow?.maximize();
      operatorWindow?.show();
    });
    operatorWindow.on('closed', () => {
      operatorWindow = null;
      if (!closing) onOperatorClosed();
    });
    protect(operatorWindow, 'operador');
  }
  function createPublic(display: Display, fullscreen: boolean) {
    const bounds = fullscreen
      ? display.bounds
      : (() => {
          const { x, y, width, height } = display.workArea;
          const windowWidth = Math.min(1280, width);
          const windowHeight = Math.min(720, height);
          return {
            x: x + Math.floor((width - windowWidth) / 2),
            y: y + Math.floor((height - windowHeight) / 2),
            width: windowWidth,
            height: windowHeight,
          };
        })();
    publicWindow = new BrowserWindow({
      ...bounds,
      show: false,
      backgroundColor: BACKGROUND,
      autoHideMenuBar: true,
      title: 'Turnero · Pantalla pública',
      icon,
      frame: !fullscreen,
      fullscreen: fullscreen,
      webPreferences: preferences({
        autoplayPolicy: 'no-user-gesture-required',
        backgroundThrottling: false,
      }),
    });
    const win = publicWindow;
    win.once('ready-to-show', () => {
      if (fullscreen) {
        win.showInactive();
        operatorWindow?.focus();
      } else {
        win.show();
      }
    });
    win.on('closed', () => {
      if (publicWindow === win) publicWindow = null;
      if (!closing) later(sync, 1000);
    });
    protect(win, 'publica');
  }
  function sync() {
    if (closing) return;
    const display = publicDisplay();
    const fullscreen = display.id !== screen.getPrimaryDisplay().id;
    const mode: Screens['publica'] = fullscreen ? 'tv' : 'ventana';
    if (publicWindow && mode !== screens.publica) {
      publicWindow.destroy();
      publicWindow = null;
    }
    if (!publicWindow) createPublic(display, fullscreen);
    else if (
      publicWindow &&
      display &&
      screen.getDisplayMatching(publicWindow.getBounds()).id !== display.id
    ) {
      publicWindow.setFullScreen(false);
      publicWindow.setBounds(display.bounds);
      publicWindow.setFullScreen(true);
    }
    if (mode !== screens.publica) {
      screens = { publica: mode };
      logger.info(
        `Pantalla pública: ${mode} (${screen
          .getAllDisplays()
          .map(
            (d) =>
              `${d.id}${d.id === screen.getPrimaryDisplay().id ? '*' : ''} ${d.bounds.width}x${d.bounds.height}`,
          )
          .join(', ')})`,
      );
      onScreensChanged(screens);
    }
  }
  const onDisplayChanged = () => later(sync, 500);
  return {
    start() {
      createOperator();
      sync();
      screen.on('display-added', onDisplayChanged);
      screen.on('display-removed', onDisplayChanged);
      screen.on('display-metrics-changed', onDisplayChanged);
    },
    sync: sync,
    screens: () => screens,
    windowStatus: () => ({
      operador: Boolean(operatorWindow && !operatorWindow.isDestroyed()),
      publica: Boolean(
        publicWindow && !publicWindow.isDestroyed() && !publicWindow.webContents.isCrashed(),
      ),
    }),
    targets: (): WebContents[] =>
      [operatorWindow, publicWindow].flatMap((win) =>
        win && !win.isDestroyed() ? [win.webContents] : [],
      ),
    isOperator: (sender: WebContents) =>
      Boolean(
        operatorWindow && !operatorWindow.isDestroyed() && sender === operatorWindow.webContents,
      ),
    isDisplay: (sender: WebContents) =>
      Boolean(publicWindow && !publicWindow.isDestroyed() && sender === publicWindow.webContents),
    focusOperator() {
      if (!operatorWindow) return;
      if (operatorWindow.isMinimized()) operatorWindow.restore();
      operatorWindow.focus();
    },
    reloadDisplay() {
      if (publicWindow && !publicWindow.isDestroyed())
        publicWindow.webContents.reloadIgnoringCache();
    },
    close() {
      closing = true;
      screen.off('display-added', onDisplayChanged);
      screen.off('display-removed', onDisplayChanged);
      screen.off('display-metrics-changed', onDisplayChanged);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (publicWindow && !publicWindow.isDestroyed()) publicWindow.destroy();
      if (operatorWindow && !operatorWindow.isDestroyed()) operatorWindow.destroy();
    },
  };
}
