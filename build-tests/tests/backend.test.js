import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { io } from 'socket.io-client';
import { LocalDatabase } from '../server/database.js';
import { MediaService } from '../server/media/media.service.js';
import { StateService } from '../server/state.service.js';
import { createApp } from '../server/bootstrap.js';
function fixture() {
    const folder = mkdtempSync(join(tmpdir(), 'comal-backend-'));
    const path = join(folder, 'comal.sqlite');
    const music = join(folder, 'music');
    const db = new LocalDatabase(path);
    const media = new MediaService(music);
    return { folder, path, music, db, media, state: new StateService(db, media), close() { db.onModuleDestroy(); rmSync(folder, { recursive: true, force: true }); } };
}
test('ready lifecycle: order, duplicate rejection, exact retries, counter edits, closure and reuse', () => {
    const f = fixture();
    try {
        assert.deepEqual(f.state.snapshot().turns, []);
        const requestId = randomUUID();
        const first = f.state.create({ number: '01', requestId });
        assert.equal(first.turn.counter, 0);
        assert.equal(first.turn.status, 'ready');
        const retry = f.state.create({ number: '01', counter: 0, requestId });
        assert.equal(retry.replayed, true);
        assert.equal(retry.turn.id, first.turn.id);
        assert.equal(retry.announcement.id, first.announcement.id);
        assert.equal(f.state.snapshot().turns.length, 1);
        assert.throws(() => f.state.create({ number: '01', requestId: randomUUID() }), /ya está/);
        assert.throws(() => f.state.create({ number: '02', requestId }), /otra solicitud/);
        f.state.create({ number: '99', counter: 2, requestId: randomUUID() });
        assert.deepEqual(f.state.snapshot().turns.map((turn) => turn.number), ['99', '01']);
        const announceId = randomUUID();
        const recalled = f.state.announce(first.turn.id, { requestId: announceId });
        assert.deepEqual(f.state.snapshot().turns.map((turn) => turn.number), ['01', '99']);
        assert.notEqual(recalled.announcement.id, first.announcement.id);
        assert.equal(f.state.announce(first.turn.id, { requestId: announceId }).replayed, true);
        f.state.update(first.turn.id, { counter: 1 });
        assert.equal(f.state.snapshot().turns[0].counter, 1);
        f.state.update(first.turn.id, { status: 'delivered' });
        assert.deepEqual(f.state.snapshot().turns.map((turn) => turn.number), ['99']);
        assert.throws(() => f.state.announce(first.turn.id, { requestId: randomUUID() }), /siguen listos/);
        assert.throws(() => f.state.update(first.turn.id, { status: 'ready' }), /ya fue cerrado/);
        const reused = f.state.create({ number: '01', requestId: randomUUID() });
        assert.notEqual(reused.turn.id, first.turn.id);
        f.state.update(reused.turn.id, { status: 'cancelled' });
        assert.equal(f.state.history().find((turn) => turn.id === reused.turn.id)?.status, 'cancelled');
    }
    finally {
        f.close();
    }
});
test('malformed payloads and invalid provider inputs cannot mutate stored state', () => {
    const f = fixture();
    try {
        for (const number of ['00', '100', '1', '099', '', 99, null, '<x>']) {
            assert.throws(() => f.state.create({ number, requestId: randomUUID() }), /01 al 99/);
        }
        for (const counter of [-1, 3, '1', false, null]) {
            assert.throws(() => f.state.create({ number: '02', counter, requestId: randomUUID() }), /mostrador/);
        }
        assert.throws(() => f.state.create({ number: '02', requestId: randomUUID(), status: 'ready' }), /desconocidos/);
        assert.throws(() => f.state.create({ number: '02' }), /identificador/);
        assert.throws(() => f.state.create(null), /objeto/);
        assert.throws(() => f.state.updateMultimedia({ type: 'youtube', url: 'https://youtube.com.evil.example/watch?v=jfKfPfyJRdk' }), /YouTube/);
        assert.throws(() => f.state.updateMultimedia({ type: 'youtube', url: 'javascript:alert(1)' }), /YouTube/);
        assert.throws(() => f.state.updateMultimedia({ type: 'youtube', url: 'https://youtube.com/' }), /video o una playlist/);
        assert.throws(() => f.state.updateMultimedia({ type: 'local', playlistId: 'lofi' }), /no contiene pistas/);
        assert.throws(() => f.state.updateMultimedia({ volume: 101 }), /volumen/);
        assert.throws(() => f.state.updateMultimedia({ playing: 'true' }), /verdadero o falso/);
        assert.throws(() => f.state.updateSettings({ announcementSeconds: 2 }), /3 a 30/);
        assert.throws(() => f.state.updateSettings({ footerMessages: [''] }), /mensajes/);
        assert.equal(f.state.snapshot().turns.length, 0);
        assert.equal(f.state.snapshot().multimedia.type, 'fallback');
    }
    finally {
        f.close();
    }
});
test('SQLite persists turns, ordering, request deduplication, multimedia and settings after reopening', () => {
    const f = fixture();
    let reopened;
    try {
        const requestId = randomUUID();
        const one = f.state.create({ number: '09', counter: 2, requestId });
        const two = f.state.create({ number: '10', requestId: randomUUID() });
        f.state.announce(one.turn.id, { requestId: randomUUID() });
        f.state.updateMultimedia({ type: 'youtube', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', playing: true, volume: 42, muted: true });
        f.state.updateSettings({ announcementSeconds: 6, autoRotate: false, footerMessages: ['Mensaje local'] });
        const before = f.state.snapshot();
        f.db.onModuleDestroy();
        reopened = new LocalDatabase(f.path);
        const state = new StateService(reopened, f.media);
        assert.deepEqual(state.snapshot(), before);
        assert.deepEqual(state.snapshot().turns.map((turn) => turn.id), [one.turn.id, two.turn.id]);
        assert.equal(state.create({ number: '09', counter: 2, requestId }).replayed, true);
        const playlist = state.updateMultimedia({ type: 'youtube', url: 'https://www.youtube.com/playlist?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj' });
        assert.equal(playlist.type, 'youtube');
    }
    finally {
        reopened?.onModuleDestroy();
        f.close();
    }
});
test('local playlists expose existing audio only and reject unlisted media paths', () => {
    const f = fixture();
    try {
        writeFileSync(join(f.music, 'lofi', 'Café lento.wav'), 'test-fixture');
        writeFileSync(join(f.music, 'lofi', 'notes.txt'), 'not audio');
        mkdirSync(join(f.music, 'ambient'));
        writeFileSync(join(f.music, 'ambient', 'Calma.ogg'), 'test-fixture');
        const catalog = f.media.refresh();
        assert.equal(catalog.find((playlist) => playlist.id === 'lofi')?.tracks.length, 1);
        assert.equal(catalog.find((playlist) => playlist.id === 'ambient')?.name, 'Ambient');
        assert.match(catalog[0].tracks[0].url, /Caf%C3%A9%20lento.wav/);
        const config = f.state.updateMultimedia({ type: 'local', playlistId: 'lofi', playing: true });
        assert.equal(config.playlistId, 'lofi');
        assert.equal(config.url, null);
        assert.equal(f.media.file('lofi', 'Café lento.wav'), join(f.music, 'lofi', 'Café lento.wav'));
        assert.throws(() => f.media.file('lofi', 'notes.txt'), /No se encontró/);
        assert.throws(() => f.media.file('..', 'comal.sqlite'), /No se encontró/);
        f.state.updateMultimedia({ type: 'fallback' });
        assert.equal(f.state.snapshot().multimedia.playing, false);
        assert.equal(f.state.snapshot().multimedia.playlistId, null);
    }
    finally {
        f.close();
    }
});
function socketEvent(socket, event) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { socket.off(event, listener); reject(new Error(`Timeout esperando ${event}`)); }, 5000);
        const listener = (value) => { clearTimeout(timer); resolve(value); };
        socket.once(event, listener);
    });
}
test('real HTTP + WebSockets synchronize two screens once, reorder recalls, and reconnect without old audio', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'comal-http-'));
    const oldDb = process.env.DATABASE_PATH;
    const oldMusic = process.env.MUSIC_PATH;
    process.env.DATABASE_PATH = join(folder, 'comal.sqlite');
    process.env.MUSIC_PATH = join(folder, 'music');
    const app = await createApp();
    const sockets = [];
    try {
        await app.listen(0, '127.0.0.1');
        const base = await app.getUrl();
        const publicScreen = io(base, { autoConnect: false, transports: ['websocket'] });
        const cashier = io(base, { autoConnect: false, transports: ['websocket'] });
        sockets.push(publicScreen, cashier);
        const initialStates = [socketEvent(publicScreen, 'state'), socketEvent(cashier, 'state')];
        publicScreen.connect();
        cashier.connect();
        for (const state of await Promise.all(initialStates))
            assert.equal(state.turns.length, 0);
        const announcements = [];
        publicScreen.on('announcement', (announcement) => announcements.push(announcement));
        const requestId = randomUUID();
        const payload = { number: '99', counter: 1, requestId };
        const announcePromise = socketEvent(publicScreen, 'announcement');
        const statePromise = socketEvent(cashier, 'state');
        const response = await fetch(`${base}/api/turns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        assert.equal(response.status, 201);
        const turn = await response.json();
        assert.equal((await statePromise).turns[0].id, turn.id);
        assert.equal((await announcePromise).counter, 1);
        const retry = await fetch(`${base}/api/turns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        assert.equal(retry.status, 201);
        const duplicate = await fetch(`${base}/api/turns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestId: randomUUID() }) });
        assert.equal(duplicate.status, 409);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.equal(announcements.length, 1);
        const second = await fetch(`${base}/api/turns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: '08', requestId: randomUUID() }) });
        assert.equal(second.status, 201);
        const recallState = socketEvent(publicScreen, 'state');
        const recalled = await fetch(`${base}/api/turns/${turn.id}/announce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID() }) });
        assert.equal(recalled.status, 200);
        assert.equal((await recallState).turns[0].number, '99');
        const mediaState = socketEvent(publicScreen, 'state');
        const mediaResponse = await fetch(`${base}/api/multimedia`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'youtube', url: 'https://youtu.be/jfKfPfyJRdk', playing: true }) });
        assert.equal(mediaResponse.status, 200);
        assert.equal((await mediaState).multimedia.url, 'https://youtu.be/jfKfPfyJRdk');
        publicScreen.disconnect();
        const announcementCount = announcements.length;
        const restored = socketEvent(publicScreen, 'state');
        publicScreen.connect();
        assert.equal((await restored).turns.length, 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.equal(announcements.length, announcementCount);
        const closedState = socketEvent(publicScreen, 'state');
        const close = await fetch(`${base}/api/turns/${turn.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'delivered' }) });
        assert.equal(close.status, 200);
        assert.deepEqual((await closedState).turns.map((item) => item.number), ['08']);
        assert.equal((await fetch(`${base}/api/health`)).status, 200);
    }
    finally {
        sockets.forEach((socket) => socket.disconnect());
        await app.close();
        if (oldDb === undefined)
            delete process.env.DATABASE_PATH;
        else
            process.env.DATABASE_PATH = oldDb;
        if (oldMusic === undefined)
            delete process.env.MUSIC_PATH;
        else
            process.env.MUSIC_PATH = oldMusic;
        rmSync(folder, { recursive: true, force: true });
    }
});
