import { app, dialog, shell } from 'electron';
import { mkdirSync } from 'node:fs';
import { APP_CONFIG } from '../../shared/app-config.js';
import type { Config, AudioDelivery, InitialState, Screens } from '../../shared/contract.js';
import { MAX_ANNOUNCEMENT_WAIT_MS } from '../../shared/announcement-policy.js';
import { connectIpc } from '../ipc-adapter.js';
import { migrateDocumentsData } from '../data-folder.js';
import { registerContentProtocol } from '../content-protocol.js';
import { seedContent, watchContent } from '../content.js';
import { createDiagnosticsProvider } from '../diagnostics.js';
import { createAudioDeliveries } from '../audio-deliveries.js';
import { createLogger, type FileLogger } from '../logger.js';
import { createManualOpener } from '../user-manual.js';
import { migrateFrom02 } from '../legacy-migration.js';
import { createCsp } from '../csp-policy.js';
import { createWebServer } from '../web-server.js';
import { createStore } from '../store.js';
import { cleanTempJsonFiles } from '../temp-files.js';
import { createWindows } from '../windows.js';
import { createBroadcaster } from './broadcaster.js';
import { createConfigService } from './config-service.js';
import { createContentActions } from './content-actions.js';
import { createDailyReload } from './daily-reload.js';
import { configureSession } from './electron-setup.js';
import type { AppEnv } from './env.js';
import { createHealthMonitor } from './health.js';
import type { AppPaths } from './paths.js';
/** Things that must be released on quit. They run in reverse order of registration. */
export type Disposer = () => void | Promise<void>;
/**
 * Creates every service and wires them together. Order matters and is linear on purpose:
 * data folder and logger first, then state, then windows and transports.
 */
export async function bootstrap(
  paths: AppPaths,
  env: AppEnv,
  onLogger: (logger: FileLogger) => void,
): Promise<{ disposers: Disposer[]; focusOperator: () => void }> {
  const disposers: Disposer[] = [];
  // 1. Data folder and logger.
  const migrated = paths.legacyDocumentsDir
    ? migrateDocumentsData(paths.legacyDocumentsDir, paths.dataDir)
    : false;
  mkdirSync(paths.dataDir, { recursive: true });
  const logger = createLogger(paths.logFile, { version: app.getVersion() });
  onLogger(logger);
  if (migrated)
    logger.info(`Datos copiados desde Documentos a ${paths.dataDir}; originales conservados.`);
  cleanTempJsonFiles(paths.dataDir, logger);
  // 2. Electron session and protocol.
  await configureSession({ development: Boolean(env.devUrl) });
  registerContentProtocol({
    contentRoot: paths.contentDir,
    viewsRoot: paths.viewsDir,
    developmentUrl: env.devUrl,
    contentSecurityPolicy: createCsp(false),
  });
  // 3. Persistent state and configuration.
  migrateFrom02(paths.legacyDatabase, paths.dataDir, logger);
  const broadcast = createBroadcaster();
  let screens: Screens = { publica: 'ninguna' };
  let lastDelivery: AudioDelivery | null = null;
  const health = createHealthMonitor(logger);
  const audioDeliveries = createAudioDeliveries((delivery) => {
    const level =
      delivery.estado === 'fallo' ? 'error' : delivery.estado === 'descartado' ? 'warn' : 'info';
    logger[level](`Audio del turno ${delivery.n}, anuncio ${delivery.id}: ${delivery.estado}.`, {
      announcementId: delivery.id,
      turn: delivery.n,
      status: delivery.estado,
    });
    lastDelivery = delivery;
    broadcast.audioDelivery(delivery);
  });
  const store = createStore({
    filePath: paths.stateFile,
    logger,
    beforeAnnounce: audioDeliveries.ensureCapacity,
    announcementWaitMs: MAX_ANNOUNCEMENT_WAIT_MS,
  });
  disposers.push(() => store.close());
  store.subscribe((snapshot, announcement) => {
    audioDeliveries.sync(snapshot);
    if (announcement) audioDeliveries.register(announcement);
  });
  const sweep = setInterval(audioDeliveries.expire, APP_CONFIG.audioSweepIntervalMs);
  disposers.push(() => clearInterval(sweep));
  // `ventanas` and `reload` are referenced by the config callback, which only fires after
  // startup finishes, so both are assigned before it can run.
  let onConfigChanged: (next: Config, previous: Config) => void = () => {};
  const config = createConfigService({
    path: paths.configFile,
    logger,
    onChange: (next, previous) => onConfigChanged(next, previous),
  });
  disposers.push(config.stop);
  // 4. Content.
  seedContent(paths.factoryContentDir, paths.contentDir, logger);
  const content = watchContent(paths.contentDir, broadcast.content, logger);
  let inventory = content.initial;
  disposers.push(
    broadcast.add({
      broadcastContent: (updated) => (inventory = updated),
      broadcastConfig: () => {},
      broadcastScreens: () => {},
      broadcastAudioDelivery: () => {},
    }),
  );
  disposers.push(content.stop);
  const contentActions = createContentActions({
    contentDir: paths.contentDir,
    logger,
    pickFiles: async ({ title, filterName, extensions }) => {
      const choice = await dialog.showOpenDialog({
        title,
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: filterName, extensions },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
      });
      return choice.canceled ? null : choice.filePaths;
    },
    openPath: (path) => shell.openPath(path),
  });
  // 5. Windows.
  const windows = createWindows({
    preload: paths.preload,
    icon: paths.windowIcon,
    url: paths.viewUrl,
    preferredDisplay: () => config.get().pantallaPublica,
    onScreensChanged: (updatedScreens) => {
      screens = updatedScreens;
      broadcast.screens(updatedScreens);
    },
    onOperatorClosed: () => app.quit(),
    onDisplayReplaced: () => audioDeliveries.resumeInterrupted(),
    logger,
  });
  const diagnostics = createDiagnosticsProvider({
    dataDir: paths.dataDir,
    version: app.getVersion(),
    store,
    config: config.get,
    inventory: () => inventory,
    screens: () => screens,
    windows: windows.windowStatus,
    health: () => ({
      ...health.snapshot(),
      ultimoErrorAplicacion: logger.lastError()?.message ?? null,
    }),
  });
  const initialState = (): InitialState => ({
    instantanea: store.getSnapshot(),
    revision: store.revision(),
    config: config.get(),
    inventario: inventory,
    pantallas: screens,
    entregaAudio: lastDelivery,
    entregasAudio: audioDeliveries.list(),
  });
  const configureYouTube = (url: string | null) => config.update({ youtubeUrl: url });
  const configureVolume = (voice: number, media: number) =>
    config.update({ volumenVoz: voice, volumenMusica: media });
  // 6. Transports: IPC for the Electron windows, HTTP+SSE for a plain browser.
  const ipc = connectIpc({
    openManual: createManualOpener({
      origen: paths.manualSource,
      cache: paths.manualCache,
      abrir: (filePath) => shell.openPath(filePath),
    }),
    setVolume: configureVolume,
    setYouTube: configureYouTube,
    diagnostics: diagnostics,
    reportHealth: health.report,
    confirmAnnouncement: audioDeliveries.confirm,
    store,
    initialState: initialState,
    isOperator: windows.isOperator,
    isDisplay: windows.isDisplay,
    viewUrl: paths.viewUrl,
    targets: windows.targets,
    ...contentActions,
    logger,
  });
  disposers.push(broadcast.add(ipc));
  const reload = createDailyReload({
    time: () => config.get().recargaDiaria,
    run: () => {
      store.resetIfDayChanged();
      windows.reloadDisplay();
    },
    logger,
  });
  disposers.push(reload.stop);
  onConfigChanged = (next, previous) => {
    broadcast.config(next);
    if (next.pantallaPublica !== previous.pantallaPublica) windows.sync();
    if (next.recargaDiaria !== previous.recargaDiaria) reload.schedule();
  };
  windows.start();
  disposers.push(() => windows.close());
  try {
    const webServer = await createWebServer({
      port: env.serverPort,
      reportHealth: health.report,
      viewsDir: paths.viewsDir,
      contentDir: paths.contentDir,
      store,
      initialState: initialState,
      diagnostics: diagnostics,
      setYouTube: configureYouTube,
      setVolume: configureVolume,
      ...contentActions,
      confirmAnnouncement: audioDeliveries.confirm,
      logger,
    });
    disposers.push(broadcast.add(webServer), () => webServer.close());
    logger.info(`Navegador local: ${webServer.origin} y ${webServer.origin}/publica`);
  } catch (error) {
    logger.error(`No se pudo iniciar el navegador local: ${(error as Error).message}`);
  }
  reload.schedule();
  logger.info(`Turnero iniciado · datos en ${paths.dataDir}`);
  return { disposers, focusOperator: () => windows.focusOperator() };
}
