import { BadRequestException } from '@nestjs/common';
import type { Counter, Multimedia, Settings, TurnStatus } from '../models/state.js';

export function objectInput(input: unknown, allowed: string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('El cuerpo de la solicitud debe ser un objeto.');
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new BadRequestException('La solicitud contiene campos desconocidos.');
  }
  return value;
}

export function counterInput(value: unknown): Counter {
  if (value !== 0 && value !== 1 && value !== 2) {
    throw new BadRequestException('El mostrador debe ser 0, 1 o 2.');
  }
  return value;
}

function requestIdInput(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._:-]{8,100}$/.test(value)) {
    throw new BadRequestException('Se requiere un identificador válido de la solicitud.');
  }
  return value;
}

export interface CreateTurnInput { number: string; counter: Counter; requestId: string }

export function createTurnInput(input: unknown): CreateTurnInput {
  const value = objectInput(input, ['number', 'counter', 'requestId']);
  if (typeof value.number !== 'string' || !/^(0[1-9]|[1-9][0-9])$/.test(value.number)) {
    throw new BadRequestException('Introduce un número de turno del 01 al 99.');
  }
  return {
    number: value.number,
    counter: value.counter === undefined ? 0 : counterInput(value.counter),
    requestId: requestIdInput(value.requestId),
  };
}

export function announceTurnInput(input: unknown): { requestId: string } {
  const value = objectInput(input, ['requestId']);
  return { requestId: requestIdInput(value.requestId) };
}

export interface UpdateTurnInput { counter?: Counter; status?: TurnStatus }

export function updateTurnInput(input: unknown): UpdateTurnInput {
  const value = objectInput(input, ['counter', 'status']);
  if (!Object.keys(value).length) throw new BadRequestException('Indica el cambio que deseas realizar.');
  const result: UpdateTurnInput = {};
  if ('counter' in value) result.counter = counterInput(value.counter);
  if ('status' in value) {
    if (value.status !== 'ready' && value.status !== 'delivered' && value.status !== 'cancelled') {
      throw new BadRequestException('El estado del turno no es válido.');
    }
    result.status = value.status;
  }
  return result;
}

export function multimediaInput(input: unknown): Partial<Multimedia> {
  const value = objectInput(input, ['type', 'url', 'playlistId', 'playing', 'volume', 'muted']);
  if (!Object.keys(value).length) throw new BadRequestException('Indica la configuración multimedia.');
  if ('type' in value && !['fallback', 'youtube', 'local'].includes(value.type as string)) {
    throw new BadRequestException('El tipo multimedia no es válido.');
  }
  for (const field of ['playing', 'muted']) {
    if (field in value && typeof value[field] !== 'boolean') {
      throw new BadRequestException(`El campo ${field} debe ser verdadero o falso.`);
    }
  }
  if ('volume' in value && (typeof value.volume !== 'number' || !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 100)) {
    throw new BadRequestException('El volumen debe estar entre 0 y 100.');
  }
  if ('url' in value && value.url !== null && (typeof value.url !== 'string' || value.url.length > 2048)) {
    throw new BadRequestException('La URL multimedia no es válida.');
  }
  if ('playlistId' in value && value.playlistId !== null && (typeof value.playlistId !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(value.playlistId))) {
    throw new BadRequestException('La playlist no es válida.');
  }
  return value as Partial<Multimedia>;
}

/** Validate the provider locally: configuring YouTube never blocks on an internet request. */
export function validateYoutubeUrl(raw: string | null): void {
  let url: URL;
  try { url = new URL(raw ?? ''); } catch { throw new BadRequestException('Introduce una URL de video o playlist de YouTube.'); }
  const hosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port) {
    throw new BadRequestException('Solo se permiten enlaces HTTPS de YouTube.');
  }
  const playlist = url.searchParams.get('list');
  const shortHost = url.hostname.endsWith('youtu.be');
  const video = shortHost ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
  if ((!video || !/^[a-zA-Z0-9_-]{11}$/.test(video)) && (!playlist || !/^[a-zA-Z0-9_-]{10,100}$/.test(playlist))) {
    throw new BadRequestException('La URL debe identificar un video o una playlist de YouTube.');
  }
}

export function settingsInput(input: unknown): Partial<Settings> {
  const value = objectInput(input, ['announcementSeconds', 'autoRotate', 'footerMessages']);
  if (!Object.keys(value).length) throw new BadRequestException('Indica la configuración que deseas cambiar.');
  if ('autoRotate' in value && typeof value.autoRotate !== 'boolean') {
    throw new BadRequestException('La vista automática debe ser verdadera o falsa.');
  }
  if ('announcementSeconds' in value && (typeof value.announcementSeconds !== 'number' || !Number.isInteger(value.announcementSeconds) || value.announcementSeconds < 3 || value.announcementSeconds > 30)) {
    throw new BadRequestException('La duración del anuncio debe ser de 3 a 30 segundos.');
  }
  if ('footerMessages' in value && (!Array.isArray(value.footerMessages) || value.footerMessages.length < 1 || value.footerMessages.length > 10 || value.footerMessages.some((message) => typeof message !== 'string' || !message.trim() || message.length > 120))) {
    throw new BadRequestException('Agrega de 1 a 10 mensajes, de hasta 120 caracteres cada uno.');
  }
  return value as Partial<Settings>;
}
