/**
 * Single source of truth for values that used to be repeated across the main process,
 * Vite, the dev script and the CSP. Names of persisted files and folders are part of the
 * on-disk contract with existing installations: do not rename them without a migration.
 */
export const APP_CONFIG = {
  protocol: { scheme: 'turnero', origin: 'turnero://app' },
  devServer: { host: '127.0.0.1', port: 5173 },
  localServer: { host: '127.0.0.1', defaultPort: 4317 },
  files: {
    config: 'config.json',
    state: 'estado.json',
    log: 'turnero.log',
    contentDir: 'contenido',
    legacyDatabase: 'comal.sqlite',
    legacyDocumentsDir: 'Turnero Comal',
  },
  manual: {
    /** Repository path of the PDF that Vite bundles. */
    source: 'output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf',
    /** Path inside the built views folder and over HTTP. */
    served: 'manual/manual-usuario-0.4.0.pdf',
  },
  assets: { windowIcon: 'public/assets/branding/comal-trojan-helmet.ico' },
  youtube: {
    embedUrlPattern: 'https://www.youtube.com/embed/*',
    referer: 'https://mx.uaq.comal.local/',
  },
  /** How often expired audio deliveries are swept. */
  audioSweepIntervalMs: 250,
} as const;
export const devServerUrl = `http://${APP_CONFIG.devServer.host}:${APP_CONFIG.devServer.port}`;
export const devServerWebSocketUrl = `ws://${APP_CONFIG.devServer.host}:${APP_CONFIG.devServer.port}`;
/** View ids are runtime values used across IPC checks; folders are the English source layout. */
export const VIEW_FOLDERS = { operador: 'views/operator', publica: 'views/display' } as const;
export const viewPath = (view: keyof typeof VIEW_FOLDERS) => `/${VIEW_FOLDERS[view]}/index.html`;
export const viewUrl = (base: string, view: keyof typeof VIEW_FOLDERS) =>
  `${base}${viewPath(view)}`;
