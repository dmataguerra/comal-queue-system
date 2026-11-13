import { Menu, protocol, session } from 'electron';
import { APP_CONFIG } from '../../shared/app-config.js';
/** Must run before `app.whenReady()`: Electron only accepts privileged schemes at startup. */
export function registerPrivilegedScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_CONFIG.protocol.scheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
}
/** Session-wide settings applied once the app is ready. */
export async function configureSession({ development }: { development: boolean }) {
  Menu.setApplicationMenu(null);
  if (development) await session.defaultSession.clearCache();
  // YouTube embeds refuse to play without a Referer, and file-like origins send none.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [APP_CONFIG.youtube.embedUrlPattern] },
    (details, callback) => {
      callback({
        requestHeaders: { ...details.requestHeaders, Referer: APP_CONFIG.youtube.referer },
      });
    },
  );
}
