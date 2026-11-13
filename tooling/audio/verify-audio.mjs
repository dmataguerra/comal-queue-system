import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function inspectWav(relative) {
  const file = resolve(root, relative);
  assert(existsSync(file) && statSync(file).size > 0, `Missing or empty audio: ${relative}`);
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
  assert(
    peak > 0.1 && rms > 0.015 && nonzero > sampleRate / 4,
    `Silent or corrupt audio: ${relative}`,
  );
  return { path: relative, duration, peak, rms, sampleRate, channels };
}
const voiceDir = resolve(root, 'contenido/voz');
const mp3s = readdirSync(voiceDir).filter((name) => /.mp3$/i.test(name));
assert.equal(mp3s.length, 0, `El catálogo es solo WAV; elimina los MP3: ${mp3s.join(', ')}`);
const rows = [];
function check(relative) {
  try {
    const info = inspectWav(relative);
    rows.push({ ...info, status: 'OK' });
    return info;
  } catch (error) {
    rows.push({ path: relative, status: error.message });
    return undefined;
  }
}
for (let turn = 0; turn <= 99; turn++) check(`contenido/voz/${String(turn).padStart(2, '0')}.wav`);
check('contenido/aviso.wav');
const table = [
  '# Inventario de audio',
  '',
  'Generado por `node tooling/audio/verify-audio.mjs --table`.',
  '',
  '| Archivo | Duración (s) | Frecuencia (Hz) | Pico | RMS | Estado |',
  '| --- | ---: | ---: | ---: | ---: | --- |',
  ...rows.map((r) =>
    r.duration === undefined
      ? `| ${r.path} | - | - | - | - | ${r.status} |`
      : `| ${r.path.replace('contenido/', '')} | ${r.duration.toFixed(2)} | ${r.sampleRate} | ${r.peak.toFixed(3)} | ${r.rms.toFixed(3)} | ${r.status} |`,
  ),
  '',
].join('\n');
if (process.argv.includes('--table')) {
  mkdirSync(resolve(root, 'docs/audio'), { recursive: true });
  writeFileSync(resolve(root, 'docs/audio/audio-inventory.md'), table);
  console.log(table);
}
const failed = rows.filter((r) => r.status !== 'OK');
for (const r of failed) console.error(`${r.path}: ${r.status}`);
console.log(
  JSON.stringify(
    { success: failed.length === 0, voices: rows.length - 1, failed: failed.length },
    null,
    2,
  ),
);
process.exit(failed.length ? 1 : 0);
