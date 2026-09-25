import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function inspectWav(relative) {
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

function inspectMp3(relative) {
  const mp3 = readFileSync(resolve(root, relative));
  assert(mp3.length > 4, `Empty or truncated MP3: ${relative}`);
  let offset = 0;
  if (mp3.toString('ascii', 0, 3) === 'ID3') {
    assert(mp3.length >= 10, `Truncated ID3: ${relative}`);
    offset = 10 + ((mp3[6] & 0x7f) << 21) + ((mp3[7] & 0x7f) << 14) +
      ((mp3[8] & 0x7f) << 7) + (mp3[9] & 0x7f);
  }
  assert(offset + 4 < mp3.length, `Missing MP3 frames: ${relative}`);
  assert(mp3[offset] === 0xff && (mp3[offset + 1] & 0xe0) === 0xe0,
    `Invalid MP3 frame: ${relative}`);
  return { path: relative };
}

// Check every shipped audio file, including fallbacks, then check the same MP3-first
// selection used by inventariar(). Chromium decodes the selected files in test:desktop.
const voiceDir = resolve(root, 'contenido/voz');
for (const name of readdirSync(voiceDir)) {
  if (!/\.mp3$|\.wav$/i.test(name)) continue;
  const relative = `contenido/voz/${name}`;
  assert(statSync(resolve(voiceDir, name)).size > 0, `Empty audio: ${relative}`);
  if (/\.wav$/i.test(name)) inspectWav(relative);
  else inspectMp3(relative);
}
const announcements = [];
for (let turn = 0; turn <= 99; turn++) {
  const stem = `contenido/voz/${String(turn).padStart(2, '0')}`;
  const relative = ['.mp3', '.wav'].map(ext => `${stem}${ext}`)
    .find(file => existsSync(resolve(root, file)) && statSync(resolve(root, file)).size > 0);
  assert(relative, `Missing voice: ${stem} (MP3 or WAV)`);
  announcements.push(relative.endsWith('.wav') ? inspectWav(relative) : inspectMp3(relative));
}
for (const ext of ['.mp3', '.wav']) {
  const file = resolve(root, `contenido/aviso${ext}`);
  if (existsSync(file)) assert(statSync(file).size > 0, `Empty audio: contenido/aviso${ext}`);
}
const chimePath = ['contenido/aviso.mp3', 'contenido/aviso.wav']
  .find(file => existsSync(resolve(root, file)) && statSync(resolve(root, file)).size > 0);
assert(chimePath, 'Missing audio: contenido/aviso.mp3 or aviso.wav');
const chime = chimePath.endsWith('.wav') ? inspectWav(chimePath) : inspectMp3(chimePath);
console.log(JSON.stringify({
  success: true,
  voices: announcements.length,
  selectedMp3: announcements.filter(item => item.path.endsWith('.mp3')).length,
  selectedWav: announcements.filter(item => item.path.endsWith('.wav')).length,
  chime: chime.path,
}, null, 2));
