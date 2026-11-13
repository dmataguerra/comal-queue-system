import { APP_CONFIG, devServerWebSocketUrl } from '../shared/app-config.js';
const YOUTUBE_SCRIPT = 'https://www.youtube.com https://s.ytimg.com';
const YOUTUBE_FRAME = 'https://www.youtube.com https://www.youtube-nocookie.com';
const CLIMA = 'https://api.open-meteo.com';
export function crearCsp(desarrollo: boolean): string {
  const contenido = desarrollo ? ` ${APP_CONFIG.protocol.origin}` : '';
  const script = desarrollo
    ? `'self' 'unsafe-inline' ${YOUTUBE_SCRIPT}`
    : `'self' ${YOUTUBE_SCRIPT}`;
  const connect = desarrollo
    ? `'self' ${APP_CONFIG.protocol.origin} ${devServerWebSocketUrl} ${CLIMA}`
    : `'self' ${CLIMA}`;
  return [
    "default-src 'self'",
    `script-src ${script}`,
    `frame-src ${YOUTUBE_FRAME}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data:${contenido}`,
    "font-src 'self' data:",
    `media-src 'self'${contenido}`,
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
