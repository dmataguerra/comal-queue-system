var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { basename, extname, relative, resolve, sep } from 'node:path';
const genres = [{ id: 'lofi', name: 'Lo-Fi' }, { id: 'jazz', name: 'Jazz' }, { id: 'rock', name: 'Rock' }];
const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
let MediaService = class MediaService {
    root;
    catalog = [];
    files = new Map();
    constructor(root = process.env.MUSIC_PATH ?? resolve('data/music')) {
        this.root = resolve(root);
        mkdirSync(this.root, { recursive: true });
        for (const genre of genres)
            mkdirSync(resolve(this.root, genre.id), { recursive: true });
        this.refresh();
    }
    refresh() {
        const discovered = readdirSync(this.root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-z0-9_-]{1,64}$/.test(entry.name));
        this.files.clear();
        const definitions = [...genres, ...discovered.filter((entry) => !genres.some((genre) => genre.id === entry.name)).map((entry) => ({ id: entry.name, name: entry.name.replace(/[-_]/g, ' ').replace(/^./, (letter) => letter.toUpperCase()) }))];
        const canonicalRoot = realpathSync(this.root);
        this.catalog = definitions.map(({ id, name }) => {
            const folder = resolve(this.root, id);
            const tracks = existsSync(folder) ? readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && audioExtensions.has(extname(entry.name).toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'es')).flatMap((entry) => {
                const absolutePath = realpathSync(resolve(folder, entry.name));
                const rel = relative(canonicalRoot, absolutePath);
                if (rel.startsWith(`..${sep}`) || rel === '..' || resolve(canonicalRoot, rel) !== absolutePath)
                    return [];
                this.files.set(`${id}/${entry.name}`, absolutePath);
                return [{ id: `${id}/${entry.name}`, title: basename(entry.name, extname(entry.name)).replace(/[_-]/g, ' '), url: `/media/${encodeURIComponent(id)}/${encodeURIComponent(entry.name)}` }];
            }) : [];
            return { id, name, cover: '/assets/reference-admin.png', tracks };
        });
        return this.list();
    }
    list() { return structuredClone(this.catalog); }
    file(genre, filename) {
        const path = this.files.get(`${genre}/${filename}`);
        if (!path || !existsSync(path))
            throw new NotFoundException('No se encontró el archivo de música local.');
        return path;
    }
};
MediaService = __decorate([
    Injectable(),
    __param(0, Optional()),
    __param(0, Inject('MUSIC_PATH')),
    __metadata("design:paramtypes", [Object])
], MediaService);
export { MediaService };
