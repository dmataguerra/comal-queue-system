import { Inject, Injectable, Optional, type OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

@Injectable()
export class LocalDatabase implements OnModuleDestroy {
  readonly connection: DatabaseSync;
  private closed = false;

  constructor(@Optional() @Inject('DATABASE_PATH') path = process.env.DATABASE_PATH ?? resolve('data/comal.sqlite')) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.connection = new DatabaseSync(path);
    this.connection.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL CHECK(length(number) = 2 AND number GLOB '[0-9][0-9]' AND CAST(number AS INTEGER) BETWEEN 1 AND 99),
        counter INTEGER NOT NULL DEFAULT 0 CHECK(counter IN (0, 1, 2)),
        status TEXT NOT NULL CHECK(status IN ('ready', 'delivered', 'cancelled')),
        created_at TEXT NOT NULL,
        ready_at TEXT NOT NULL,
        last_announced_at TEXT NOT NULL,
        rank INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_number ON turns(number) WHERE status = 'ready';
      CREATE INDEX IF NOT EXISTS turn_display_order ON turns(status, rank DESC);
      CREATE TABLE IF NOT EXISTS configuration (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  transaction<T>(work: () => T): T {
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.connection.exec('COMMIT');
      return result;
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }

  readConfiguration<T>(key: string, fallback: T): T {
    const row = this.connection.prepare('SELECT value FROM configuration WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) as T : structuredClone(fallback);
  }

  writeConfiguration(key: string, value: unknown): void {
    this.connection.prepare('INSERT INTO configuration(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
  }

  onModuleDestroy(): void {
    if (!this.closed) { this.connection.close(); this.closed = true; }
  }
}
