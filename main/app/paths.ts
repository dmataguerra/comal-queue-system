import { dirname, join } from 'node:path';
import { APP_CONFIG, viewUrl } from '../../shared/app-config.js';
import { resolveDataDir } from '../data-folder.js';
import type { View } from '../windows.js';
import type { AppEnv } from './env.js';
interface PathSources {
  env: AppEnv;
  appRoot: string;
  isPackaged: boolean;
  execPath: string;
  userData: string;
  documents: string;
  /** Folder of the compiled main-process entry point. */
  mainDir: string;
}
export type AppPaths = ReturnType<typeof resolvePaths>;
export function resolvePaths(sources: PathSources) {
  const { files, manual } = APP_CONFIG;
  const dataDir = resolveDataDir({
    personalizada: sources.env.dataDir,
    empaquetada: sources.isPackaged,
    perfil: sources.userData,
    raiz: sources.appRoot,
  });
  const viewsDir = join(sources.appRoot, 'dist');
  const devUrl = sources.env.devUrl;
  return {
    appRoot: sources.appRoot,
    dataDir,
    contentDir: join(dataDir, files.contentDir),
    factoryContentDir: join(
      sources.isPackaged ? dirname(sources.execPath) : sources.appRoot,
      files.contentDir,
    ),
    viewsDir,
    configFile: join(dataDir, files.config),
    stateFile: join(dataDir, files.state),
    logFile: join(dataDir, files.log),
    legacyDatabase: join(sources.userData, files.legacyDatabase),
    /** Only packaged installs without an explicit data folder migrate from Documents. */
    legacyDocumentsDir:
      sources.isPackaged && !sources.env.dataDir
        ? join(sources.documents, files.legacyDocumentsDir)
        : null,
    preload: join(sources.mainDir, 'preload.cjs'),
    windowIcon: join(sources.appRoot, APP_CONFIG.assets.windowIcon),
    manualSource: devUrl ? join(sources.appRoot, manual.source) : join(viewsDir, manual.served),
    manualCache: join(sources.userData, 'manual'),
    viewUrl: (view: View) => viewUrl(devUrl ?? APP_CONFIG.protocol.origin, view),
  };
}
