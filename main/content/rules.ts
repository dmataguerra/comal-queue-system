import { existsSync, readdirSync } from 'node:fs';
import type { ContentCategory } from '../../shared/contract.js';
/** Content rules shared by import, inventory and seeding: formats, limits, MIME types, URLs. */
export const CONTENT_URL = 'turnero://app/contenido';
export const VIDEOS = new Set(['.mp4', '.webm']);
export const IMAGES = new Set(['.jpg', '.jpeg', '.png', '.webp']);
export const VOICE = /^(\d{2})\.wav$/i;
export const AUDIO_EXTENSIONS = ['.wav'] as const;
export const VIDEO_LIMIT = 2 * 1024 ** 3;
export const IMAGE_LIMIT = 25 * 1024 ** 2;
export const DISK_RESERVE = 512 * 1024 ** 2;
export const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
export function files(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((input) => input.isFile() && !input.name.startsWith('.'))
    .map((input) => input.name)
    .sort((a, b) => a.localeCompare(b, 'es'));
}
export const url = (base: string, folder: string, name: string) =>
  `${base}/${folder}/${encodeURIComponent(name)}`;
export const extensions = (category: ContentCategory) => (category === 'videos' ? VIDEOS : IMAGES);
