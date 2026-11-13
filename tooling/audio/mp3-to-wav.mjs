// Convierte contenido/voz/NN.mp3 a NN.wav (PCM16, 22 050 Hz, mono) con el decodificador de Chromium.
// Uso: npx electron tooling/audio/mp3-to-wav.mjs [--delete]
// Sin dependencias nuevas: solo Electron, que ya es dependencia del proyecto.
import { app, BrowserWindow } from 'electron';
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../contenido/voz');
const deleteSource = process.argv.includes('--delete');

function wavFromPcm(pcm) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const decodeScript = `(async (b64, rate) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ctx = new OfflineAudioContext(1, 1, rate);
  const buf = await ctx.decodeAudioData(bytes.buffer);
  const n = buf.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i] / buf.numberOfChannels;
  }
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.round(Math.max(-1, Math.min(1, mono[i])) * 32767);
  let s = '';
  const u8 = new Uint8Array(out.buffer);
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return { rate: buf.sampleRate, channels: buf.numberOfChannels, b64: btoa(s) };
})`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('about:blank');
  let failures = 0;
  for (const name of readdirSync(dir).filter((n) => /^\d{2}\.mp3$/i.test(n))) {
    const sourcePath = resolve(dir, name);
    try {
      const b64 = readFileSync(sourcePath).toString('base64');
      const r = await win.webContents.executeJavaScript(
        `${decodeScript}(${JSON.stringify(b64)}, ${RATE})`,
      );
      if (r.rate !== RATE) throw new Error(`frecuencia inesperada ${r.rate}`);
      const pcm = Buffer.from(r.b64, 'base64');
      const wav = wavFromPcm(new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2));
      writeFileSync(resolve(dir, name.replace(/\.mp3$/i, '.wav')), wav);
      if (deleteSource) unlinkSync(sourcePath);
      console.log(`${name}: ${r.channels} canal(es) -> ${(pcm.length / 2 / RATE).toFixed(3)} s`);
    } catch (error) {
      failures++;
      console.error(`${name}: FALLO ${error.message}`);
    }
  }
  app.exit(failures ? 1 : 0);
});
