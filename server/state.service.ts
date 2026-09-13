import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LocalDatabase } from './database.js';
import { MediaService } from './media/media.service.js';
import type { Announcement, AppState, Multimedia, Settings, Turn } from './models/state.js';
import { announceTurnInput, createTurnInput, multimediaInput, settingsInput, updateTurnInput, validateYoutubeUrl } from './dto/validation.js';

const defaultMultimedia: Multimedia = { type: 'fallback', url: null, playlistId: null, playing: false, volume: 65, muted: false };
const defaultSettings: Settings = { announcementSeconds: 8, autoRotate: true, footerMessages: ['Presenta tu ticket al recoger tu pedido.', 'El café también nos une.', 'Gracias por ser parte de Comal++.'] };
const turnColumns = 'id, number, counter, status, created_at AS createdAt, ready_at AS readyAt, last_announced_at AS lastAnnouncedAt, rank';
interface TurnMutation { turn: Turn; announcement: Announcement; replayed: boolean }
interface StoredRequest { kind: string; fingerprint: string; response: string }

@Injectable()
export class StateService {
  constructor(@Inject(LocalDatabase) private readonly db: LocalDatabase, @Inject(MediaService) private readonly media: MediaService) {}

  snapshot(): AppState {
    return {
      turns: this.db.connection.prepare(`SELECT ${turnColumns} FROM turns WHERE status = 'ready' ORDER BY rank DESC`).all() as unknown as Turn[],
      multimedia: this.db.readConfiguration('multimedia', defaultMultimedia),
      playlists: this.media.list(),
      settings: this.db.readConfiguration('settings', defaultSettings),
    };
  }

  history(): Turn[] {
    return this.db.connection.prepare(`SELECT ${turnColumns} FROM turns ORDER BY rank DESC LIMIT 200`).all() as unknown as Turn[];
  }

  private getTurn(id: string): Turn {
    const turn = this.db.connection.prepare(`SELECT ${turnColumns} FROM turns WHERE id = ?`).get(id) as unknown as Turn | undefined;
    if (!turn) throw new NotFoundException('No se encontró el turno.');
    return turn;
  }

  private nextRank(): number {
    return Number((this.db.connection.prepare('SELECT COALESCE(MAX(rank), 0) + 1 AS rank FROM turns').get() as { rank: number }).rank);
  }

  private replay(requestId: string, kind: string, fingerprint: string): TurnMutation | null {
    const existing = this.db.connection.prepare('SELECT kind, fingerprint, response FROM requests WHERE id = ?').get(requestId) as StoredRequest | undefined;
    if (!existing) return null;
    if (existing.kind !== kind || existing.fingerprint !== fingerprint) throw new ConflictException('Este identificador ya se utilizó para otra solicitud.');
    return { ...JSON.parse(existing.response), replayed: true } as TurnMutation;
  }

  private record(requestId: string, kind: string, fingerprint: string, result: TurnMutation): TurnMutation {
    this.db.connection.prepare('INSERT INTO requests(id, kind, fingerprint, response, created_at) VALUES (?, ?, ?, ?, ?)').run(requestId, kind, fingerprint, JSON.stringify(result), result.announcement.createdAt);
    return result;
  }

  create(input: unknown): TurnMutation {
    const { number, counter, requestId } = createTurnInput(input);
    const fingerprint = JSON.stringify({ number, counter });
    return this.db.transaction(() => {
      const repeated = this.replay(requestId, 'create', fingerprint);
      if (repeated) return repeated;
      if (this.db.connection.prepare("SELECT id FROM turns WHERE number = ? AND status = 'ready'").get(number)) {
        throw new ConflictException(`El turno ${number} ya está en la lista de turnos listos.`);
      }
      const now = new Date().toISOString();
      const id = randomUUID();
      this.db.connection.prepare('INSERT INTO turns(id, number, counter, status, created_at, ready_at, last_announced_at, rank) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, number, counter, 'ready', now, now, now, this.nextRank());
      const announcement: Announcement = { id: randomUUID(), turnId: id, number, counter, createdAt: now };
      return this.record(requestId, 'create', fingerprint, { turn: this.getTurn(id), announcement, replayed: false });
    });
  }

  announce(id: string, input: unknown): TurnMutation {
    const { requestId } = announceTurnInput(input);
    return this.db.transaction(() => {
      const repeated = this.replay(requestId, 'announce', id);
      if (repeated) return repeated;
      const turn = this.getTurn(id);
      if (turn.status !== 'ready') throw new ConflictException('Solo se pueden anunciar turnos que siguen listos para recoger.');
      const now = new Date().toISOString();
      this.db.connection.prepare('UPDATE turns SET rank = ?, last_announced_at = ? WHERE id = ?').run(this.nextRank(), now, id);
      const announcement: Announcement = { id: randomUUID(), turnId: id, number: turn.number, counter: turn.counter, createdAt: now };
      return this.record(requestId, 'announce', id, { turn: this.getTurn(id), announcement, replayed: false });
    });
  }

  update(id: string, input: unknown): Turn {
    const value = updateTurnInput(input);
    return this.db.transaction(() => {
      const turn = this.getTurn(id);
      const status = value.status ?? turn.status;
      const counter = value.counter ?? turn.counter;
      if (turn.status !== 'ready' && (status !== turn.status || counter !== turn.counter)) {
        throw new ConflictException('El turno ya fue cerrado. Captura un nuevo registro para reutilizar su número.');
      }
      this.db.connection.prepare('UPDATE turns SET counter = ?, status = ? WHERE id = ?').run(counter, status, id);
      return this.getTurn(id);
    });
  }

  updateMultimedia(input: unknown): Multimedia {
    const value = multimediaInput(input);
    const config: Multimedia = { ...this.db.readConfiguration('multimedia', defaultMultimedia), ...value };
    if (config.type === 'youtube') {
      validateYoutubeUrl(config.url);
      config.playlistId = null;
    } else if (config.type === 'local') {
      const playlist = this.media.list().find((item) => item.id === config.playlistId);
      if (!playlist) throw new BadRequestException('Selecciona una playlist local disponible.');
      if (!playlist.tracks.length) throw new BadRequestException('Esta playlist todavía no contiene pistas locales.');
      config.url = null;
    } else {
      config.url = null;
      config.playlistId = null;
      config.playing = false;
    }
    this.db.writeConfiguration('multimedia', config);
    return config;
  }

  updateSettings(input: unknown): Settings {
    const config: Settings = { ...this.db.readConfiguration('settings', defaultSettings), ...settingsInput(input) };
    config.footerMessages = config.footerMessages.map((message) => message.trim());
    this.db.writeConfiguration('settings', config);
    return config;
  }
}
