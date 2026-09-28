const YOUTUBE_SCRIPT = 'https://www.youtube.com https://s.ytimg.com';
const YOUTUBE_FRAME = 'https://www.youtube.com https://www.youtube-nocookie.com';
const CLIMA = 'https://api.open-meteo.com';

/** Cabecera para las dos vistas locales; cada origen nuevo requiere una decisión explícita. */
export function crearCsp(desarrollo: boolean): string {
  const contenido = desarrollo ? ' turnero://app' : '';
  const script = desarrollo
    ? `'self' 'unsafe-inline' ${YOUTUBE_SCRIPT}`
    : `'self' ${YOUTUBE_SCRIPT}`;
  const connect = desarrollo
    ? `'self' turnero://app ws://127.0.0.1:5173 ${CLIMA}`
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
