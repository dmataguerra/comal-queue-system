import { app, dialog, shell } from 'electron';
import { mkdirSync } from 'node:fs';
import { APP_CONFIG } from '../../shared/app-config.js';
import type { Config, EntregaAudio, Inicial, Pantallas } from '../../shared/contract.js';
import { MAX_ESPERA_ANUNCIO_MS } from '../../shared/politica-anuncios.js';
import { conectarIpc } from '../adaptador-ipc.js';
import { migrarDatosDocumentos } from '../carpeta-datos.js';
import { registerContentProtocol } from '../content-protocol.js';
import { sembrarContenido, vigilarContenido } from '../contenido.js';
import { crearProveedorDiagnostico } from '../diagnostico.js';
import { crearEntregasAudio } from '../entregas-audio.js';
import { createLogger, type FileLogger } from '../logger.js';
import { crearAperturaManual } from '../manual-usuario.js';
import { migrarDesde02 } from '../migracion-02.js';
import { crearCsp } from '../politica-csp.js';
import { crearServidorWeb } from '../servidor-web.js';
import { crearStore } from '../store.js';
import { limpiarTemporalesJson } from '../temporales.js';
import { crearVentanas } from '../ventanas.js';
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
    ? migrarDatosDocumentos(paths.legacyDocumentsDir, paths.dataDir)
    : false;
  mkdirSync(paths.dataDir, { recursive: true });
  const logger = createLogger(paths.logFile, { version: app.getVersion() });
  onLogger(logger);
  if (migrated)
    logger.info(`Datos copiados desde Documentos a ${paths.dataDir}; originales conservados.`);
  limpiarTemporalesJson(paths.dataDir, logger);
  // 2. Electron session and protocol.
  await configureSession({ development: Boolean(env.devUrl) });
  registerContentProtocol({
    contentRoot: paths.contentDir,
    viewsRoot: paths.viewsDir,
    developmentUrl: env.devUrl,
    contentSecurityPolicy: crearCsp(false),
  });
  // 3. Persistent state and configuration.
  migrarDesde02(paths.legacyDatabase, paths.dataDir, logger);
  const broadcast = createBroadcaster();
  let pantallas: Pantallas = { publica: 'ninguna' };
  let ultimaEntrega: EntregaAudio | null = null;
  const health = createHealthMonitor(logger);
  const entregasAudio = crearEntregasAudio((entrega) => {
    const level =
      entrega.estado === 'fallo' ? 'error' : entrega.estado === 'descartado' ? 'warn' : 'info';
    logger[level](`Audio del turno ${entrega.n}, anuncio ${entrega.id}: ${entrega.estado}.`, {
      announcementId: entrega.id,
      turn: entrega.n,
      status: entrega.estado,
    });
    ultimaEntrega = entrega;
    broadcast.audioDelivery(entrega);
  });
  const store = crearStore({
    ruta: paths.stateFile,
    logger,
    antesDeAnunciar: entregasAudio.comprobarCapacidad,
    esperaAnuncioMs: MAX_ESPERA_ANUNCIO_MS,
  });
  disposers.push(() => store.cerrar());
  store.suscribir((instantanea, anuncio) => {
    entregasAudio.sincronizar(instantanea);
    if (anuncio) entregasAudio.registrar(anuncio);
  });
  const sweep = setInterval(entregasAudio.vencer, APP_CONFIG.audioSweepIntervalMs);
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
  sembrarContenido(paths.factoryContentDir, paths.contentDir, logger);
  const content = vigilarContenido(paths.contentDir, broadcast.content, logger);
  let inventario = content.inicial;
  disposers.push(
    broadcast.add({
      difundirContenido: (nuevo) => (inventario = nuevo),
      difundirConfig: () => {},
      difundirPantallas: () => {},
      difundirEntregaAudio: () => {},
    }),
  );
  disposers.push(content.detener);
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
  const ventanas = crearVentanas({
    preload: paths.preload,
    icon: paths.windowIcon,
    url: paths.viewUrl,
    pantallaPreferida: () => config.get().pantallaPublica,
    alCambiarPantallas: (nuevas) => {
      pantallas = nuevas;
      broadcast.screens(nuevas);
    },
    alCerrarOperador: () => app.quit(),
    alReiniciarPublica: () => entregasAudio.reanudarInterrumpidos(),
    logger,
  });
  const diagnostico = crearProveedorDiagnostico({
    carpetaDatos: paths.dataDir,
    version: app.getVersion(),
    store,
    config: config.get,
    inventario: () => inventario,
    pantallas: () => pantallas,
    ventanas: ventanas.estadoVentanas,
    salud: () => ({
      ...health.snapshot(),
      ultimoErrorAplicacion: logger.lastError()?.message ?? null,
    }),
  });
  const inicial = (): Inicial => ({
    instantanea: store.obtener(),
    revision: store.revision(),
    config: config.get(),
    inventario,
    pantallas,
    entregaAudio: ultimaEntrega,
    entregasAudio: entregasAudio.obtener(),
  });
  const configurarYouTube = (url: string | null) => config.update({ youtubeUrl: url });
  const configurarVolumen = (voz: number, multimedia: number) =>
    config.update({ volumenVoz: voz, volumenMusica: multimedia });
  // 6. Transports: IPC for the Electron windows, HTTP+SSE for a plain browser.
  const ipc = conectarIpc({
    abrirManual: crearAperturaManual({
      origen: paths.manualSource,
      cache: paths.manualCache,
      abrir: (ruta) => shell.openPath(ruta),
    }),
    configurarVolumen,
    configurarYouTube,
    diagnostico,
    informarSalud: health.report,
    confirmarAnuncio: entregasAudio.confirmar,
    store,
    inicial,
    esOperador: ventanas.esOperador,
    esPublica: ventanas.esPublica,
    urlVista: paths.viewUrl,
    destinos: ventanas.destinos,
    ...contentActions,
    logger,
  });
  disposers.push(broadcast.add(ipc));
  const reload = createDailyReload({
    time: () => config.get().recargaDiaria,
    run: () => {
      store.reiniciarSiCambioDia();
      ventanas.recargarPublica();
    },
    logger,
  });
  disposers.push(reload.stop);
  onConfigChanged = (next, previous) => {
    broadcast.config(next);
    if (next.pantallaPublica !== previous.pantallaPublica) ventanas.sincronizar();
    if (next.recargaDiaria !== previous.recargaDiaria) reload.schedule();
  };
  ventanas.iniciar();
  disposers.push(() => ventanas.cerrar());
  try {
    const servidorWeb = await crearServidorWeb({
      puerto: env.serverPort,
      informarSalud: health.report,
      vistas: paths.viewsDir,
      contenido: paths.contentDir,
      store,
      inicial,
      diagnostico,
      configurarYouTube,
      configurarVolumen,
      ...contentActions,
      confirmarAnuncio: entregasAudio.confirmar,
      logger,
    });
    disposers.push(broadcast.add(servidorWeb), () => servidorWeb.cerrar());
    logger.info(`Navegador local: ${servidorWeb.origen} y ${servidorWeb.origen}/publica`);
  } catch (error) {
    logger.error(`No se pudo iniciar el navegador local: ${(error as Error).message}`);
  }
  reload.schedule();
  logger.info(`Turnero iniciado · datos en ${paths.dataDir}`);
  return { disposers, focusOperator: () => ventanas.enfocarOperador() };
}
