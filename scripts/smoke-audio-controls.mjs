import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    console.log(
      `PASS: volumen persistido y validado, autorización IPC, audio por fila y recarga. ${data}`,
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
