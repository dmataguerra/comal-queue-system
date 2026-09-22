import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// Catálogo de anuncios con ElevenLabs. Igual que Piper y Azure, esto corre SOLO en tiempo de
// compilación: se generan los WAV una vez, se versionan, y la aplicación instalada sigue sin
// internet ni dependencias (RNF-01). Ni la clave ni este script se distribuyen.
//
//   $env:ELEVENLABS_API_KEY = '...'
//   node tooling/audio/generate-elevenlabs.mjs --voces                  voces de la cuenta y su id
//   node tooling/audio/generate-elevenlabs.mjs --voice <id> --muestra   6 clips a .tmp-audio/cmp/H-elevenlabs
//   node tooling/audio/generate-elevenlabs.mjs --voice <id>             los 100 a contenido/voz
//
// Opciones: --voice, --model, --speed, --stability, --target-rms, --sin-normalizar, --output-dir.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const api = 'https://api.elevenlabs.io/v1';
const sampleRate = 22050;
// PCM crudo de 16 bits, mono, sin cabecera: el formato del catálogo actual. Entra en todos los planes.
const outputFormat = 'pcm_22050';
const sampleTurns = [3, 14, 27, 42, 68, 99];

const flags = new Set(['muestra', 'sin-normalizar', 'voces']);
const options = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const argument = process.argv[i];
  if (!argument.startsWith('--')) throw new Error(`Argumento inesperado: ${argument}`);
  const separator = argument.indexOf('=');
  const name = separator === -1 ? argument.slice(2) : argument.slice(2, separator);
  if (flags.has(name)) { options.set(name, true); continue; }
  const value = separator === -1 ? process.argv[++i] : argument.slice(separator + 1);
  if (value === undefined) throw new Error(`Falta el valor de --${name}`);
  options.set(name, value);
}

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('Falta ELEVENLABS_API_KEY. Ponla en el entorno; no la escribas en un archivo del repositorio.');

async function explain(response) {
  const detail = (await response.text().catch(() => '')).slice(0, 300);
  if (response.status === 401 || response.status === 402 || response.status === 403) {
    return `ElevenLabs respondió ${response.status}. Si dice quota_exceeded, recarga saldo; si la voz no está `
      + `disponible para tu plan, elige otra de --voces (las «premade» sirven en todos). ${detail}`;
  }
  return `ElevenLabs respondió ${response.status}: ${detail}`;
}

if (options.get('voces')) {
  const response = await fetch(`${api}/voices`, { headers: { 'xi-api-key': key } });
  if (!response.ok) throw new Error(await explain(response));
  const { voices } = await response.json();
  for (const voice of voices) {
    const labels = Object.values(voice.labels ?? {}).join(', ');
    console.log(`${voice.voice_id}  ${voice.name}  [${voice.category}]  ${labels}`);
  }
  process.exit(0);
}

const voice = options.get('voice');
if (!voice) throw new Error('Falta --voice <id>. Saca el id con --voces o de la Voice Library.');
// Multilingual v2 es el más estable para frases cortas; eleven_flash_v2_5 cuesta la mitad.
const model = options.get('model') ?? 'eleven_multilingual_v2';
// Un pelo más lenta que la lectura de corrido: son dos palabras sueltas en una sala con ruido.
const speed = Number(options.get('speed') ?? 0.95);
// Más estabilidad que la de fábrica (0,5): menos expresiva, pero los 100 clips suenan a una sola toma.
const stability = Number(options.get('stability') ?? 0.6);
// RMS medio del catálogo de Piper: conserva el ajuste de volumenVoz y la mezcla con el aviso.
const targetRms = Number(options.get('target-rms') ?? 0.107);
const sample = Boolean(options.get('muestra'));
const outputDir = resolve(root, options.get('output-dir') ?? (sample ? '.tmp-audio/cmp/H-elevenlabs' : 'contenido/voz'));

function spanishNumber(number) {
  const small = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  // «Turno cero» se oiría como un error; el catálogo lo dice en dos dígitos, igual que la pantalla.
  if (number === 0) return 'cero cero';
  if (number < 30) return small[number];
  const text = tens[Math.floor(number / 10)];
  return number % 10 ? `${text} y ${small[number % 10]}` : text;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Una petición de TTS. Reintenta el 429 (concurrencia) y los 5xx; lo demás falla de inmediato. */
async function synthesize(text, attempt = 1) {
  const response = await fetch(`${api}/text-to-speech/${encodeURIComponent(voice)}?output_format=${outputFormat}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: model,
      // Multilingual v2 deduce el idioma del texto y rechaza language_code; los demás lo aceptan.
      ...(model === 'eleven_multilingual_v2' ? {} : { language_code: 'es' }),
      // Semilla fija: volver a correr el script da (casi) el mismo audio.
      seed: 1234,
      voice_settings: { stability, similarity_boost: 0.75, speed },
    }),
  });
  if (response.ok) return Buffer.from(await response.arrayBuffer());
  if (attempt >= 5 || (response.status !== 429 && response.status < 500)) throw new Error(await explain(response));
  const pause = 2000 * 2 ** (attempt - 1);
  console.error(`  ${response.status}; reintento ${attempt + 1} en ${Math.round(pause / 1000)} s`);
  await wait(pause);
  return synthesize(text, attempt + 1);
}

/** Cabecera canónica de 44 bytes sobre el PCM crudo, más la ganancia aplicada. */
function buildWav(pcm, gain) {
  const data = Buffer.allocUnsafe(pcm.length - (pcm.length % 2));
  for (let offset = 0; offset + 2 <= data.length; offset += 2) {
    const value = Math.round(pcm.readInt16LE(offset) * gain);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, value)), offset);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);            // PCM
  header.writeUInt16LE(1, 22);            // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function measure(pcm) {
  let peak = 0;
  let sumSquares = 0;
  const count = Math.floor(pcm.length / 2);
  for (let i = 0; i < count; i++) {
    const value = pcm.readInt16LE(i * 2) / 32768;
    peak = Math.max(peak, Math.abs(value));
    sumSquares += value * value;
  }
  return { peak, rms: Math.sqrt(sumSquares / count) };
}

const turns = sample ? sampleTurns : Array.from({ length: 100 }, (_, turn) => turn);
const texts = turns.map((turn) => `Turno ${spanishNumber(turn)}.`);
const characters = texts.reduce((total, text) => total + text.length, 0);
console.error(`${voice} · ${model} · ${turns.length} clips (${characters} caracteres) → ${outputDir}`);

const clips = [];
for (const [index, turn] of turns.entries()) {
  const pcm = await synthesize(texts[index]);
  if (pcm.length < 2) throw new Error(`ElevenLabs devolvió audio vacío para «${texts[index]}».`);
  clips.push({ file: `${String(turn).padStart(2, '0')}.wav`, pcm, ...measure(pcm) });
  console.error(`  ${index + 1}/${turns.length}  ${texts[index]}`);
}

// Una sola ganancia para todo el catálogo: igualar clip por clip ataría el volumen de cada frase
// a su fonema más fuerte, que es justo lo que se evitó al desactivar el normalizador de Piper.
let gain = 1;
const meanRms = clips.reduce((total, clip) => total + clip.rms, 0) / clips.length;
if (!options.get('sin-normalizar') && meanRms > 0) {
  const loudestPeak = Math.max(...clips.map((clip) => clip.peak));
  gain = Math.min(targetRms / meanRms, 0.97 / loudestPeak);
}

mkdirSync(outputDir, { recursive: true });
for (const clip of clips) writeFileSync(join(outputDir, clip.file), buildWav(clip.pcm, gain));

const after = clips.map((clip) => clip.rms * gain);
console.log(JSON.stringify({
  written: clips.length,
  voice,
  model,
  speed,
  characters,
  gain: Number(gain.toFixed(3)),
  rms: [Number(Math.min(...after).toFixed(4)), Number(Math.max(...after).toFixed(4))],
  outputDir: outputDir.slice(root.length + 1).replaceAll('\\', '/'),
}, null, 2));
