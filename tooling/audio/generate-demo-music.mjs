import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Original, deterministic instrumental sketches. No samples or external media.
// They are deliberately short demonstration loops, not commercial playlists.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sampleRate = 22050;
const tau = 2 * Math.PI;
let randomState = 137;
const random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

function createTrack({ genre, name, bpm, chords, melody, seed }) {
  randomState = seed;
  const beat = 60 / bpm;
  const bars = 8;
  const duration = bars * 4 * beat;
  const samples = new Float64Array(Math.ceil((duration + 0.5) * sampleRate));

  function add(start, length, synth, gain = 1) {
    const startIndex = Math.round(start * sampleRate);
    const size = Math.min(Math.ceil(length * sampleRate), samples.length - startIndex);
    for (let i = 0; i < size; i++) samples[startIndex + i] += gain * synth(i / sampleRate, i / Math.max(1, size - 1));
  }

  function piano(midi, start, length, gain = 0.11) {
    const f = frequency(midi);
    add(start, length, (t, progress) => {
      const attack = Math.min(1, t / 0.012);
      const tail = Math.min(1, (1 - progress) / 0.12);
      const fundamental = Math.sin(tau * f * t) * Math.exp(-t * 2.3);
      const overtones = 0.4 * Math.sin(tau * f * 2.002 * t) * Math.exp(-t * 4)
        + 0.16 * Math.sin(tau * f * 3.005 * t) * Math.exp(-t * 6);
      return (fundamental + overtones) * attack * tail;
    }, gain);
  }

  function bass(midi, start, length) {
    const f = frequency(midi);
    add(start, length, (t, progress) => (Math.sin(tau * f * t) + 0.17 * Math.sin(tau * 2 * f * t))
      * Math.min(1, t / 0.02) * Math.exp(-t * 1.7) * Math.min(1, (1 - progress) / 0.15), 0.14);
  }

  function guitar(midi, start, length, gain = 0.065) {
    const f = frequency(midi);
    add(start, length, (t, progress) => {
      let tone = 0;
      for (let harmonic = 1; harmonic <= 6; harmonic++) {
        tone += Math.sin(tau * f * harmonic * t) / harmonic * Math.exp(-t * (2 + harmonic));
      }
      return Math.tanh(tone * 1.8) * Math.min(1, t / 0.006) * Math.min(1, (1 - progress) / 0.2);
    }, gain);
  }

  function drum(kind, start, gain) {
    if (kind === 'kick') {
      add(start, 0.32, t => Math.sin(tau * (48 * t + 5 * (1 - Math.exp(-t * 25)))) * Math.exp(-t * 15), gain);
    } else if (kind === 'snare') {
      add(start, 0.18, t => (random() * 0.7 + Math.sin(tau * 170 * t) * 0.3) * Math.exp(-t * 25), gain);
    } else {
      let lastNoise = 0;
      add(start, 0.085, t => {
        const noise = random();
        const filtered = noise - lastNoise * 0.9;
        lastNoise = noise;
        return filtered * Math.exp(-t * 65);
      }, gain);
    }
  }

  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length];
    const barStart = bar * beat * 4;
    if (genre === 'rock') {
      for (let eighth = 0; eighth < 8; eighth++) {
        const start = barStart + eighth * beat / 2;
        for (const interval of [0, 7, 12]) guitar(chord[0] - 12 + interval, start + interval * 0.001, beat * 0.65);
        if (eighth % 2 === 0) bass(chord[0] - 24, start, beat * 0.8);
      }
    } else {
      for (const offset of (genre === 'jazz' ? [0, 1.5, 3] : [0, 2.5])) {
        chord.forEach((midi, index) => piano(midi, barStart + offset * beat + index * 0.017, beat * 1.8, genre === 'jazz' ? 0.082 : 0.075));
      }
      for (let step = 0; step < 4; step++) {
        const midi = genre === 'jazz' ? chord[[0, 1, 2, 1][step]] - 24 : chord[step === 3 ? 2 : 0] - 24;
        bass(midi, barStart + step * beat, beat * 0.85);
      }
    }

    for (let step = 0; step < 4; step++) {
      const start = barStart + step * beat;
      if (step % 2 === 0) drum('kick', start, genre === 'rock' ? 0.2 : 0.13);
      else drum('snare', start + (genre === 'lo-fi' ? 0.025 : 0), genre === 'rock' ? 0.095 : 0.045);
      drum('hat', start, 0.026);
      drum('hat', start + beat * (genre === 'rock' ? 0.5 : 0.59), 0.021);
    }

    const phrase = melody[bar % melody.length];
    phrase.forEach((interval, step) => {
      if (interval === null) return;
      const start = barStart + step * beat / 2 + (step % 2 && genre !== 'rock' ? beat * 0.08 : 0);
      if (genre === 'rock') guitar(chord[0] + interval + 12, start, beat * 0.7, 0.075);
      else piano(chord[0] + interval + 12, start, beat * 1.3, 0.10);
    });
  }

  // Quiet tape-like bed for the lo-fi demos. Synthesized noise only.
  if (genre === 'lo-fi') for (let i = 0; i < samples.length; i++) samples[i] += random() * 0.0018;
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = Math.min(1, 0.78 / peak);
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    const fade = Math.min(1, time / 0.12, (samples.length / sampleRate - time) / 0.7);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * scale * fade)) * 32767), 44 + i * 2);
  }
  const folder = resolve(root, 'data/music', genre);
  mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, `${name}.wav`), wav);
  return { genre, file: `${name}.wav`, duration: Number((samples.length / sampleRate).toFixed(2)), original: true };
}

const tracks = [
  { genre: 'lo-fi', name: '01-tarde-de-cafe-demo', bpm: 78, seed: 10, chords: [[60, 63, 67, 70], [56, 60, 63, 67], [58, 62, 65, 69], [55, 58, 62, 65]], melody: [[7, null, 10, 12, null, 10, 7, null], [12, 10, null, 7, 3, null, 7, null]] },
  { genre: 'lo-fi', name: '02-ventana-azul-demo', bpm: 84, seed: 21, chords: [[62, 65, 69, 72], [58, 62, 65, 69], [60, 64, 67, 71], [57, 61, 64, 67]], melody: [[0, null, 7, 10, 7, null, 3, null], [7, 10, 12, null, 10, 7, null, 3]] },
  { genre: 'jazz', name: '01-mesa-junto-al-sol-demo', bpm: 108, seed: 30, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]], melody: [[7, 11, 12, null, 11, 7, 4, null], [12, null, 7, 4, null, 7, 10, 7]] },
  { genre: 'jazz', name: '02-sobremesa-demo', bpm: 116, seed: 48, chords: [[65, 69, 72, 76], [62, 65, 69, 72], [67, 70, 74, 77], [60, 64, 67, 70]], melody: [[4, 7, null, 11, 12, 11, 7, null], [0, null, 3, 7, 10, 7, null, 3]] },
  { genre: 'rock', name: '01-entrada-a-clases-demo', bpm: 114, seed: 50, chords: [[64, 67, 71], [60, 64, 67], [67, 71, 74], [62, 66, 69]], melody: [[0, 0, 7, null, 12, 7, 3, null], [7, null, 5, 3, 0, null, 3, 5]] },
  { genre: 'rock', name: '02-la-ultima-taza-demo', bpm: 122, seed: 65, chords: [[57, 60, 64], [65, 69, 72], [60, 64, 67], [67, 71, 74]], melody: [[0, null, 7, 7, 12, null, 7, 3], [12, 10, 7, null, 5, 3, 0, null]] },
].map(createTrack);

writeFileSync(resolve(root, 'data/music/demo-manifest.json'), JSON.stringify({
  description: 'Six short original instrumental loops synthesized for the Comal++ prototype. Demo content; no external recordings or copyrighted downloads.',
  sampleRate,
  tracks,
}, null, 2) + '\n');
console.log(`Generated ${tracks.length} original instrumental demo WAVs.`);
