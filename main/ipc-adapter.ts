import { ipcMain, type WebContents } from 'electron';
import type {
  ContentCategory,
  Config,
  Diagnostics,
  AudioDelivery,
  InitialState,
  Inventory,
  Screens,
  ImportResult,
} from '../shared/contract.js';
import type { Logger } from '../shared/logging.js';
import type { Store } from './store.js';
import { IPC_CHANNELS } from '../shared/ipc-channels.js';
import { toApiError, type ApiResult } from '../shared/errors.js';
import {
  authorizeIpc,
  validateAction,
  validateAudioAck,
  validateCount,
  validateCategory,
  validateOptionalCategory,
  validateMessage,
  validateLevel,
  validateHealth,
  validateNoArguments,
  validateContentUrl,
  validateVolume,
  validateVolumes,
  validateYouTube,
} from './ipc-validation.js';
const YOUTUBE_ORIGINS = ['https://www.youtube.com', 'https://www.youtube-nocookie.com'];
import { volumeScript } from './youtube-volume.js';
interface IpcOptions {
  setVolume: (voice: number, media: number) => void;
  setYouTube: (url: string | null) => void;
  store: Store;
  initialState: () => InitialState;
  isOperator: (sender: WebContents) => boolean;
  isDisplay: (sender: WebContents) => boolean;
  viewUrl: (view: 'operador' | 'publica') => string;
  targets: () => WebContents[];
  importContent: (category: ContentCategory) => Promise<ImportResult>;
  removeContent: (url: string) => boolean;
  openContentFolder: (category?: ContentCategory) => Promise<void>;
  openManual: () => Promise<void>;
  logger: Logger;
  diagnostics: () => Diagnostics;
  reportHealth: (type: 'audio' | 'youtube', state: 'correcto' | 'degradado') => void;
  confirmAnnouncement: (
    id: number,
    n: number,
    state: Exclude<AudioDelivery['estado'], 'pendiente'>,
  ) => void;
}
export function connectIpc({
  store,
  initialState: initialState,
  isOperator: isOperator,
  isDisplay: isPublic,
  viewUrl: viewUrl,
  targets: targets,
  importContent: importContent,
  removeContent: removeContent,
  openContentFolder: openContentFolder,
  openManual: openManual,
  setYouTube: configureYouTube,
  setVolume: configureVolume,
  logger,
  diagnostics: diagnostics,
  reportHealth: reportHealth,
  confirmAnnouncement: ackAnnouncement,
}: IpcOptions) {
  const broadcast = (channel: string, ...data: unknown[]) => {
    for (const destination of targets())
      if (!destination.isDestroyed()) destination.send(channel, ...data);
  };
  const authorize = (
    event: Parameters<typeof authorizeIpc<WebContents>>[0],
    view: 'operador' | 'publica' | 'cualquiera',
  ) => authorizeIpc(event, view, isOperator, isPublic, viewUrl);
  type View = 'operador' | 'publica' | 'cualquiera';
  /**
   * Registers an invoke channel. Failures are returned as an ApiResult instead of thrown, because
   * Electron flattens thrown errors into a prefixed string and drops their code.
   */
  const handle = (
    channel: string,
    view: View,
    resolve: (args: unknown[], event: Electron.IpcMainInvokeEvent) => unknown,
  ) =>
    ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<ApiResult<unknown>> => {
      try {
        authorize(event, view);
        return { ok: true, value: await resolve(args, event) };
      } catch (error) {
        const failure = toApiError(error);
        logger.debug('IPC request rejected', {
          channel: channel,
          code: failure.code,
          reason: failure.message,
        });
        return { ok: false, error: failure };
      }
    });
  handle(IPC_CHANNELS.getInitial, 'cualquiera', (args) => {
    validateNoArguments(args);
    return initialState();
  });
  handle(IPC_CHANNELS.diagnostics, 'operador', (args) => {
    validateNoArguments(args);
    return diagnostics();
  });
  handle(IPC_CHANNELS.openManual, 'operador', (args) => {
    validateNoArguments(args);
    return openManual();
  });
  ipcMain.on(IPC_CHANNELS.health, (event, ...args: unknown[]) => {
    try {
      authorize(event, 'publica');
      validateCount(args, 2);
      const [type, state] = validateHealth(args[0], args[1]);
      reportHealth(type, state);
    } catch {
      /* The message is ignored if it fails validation. */
    }
  });
  ipcMain.on(IPC_CHANNELS.audioReceipt, (event, ...args: unknown[]) => {
    try {
      authorize(event, 'publica');
      ackAnnouncement(...validateAudioAck(args));
    } catch {
      /* The message is ignored if it fails validation. */
    }
  });
  handle(IPC_CHANNELS.dispatch, 'operador', (args) => {
    validateCount(args, 1);
    return store.dispatch(validateAction(args[0]));
  });
  handle(IPC_CHANNELS.setYouTube, 'operador', (args) => {
    validateCount(args, 1);
    configureYouTube(validateYouTube(args[0]));
  });
  handle(IPC_CHANNELS.setVolume, 'operador', (args) => {
    validateCount(args, 2);
    configureVolume(...validateVolumes(args[0], args[1]));
  });
  handle(IPC_CHANNELS.importContent, 'operador', (args) => {
    validateCount(args, 1);
    return importContent(validateCategory(args[0]));
  });
  handle(IPC_CHANNELS.removeContent, 'operador', (args) => {
    validateCount(args, 1);
    return removeContent(validateContentUrl(args[0]));
  });
  handle(IPC_CHANNELS.openContentFolder, 'operador', (args) => {
    validateCount(args, 1);
    return openContentFolder(validateOptionalCategory(args[0]));
  });
  ipcMain.on(IPC_CHANNELS.log, (event, ...args: unknown[]) => {
    try {
      const view = authorize(event, 'cualquiera');
      if (args.length < 1 || args.length > 2) throw new Error('Argumentos no válidos.');
      const message = validateMessage(args[0]);
      logger
        .child(view === 'operador' ? 'renderer:operator' : 'renderer:public')
        [validateLevel(args[1])](message);
    } catch {
      /* The message is ignored if it fails validation. */
    }
  });
  let youtubeWarning = '';
  handle(IPC_CHANNELS.setYouTubeVolume, 'publica', async (args, event) => {
    validateCount(args, 2);
    const [volume, ramp] = validateVolume(args[0], args[1]);
    const frames = event.sender.mainFrame.framesInSubtree.filter((frame) =>
      YOUTUBE_ORIGINS.includes(frame.origin),
    );
    const results = await Promise.all(
      frames.map((frame) =>
        frame
          .executeJavaScript(volumeScript(volume, ramp))
          .then(
            (r) =>
              r as {
                videos: number;
                sonando: number;
              },
          )
          .catch(() => ({ videos: 0, sonando: 0 })),
      ),
    );
    const videos = results.reduce((total, r) => total + r.videos, 0);
    const playing = results.reduce((total, r) => total + r.sonando, 0);
    const warning =
      frames.length > 1 || playing > 1
        ? `YouTube duplicado: ${frames.length} iframes, ${videos} videos, ${playing} sonando.`
        : '';
    if (warning && warning !== youtubeWarning) logger.warn(warning);
    youtubeWarning = warning;
    return videos;
  });
  store.subscribe((snapshot, announcement, revision) =>
    broadcast(IPC_CHANNELS.stateChanged, snapshot, announcement, revision),
  );
  return {
    broadcastAudioDelivery: (delivery: AudioDelivery) =>
      broadcast(IPC_CHANNELS.audioReceiptChanged, delivery),
    broadcastConfig: (config: Config) => broadcast(IPC_CHANNELS.configChanged, config),
    broadcastContent: (inventory: Inventory) => broadcast(IPC_CHANNELS.contentChanged, inventory),
    broadcastScreens: (screens: Screens) => broadcast(IPC_CHANNELS.screensChanged, screens),
  };
}
