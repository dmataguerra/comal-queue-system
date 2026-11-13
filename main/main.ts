import { app, dialog } from 'electron';
import { silentLogger, type Logger } from '../shared/logging.js';
import { bootstrap, type Disposer } from './app/bootstrap.js';
import { registerPrivilegedScheme } from './app/electron-setup.js';
import { readEnv } from './app/env.js';
import { resolvePaths } from './app/paths.js';
registerPrivilegedScheme();
const env = readEnv();
const paths = resolvePaths({
  env,
  appRoot: app.getAppPath(),
  isPackaged: app.isPackaged,
  execPath: process.execPath,
  userData: app.getPath('userData'),
  documents: app.getPath('documents'),
  mainDir: import.meta.dirname,
});
let logger: Logger = silentLogger;
let disposers: Disposer[] = [];
let quitting = false;
async function shutdown() {
  // Reverse order: transports and windows close before the store they read from.
  for (const dispose of disposers.reverse()) {
    try {
      await dispose();
    } catch (error) {
      logger.warn(`Cierre incompleto: ${(error as Error).message}`);
    }
  }
  disposers = [];
}
async function reportStartupFailure(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  if (logger === silentLogger) console.error('No se pudo iniciar:', error);
  else
    logger.error(`No se pudo iniciar: ${detail}`, {
      stack: error instanceof Error ? error.stack : undefined,
    });
  try {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Turnero',
      message: 'No se pudo iniciar el turnero.',
      detail: `${detail}\n\nCarpeta de datos: ${paths.dataDir}. Revise permisos, ruta y espacio disponible.`,
    });
  } catch (dialogError) {
    console.error('No se pudo mostrar el diagnóstico de arranque:', dialogError);
  } finally {
    app.quit();
  }
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Lifecycle handlers are registered before any await so no event can arrive unhandled.
  let focusOperator = () => {};
  app.on('second-instance', () => focusOperator());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (quitting || !disposers.length) return;
    event.preventDefault();
    quitting = true;
    void shutdown().finally(() => app.quit());
  });
  app
    .whenReady()
    .then(() =>
      bootstrap(paths, env, (fileLogger) => {
        logger = fileLogger;
      }),
    )
    .then((result) => {
      disposers = result.disposers;
      focusOperator = result.focusOperator;
    })
    .catch(reportStartupFailure);
}
