import type { Action, ContentCategory, AudioDelivery } from '../shared/contract.js';
export function validateAudioAck(
  value: unknown,
): [number, number, Exclude<AudioDelivery['estado'], 'pendiente'>] {
  if (!Array.isArray(value) || value.length !== 3) throw new Error('Acuse de audio inválido.');
  const [id, n, state] = value as unknown[];
  if (
    !Number.isSafeInteger(id) ||
    (id as number) < 1 ||
    !Number.isInteger(n) ||
    (n as number) < 0 ||
    (n as number) > 99 ||
    (state !== 'reproduciendo' &&
      state !== 'reproducido' &&
      state !== 'fallo' &&
      state !== 'descartado')
  )
    throw new Error('Acuse de audio inválido.');
  return [id as number, n as number, state];
}
import { isYouTube } from '../core/youtube.js';
type View = 'operador' | 'publica';
interface Sender {
  getURL(): string;
  mainFrame: {
    url: string;
  };
}
interface IpcEvent {
  sender: Sender;
  senderFrame: {
    url: string;
  } | null;
}
export function authorizeIpc<T extends Sender>(
  event: IpcEvent & {
    sender: T;
  },
  view: View | 'cualquiera',
  isOperator: (sender: T) => boolean,
  isPublic: (sender: T) => boolean,
  viewUrl: (view: View) => string,
): View {
  const sender = event.sender;
  const source = isOperator(sender) ? 'operador' : isPublic(sender) ? 'publica' : null;
  if (!source || (view !== 'cualquiera' && source !== view))
    throw new Error('Vista no autorizada.');
  const main = sender.mainFrame;
  if (!main || event.senderFrame !== main) throw new Error('Marco no autorizado.');
  const expected = viewUrl(source);
  if (sender.getURL() !== expected || main.url !== expected)
    throw new Error('Página no autorizada.');
  return source;
}
export function validateNoArguments(ipcArgs: unknown[]): void {
  if (ipcArgs.length !== 0) throw new Error('Argumentos no válidos.');
}
export function validateCount(ipcArgs: unknown[], count: number): void {
  if (ipcArgs.length !== count) throw new Error('Argumentos no válidos.');
}
export function validateAction(action: unknown): Action {
  if (!action || typeof action !== 'object' || Array.isArray(action))
    throw new Error('Acción no válida.');
  const value = action as Record<string, unknown>;
  if (value.tipo === 'DESHACER') return { tipo: 'DESHACER' };
  if (value.tipo === 'LLAMAR' && typeof value.entrada === 'string' && value.entrada.length <= 32)
    return { tipo: 'LLAMAR', entrada: value.entrada };
  if (
    value.tipo === 'QUITAR' &&
    Number.isInteger(value.n) &&
    (value.n as number) >= 0 &&
    (value.n as number) <= 99
  )
    return { tipo: 'QUITAR', n: value.n as number };
  throw new Error('Acción no válida.');
}
export function validateYouTube(url: unknown): string | null {
  if (url === null || isYouTube(url)) return url;
  throw new Error('Enlace de YouTube no válido.');
}
export function validateCategory(category: unknown): ContentCategory {
  if (category === 'videos' || category === 'banner') return category;
  throw new Error('Categoría multimedia no válida.');
}
export function validateOptionalCategory(category: unknown): ContentCategory | undefined {
  return category === undefined ? undefined : validateCategory(category);
}
export function validateContentUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1000)
    throw new Error('Archivo multimedia no válido.');
  try {
    const url = new URL(value);
    if (url.protocol !== 'turnero:' || url.host !== 'app' || url.search || url.hash)
      throw new Error('URL no permitida.');
    const parts = url.pathname.split('/');
    if (parts.length !== 4 || parts[1] !== 'contenido' || !['videos', 'banner'].includes(parts[2]))
      throw new Error('Categoría no permitida.');
    const name = decodeURIComponent(parts[3]);
    if (
      !name ||
      name === '.' ||
      name === '..' ||
      [...name].some((char) => char === '/' || char === '\\' || char.charCodeAt(0) < 32)
    )
      throw new Error('Nombre no permitido.');
    return value;
  } catch {
    throw new Error('Archivo multimedia no válido.');
  }
}
export function validateVolume(volume: unknown, ramp: unknown): [number, number] {
  if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 1)
    throw new Error('Volumen no válido.');
  if (typeof ramp !== 'number' || !Number.isFinite(ramp) || ramp < 0 || ramp > 2000)
    throw new Error('Rampa no válida.');
  return [volume, ramp];
}
export function validateLevel(level: unknown): 'info' | 'warn' | 'error' {
  if (level === undefined) return 'warn';
  if (level === 'info' || level === 'warn' || level === 'error') return level;
  throw new Error('Nivel de registro no válido.');
}
export function validateMessage(message: unknown): string {
  if (typeof message !== 'string' || message.length > 500)
    throw new Error('Mensaje de registro no válido.');
  return message;
}
export function validateHealth(
  type: unknown,
  state: unknown,
): ['audio' | 'youtube', 'correcto' | 'degradado'] {
  if (type !== 'audio' && type !== 'youtube') throw new Error('Tipo de salud no válido.');
  if (state !== 'correcto' && state !== 'degradado') throw new Error('Estado de salud no válido.');
  return [type, state];
}
export function validateVolumes(voice: unknown, media: unknown): [number, number] {
  if (
    typeof voice !== 'number' ||
    !Number.isFinite(voice) ||
    voice < 0 ||
    voice > 3 ||
    typeof media !== 'number' ||
    !Number.isFinite(media) ||
    media < 0 ||
    media > 1
  )
    throw new Error('Volumen inválido.');
  return [voice, media];
}
