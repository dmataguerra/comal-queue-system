import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function inspect(relative) {
  const file = resolve(root, relative);
  assert(existsSync(file), `Missing audio: ${relative}`);
  const wav = readFileSync(file);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF', relative);
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE', relative);
  assert.equal(wav.readUInt32LE(4), wav.length - 8, `Incomplete RIFF: ${relative}`);
  let format;
  let data;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const tag = wav.toString('ascii', offset, offset + 4);
    const length = wav.readUInt32LE(offset + 4);
    assert(offset + 8 + length <= wav.length, `Incomplete chunk: ${relative}`);
    if (tag === 'fmt ') format = wav.subarray(offset + 8, offset + 8 + length);
    if (tag === 'data') data = wav.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length + (length % 2);
  }
  assert(format && data, `Missing format/data: ${relative}`);
  assert.equal(format.readUInt16LE(0), 1, `Expected PCM: ${relative}`);
  assert.equal(format.readUInt16LE(14), 16, `Expected 16-bit audio: ${relative}`);
  const channels = format.readUInt16LE(2);
  const sampleRate = format.readUInt32LE(4);
  const duration = data.length / (sampleRate * channels * 2);
  let peak = 0;
  let sumSquares = 0;
  let nonzero = 0;
  for (let offset = 0; offset < data.length; offset += 2) {
    const value = data.readInt16LE(offset) / 32768;
    peak = Math.max(peak, Math.abs(value));
    sumSquares += value * value;
    if (value) nonzero++;
  }
  const rms = Math.sqrt(sumSquares / (data.length / 2));
  assert(duration >= 0.5 && duration < 120, `Invalid duration: ${relative}`);
  assert(peak > 0.1 && rms > 0.015 && nonzero > sampleRate / 4, `Silent or corrupt audio: ${relative}`);
  return { path: relative, duration, peak, rms, sampleRate, channels };
}

const announcements = [];
for (let turn = 1; turn <= 99; turn++) announcements.push(inspect(`public/audio/turns/${String(turn).padStart(2, '0')}.wav`));
announcements.push(...['public/audio/counters/1.wav', 'public/audio/counters/2.wav', 'public/audio/ready.wav'].map(inspect));
const music = [];
for (const genre of ['lo-fi', 'jazz', 'rock']) {
  const files = readdirSync(resolve(root, 'data/music', genre)).filter(file => file.endsWith('.wav'));
  assert(files.length >= 2, `Expected at least two demo tracks: ${genre}`);
  for (const file of files) music.push(inspect(`data/music/${genre}/${file}`));
}
console.log(JSON.stringify({
  success: true,
  announcements: announcements.length,
  turns: 99,
  musicTracks: music.length,
  announcementSeconds: [Math.min(...announcements.map(item => item.duration)), Math.max(...announcements.map(item => item.duration))],
  musicSeconds: music.map(item => ({ path: item.path, seconds: Number(item.duration.toFixed(2)) })),
  format: 'PCM 16-bit, 22050 Hz, mono',
}, null, 2));
