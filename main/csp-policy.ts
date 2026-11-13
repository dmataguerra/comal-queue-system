import { APP_CONFIG, devServerWebSocketUrl } from '../shared/app-config.js';
const YOUTUBE_SCRIPT = 'https://www.youtube.com https://s.ytimg.com';
const YOUTUBE_FRAME = 'https://www.youtube.com https://www.youtube-nocookie.com';
const WEATHER = 'https://api.open-meteo.com';
export function createCsp(development: boolean): string {
  const content = development ? ` ${APP_CONFIG.protocol.origin}` : '';
  const script = development
    ? `'self' 'unsafe-inline' ${YOUTUBE_SCRIPT}`
    : `'self' ${YOUTUBE_SCRIPT}`;
  const connect = development
    ? `'self' ${APP_CONFIG.protocol.origin} ${devServerWebSocketUrl} ${WEATHER}`
    : `'self' ${WEATHER}`;
  return [
    "default-src 'self'",
    `script-src ${script}`,
    `frame-src ${YOUTUBE_FRAME}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data:${content}`,
    "font-src 'self' data:",
    `media-src 'self'${content}`,
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
