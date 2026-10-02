import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS } from '../build/shared/ipc-channels.js';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, 'test-results'), { recursive: true });
const data = mkdtempSync(join(root, 'test-results', 'audio-controls-'));
cpSync(join(root, 'contenido'), join(data, 'contenido'), { recursive: true });
process.env.TURNERO_DATOS = data;
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
app.setAppPath(root);
app.setPath('userData', join(data, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (window, source) => window.webContents.executeJavaScript(source, true);
async function wait(check) {
  const deadline = performance.now() + 30_000;
  while (performance.now() < deadline) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error('Tiempo agotado en controles de audio.');
}
async function verify() {
  try {
    await import('../build/main/main.js');
    let operator, client;
    await wait(async () => {
      operator = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('/operador/'),
      );
      client = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('/publica/'),
      );
      return (
        operator &&
        client &&
        !operator.webContents.isLoading() &&
        !client.webContents.isLoading() &&
        (await run(operator, "Boolean(document.querySelector('.volume-control'))"))
      );
    });
    for (const window of [operator, client]) window.webContents.setBackgroundThrottling(false);
    await run(operator, 'window.turnero.configurarVolumen(0.8, 0.35)');
    await wait(() =>
      run(client, 'window.turnero.obtener().then(r => r.config.volumenMusica === 0.35)'),
    );
    assert.equal(JSON.parse(readFileSync(join(data, 'config.json'), 'utf8')).volumenVoz, 0.8);
    assert.equal(
      await run(operator, 'window.turnero.configurarVolumen(-1, 2).then(() => false, () => true)'),
      true,
    );
    assert.equal(
      await run(client, 'window.turnero.configurarVolumen(1, 1).then(() => false, () => true)'),
      true,
    );
    await run(operator, "document.querySelector('.volume-control summary').click()");
    await wait(() => run(operator, "document.querySelector('#voice-volume').value === '80'"));
    await run(operator, "document.querySelector('.theme-switch').click()");
    writeFileSync(
      join(data, 'controles.png'),
      (
        await operator.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
      ).toPNG(),
    );
    await run(operator, "document.querySelector('.volume-control summary').click()");
    await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'41'})");
    await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})");
    await wait(() => run(operator, "Boolean(document.querySelector('.turn-audio-reproduciendo'))"));
    await wait(() =>
      run(operator, "document.querySelectorAll('.turn-audio-reproducido').length === 2"),
    );
    assert.equal(
      await run(
        operator,
        "[...document.querySelectorAll('.connection-banner')].some(e => e.textContent.includes('audio terminado'))",
      ),
      false,
    );
    operator.reload();
    await wait(
      async () =>
        !operator.webContents.isLoading() &&
        (await run(operator, "document.querySelectorAll('.turn-audio-reproducido').length === 2")),
    );
    const original = (await run(operator, 'window.turnero.obtener()')).inventario;
    for (const [number, inventory] of [
      ['00', { ...original, aviso: null }],
      ['99', { ...original, voz: original.voz.map((url, n) => (n === 99 ? null : url)) }],
      [
        '40',
        {
          ...original,
          voz: original.voz.map((url, n) =>
            n === 40 ? 'turnero://app/contenido/voz/invalida.wav' : url,
          ),
        },
      ],
    ]) {
      client.webContents.send(IPC_CHANNELS.contentChanged, inventory);
      await pause(200);
      const result = await run(
        operator,
        `window.turnero.despachar({tipo:'LLAMAR',entrada:'${number}'})`,
      );
      await wait(() =>
        run(
          operator,
          `window.turnero.obtener().then(x=>x.entregasAudio.some(e=>e.id===${result.anuncio.id}&&e.estado==='fallo'))`,
        ),
      );
      assert.ok(
        await run(operator, "document.body.textContent.includes('Falló el audio de un turno')"),
      );
    }
    client.webContents.send(IPC_CHANNELS.contentChanged, original);
    await pause(200);
    const recovered = await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'40'})");
    await wait(() =>
      run(
        operator,
        `window.turnero.obtener().then(x=>x.entregasAudio.some(e=>e.id===${recovered.anuncio.id}&&e.estado==='reproducido'))`,
      ),
    );
    assert.match(readFileSync(join(data, 'turnero.log'), 'utf8'), /Falta el aviso/);
    assert.match(readFileSync(join(data, 'turnero.log'), 'utf8'), /Falta la voz del turno 99/);
    assert.match(readFileSync(join(data, 'turnero.log'), 'utf8'), /invalida.wav/);
    const voice = join(data, 'contenido', 'voz', '40.wav');
    const bytes = readFileSync(voice);
    let revision = (await run(operator, 'window.turnero.obtener()')).inventario.revisionAudio;
    writeFileSync(voice, 'voz dañada con el mismo nombre');
    await wait(() =>
      run(
        operator,
        `window.turnero.obtener().then(x=>x.inventario.revisionAudio!==${JSON.stringify(revision)})`,
      ),
    );
    await pause(200);
    const broken = await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'40'})");
    await wait(() =>
      run(
        operator,
        `window.turnero.obtener().then(x=>x.entregasAudio.some(e=>e.id===${broken.anuncio.id}&&e.estado==='fallo'))`,
      ),
    );
    revision = (await run(operator, 'window.turnero.obtener()')).inventario.revisionAudio;
    writeFileSync(voice, bytes);
    await wait(() =>
      run(
        operator,
        `window.turnero.obtener().then(x=>x.inventario.revisionAudio!==${JSON.stringify(revision)})`,
      ),
    );
    await pause(200);
    const repaired = await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'40'})");
    await wait(() =>
      run(
        operator,
        `window.turnero.obtener().then(x=>x.entregasAudio.some(e=>e.id===${repaired.anuncio.id}&&e.estado==='reproducido'))`,
      ),
    );
    console.log(
      `PASS: volumen, IPC, acuses, recarga, aviso/voz ausentes, carga inválida, reemplazo con mismo nombre detectado y recuperación sin voz en cache. ${data}`,
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
