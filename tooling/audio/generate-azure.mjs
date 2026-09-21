import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// Catálogo de anuncios con Azure Speech (voces neuronales es-MX). Igual que Piper, esto corre
// SOLO en tiempo de compilación: se generan los WAV una vez, se versionan, y la aplicación
// instalada sigue sin internet ni dependencias (RNF-01). Ni la clave ni este script se distribuyen.
//
//   $env:AZURE_SPEECH_KEY = '...'; $env:AZURE_SPEECH_REGION = 'eastus'
//   node tooling/audio/generate-azure.mjs --muestra     6 clips a .tmp-audio/cmp/G-azure
//   node tooling/audio/generate-azure.mjs               los 100 a contenido/voz
//
// Opciones: --voice, --rate, --delay, --target-rms, --sin-normalizar, --output-dir.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sampleRate = 22050;
// El endpoint v1 devuelve RIFF con este formato, que es exactamente el del catálogo actual.
const outputFormat = 'riff-22050hz-16bit-mono-pcm';
const sampleTurns = [3, 14, 27, 42, 68, 99];

const flags = new Set(['muestra', 'sin-normalizar']);
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

const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION ?? 'eastus';
// Se deduce de la región. AZURE_SPEECH_ENDPOINT solo hace falta con dominio propio o endpoint privado.
const endpoint = process.env.AZURE_SPEECH_ENDPOINT ?? `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
if (!key) throw new Error('Falta AZURE_SPEECH_KEY. Ponla en el entorno; no la escribas en un archivo del repositorio.');

const voice = options.get('voice') ?? 'es-MX-DaliaNeural';
// Un pelo más lenta que la lectura de corrido: son dos palabras sueltas en una sala con ruido.
const rate = options.get('rate') ?? '-5%';
// El plan gratuito F0 permite 20 peticiones por minuto; 3,1 s entre una y otra no lo roza.
// Con un recurso de pago (S0) se puede bajar a --delay 0 y los 100 clips salen en menos de un minuto.
const delay = Number(options.get('delay') ?? 3100);
// RMS medio del catálogo de Piper: conserva el ajuste de volumenVoz y la mezcla con el aviso.
const targetRms = Number(options.get('target-rms') ?? 0.107);
const sample = Boolean(options.get('muestra'));
const outputDir = resolve(root, options.get('output-dir') ?? (sample ? '.tmp-audio/cmp/G-azure' : 'contenido/voz'));

function spanishNumber(number) {
  const small = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  // «Turno cero» se oiría como un error; el catálogo lo dice en dos dígitos, igual que la pantalla.
  if (number === 0) return 'cero cero';
  if (number < 30) return small[number];
  const text = tens[Math.floor(number / 10)];
  return number % 10 ? `${text} y ${small[number % 10]}` : text;
}

const escapeXml = (text) => text.replace(/[<>&'"]/g, (character) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[character]};`);

const ssml = (text) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-MX">`
  + `<voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(text)}</prosody></voice></speak>`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Una petición al endpoint v1. Reintenta el 429 (cuota) y los 5xx; lo demás falla de inmediato. */
async function synthesize(text, attempt = 1) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': outputFormat,
      'User-Agent': 'turnero-comal',
    },
    body: ssml(text),
  });
  if (response.ok) return Buffer.from(await response.arrayBuffer());
  const detail = (await response.text().catch(() => '')).slice(0, 300);
  if (response.status === 401 || response.status === 403) throw new Error(`Azure rechazó la clave (${response.status}). Revisa AZURE_SPEECH_KEY y que AZURE_SPEECH_REGION sea la región del recurso. ${detail}`);
  if (response.status === 400) throw new Error(`SSML o voz inválidos (400). ¿Existe "${voice}" en ${region}? ${detail}`);
  if (attempt >= 5 || (response.status !== 429 && response.status < 500)) throw new Error(`Azure respondió ${response.status}: ${detail}`);
  const retryAfter = Number(response.headers.get('retry-after'));
  const pause = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** (attempt - 1);
  console.error(`  ${response.status}; reintento ${attempt + 1} en ${Math.round(pause / 1000)} s`);
  await wait(pause);
  return synthesize(text, attempt + 1);
}

/**
 * Extrae las muestras del RIFF de Azure. Hace falta leerlo chunk por chunk porque el endpoint
 * transmite: los tamaños de RIFF y data llegan como marcador y no corresponden al cuerpo real,
 * lo que rompería la comprobación de integridad de verify-audio.mjs si se guardara tal cual.
 */
function readPcm(wav) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`La respuesta no es WAV: ${wav.toString('utf8', 0, 200)}`);
  }
  for (let offset = 12; offset + 8 <= wav.length;) {
    const tag = wav.toString('ascii', offset, offset + 4);
    const declared = wav.readUInt32LE(offset + 4);
    const length = Math.min(declared, wav.length - offset - 8);
    if (tag === 'data') return wav.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length + (length % 2);
  }
  throw new Error('El WAV no trae chunk de datos.');
}

/** Cabecera canónica de 44 bytes con los tamaños reales, más la ganancia aplicada. */
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
console.error(`${voice} · ${region} · ${turns.length} clips → ${outputDir}`);

const clips = [];
for (const [index, turn] of turns.entries()) {
  const text = `Turno ${spanishNumber(turn)}.`;
  const pcm = readPcm(await synthesize(text));
  clips.push({ file: `${String(turn).padStart(2, '0')}.wav`, pcm, ...measure(pcm) });
  console.error(`  ${index + 1}/${turns.length}  ${text}`);
  if (delay > 0 && index < turns.length - 1) await wait(delay);
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
  region,
  rate,
  gain: Number(gain.toFixed(3)),
  rms: [Number(Math.min(...after).toFixed(4)), Number(Math.max(...after).toFixed(4))],
  outputDir: outputDir.slice(root.length + 1).replaceAll('\\', '/'),
}, null, 2));
