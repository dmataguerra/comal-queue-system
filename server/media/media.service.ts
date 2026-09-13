import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { basename, extname, relative, resolve, sep } from 'node:path';
import type { Playlist } from '../models/state.js';

const genres = [{ id: 'lo-fi', name: 'Lo-Fi' }, { id: 'jazz', name: 'Jazz' }, { id: 'rock', name: 'Rock' }];
const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);

@Injectable()
export class MediaService {
  private readonly root: string;
  private catalog: Playlist[] = [];
  private files = new Map<string, string>();

  constructor(@Optional() @Inject('MUSIC_PATH') root = process.env.MUSIC_PATH ?? resolve('data/music')) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
    for (const genre of genres) mkdirSync(resolve(this.root, genre.id), { recursive: true });
    this.refresh();
  }

  refresh(): Playlist[] {
    const discovered = readdirSync(this.root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-z0-9_-]{1,64}$/.test(entry.name));
    this.files.clear();
    const definitions = [...genres, ...discovered.filter((entry) => !genres.some((genre) => genre.id === entry.name) && readdirSync(resolve(this.root, entry.name), { withFileTypes: true }).some((file) => file.isFile() && audioExtensions.has(extname(file.name).toLowerCase()))).map((entry) => ({ id: entry.name, name: entry.name.replace(/[-_]/g, ' ').replace(/^./, (letter) => letter.toUpperCase()) }))];
    const canonicalRoot = realpathSync(this.root);
    this.catalog = definitions.map(({ id, name }) => {
      const folder = resolve(this.root, id);
      const tracks = existsSync(folder) ? readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && audioExtensions.has(extname(entry.name).toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'es')).flatMap((entry) => {
        const absolutePath = realpathSync(resolve(folder, entry.name));
        const rel = relative(canonicalRoot, absolutePath);
        if (rel.startsWith(`..${sep}`) || rel === '..' || resolve(canonicalRoot, rel) !== absolutePath) return [];
        this.files.set(`${id}/${entry.name}`, absolutePath);
        return [{ id: `${id}/${entry.name}`, title: basename(entry.name, extname(entry.name)).replace(/[_-]/g, ' '), url: `/media/${encodeURIComponent(id)}/${encodeURIComponent(entry.name)}` }];
      }) : [];
      return { id, name, cover: '/assets/reference-admin.png', tracks };
    });
    return this.list();
  }

  list(): Playlist[] { return structuredClone(this.catalog); }

  file(genre: string, filename: string): string {
    const path = this.files.get(`${genre}/${filename}`);
    if (!path || !existsSync(path)) throw new NotFoundException('No se encontró el archivo de música local.');
    return path;
  }
}
