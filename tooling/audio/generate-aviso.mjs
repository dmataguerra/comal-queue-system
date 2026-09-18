import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// El «tin-tin» previo a cada anuncio (RF-03). Síntesis determinista: dos campanas descendentes,
// sin muestras ni descargas. Mismo formato que las voces: PCM 16 bits, 22 050 Hz, mono.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sampleRate = 22050;
const tau = 2 * Math.PI;
const duration = 1.4;
const samples = new Float64Array(Math.ceil(duration * sampleRate));

function bell(start, frequency, gain) {
  // Parciales inarmónicos de campana con caída exponencial y ataque de 4 ms.
  const partials = [[1, 1, 1.9], [2.76, 0.32, 3.4], [5.4, 0.12, 5.2], [0.5, 0.18, 2.6]];
  const first = Math.round(start * sampleRate);
  for (let i = first; i < samples.length; i++) {
    const t = (i - first) / sampleRate;
    const attack = Math.min(1, t / 0.004);
    let value = 0;
    for (const [ratio, amplitude, decay] of partials) value += amplitude * Math.exp(-decay * t) * Math.sin(tau * frequency * ratio * t);
    samples[i] += gain * attack * value;
  }
}

bell(0, 1318.51, 0.42); // mi6
bell(0.36, 1046.5, 0.42); // do6

let peak = 0;
for (const value of samples) peak = Math.max(peak, Math.abs(value));
const fadeOut = Math.round(0.08 * sampleRate);
const pcm = Buffer.alloc(44 + samples.length * 2);
pcm.write('RIFF', 0, 'ascii');
pcm.writeUInt32LE(pcm.length - 8, 4);
pcm.write('WAVEfmt ', 8, 'ascii');
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(sampleRate, 24);
pcm.writeUInt32LE(sampleRate * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36, 'ascii');
pcm.writeUInt32LE(samples.length * 2, 40);
samples.forEach((value, i) => {
  const tail = Math.min(1, (samples.length - i) / fadeOut);
  pcm.writeInt16LE(Math.round((value / peak) * 0.89 * tail * 32767), 44 + i * 2);
});

const target = resolve(root, 'contenido/aviso.wav');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, pcm);
console.log(`Generado ${target} (${duration}s). Verifica con: node tooling/audio/verify-audio.mjs`);
