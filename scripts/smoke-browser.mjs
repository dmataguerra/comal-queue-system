import { app, BrowserWindow, ipcMain } from 'electron';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const resultsDir = join(root, 'test-results');
mkdirSync(resultsDir, { recursive: true });
process.env.TURNERO_DATOS = mkdtempSync(join(resultsDir, 'browser-'));
process.env.TURNERO_PUERTO = '0';
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
app.setAppPath(root);
app.setPath('userData', join(process.env.TURNERO_DATOS, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check, message) {
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      if (await check()) return;
    } catch {
      /* The page may still be loading during the first attempt. */
    }
    await pause(100);
  }
  throw new Error(message);
}
async function verify() {
  try {
    await import('../build/main/main.js');
    let serverOrigin;
    await waitFor(() => {
      const entries = readFileSync(join(process.env.TURNERO_DATOS, 'turnero.log'), 'utf8')
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line));
      serverOrigin = entries
        .map((entry) => entry.message.match(/^Navegador local: (http:\/\/127\.0\.0\.1:\d+)/)?.[1])
        .find(Boolean);
      return Boolean(serverOrigin);
    }, 'El servidor de navegador no inició.');
    assert.equal(
      (await (await fetch(`${serverOrigin}/api/diagnostico`)).json()).carpetaDatos,
      process.env.TURNERO_DATOS,
    );
    ipcMain.removeAllListeners('turnero:anuncio:acuse');
    const operatorWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
    await operatorWindow.loadURL(`${serverOrigin}/`);
    await waitFor(
      () =>
        operatorWindow.webContents.executeJavaScript(
          "Boolean(document.querySelector('#turn-number'))",
        ),
      'El operador no cargó en navegador.',
    );
    assert.equal(
      await operatorWindow.webContents.executeJavaScript('typeof window.turnero'),
      'object',
    );
    assert.equal(
      await operatorWindow.webContents.executeJavaScript('window.turnero.youtubeAdmitido'),
      false,
    );
    assert.match(
      await operatorWindow.webContents.executeJavaScript('document.body.textContent'),
      /YouTube no está admitido en navegador/,
    );
    const unsupported = await operatorWindow.webContents.executeJavaScript(
      "window.turnero.configurarYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ').then(()=>null,e=>e.message)",
    );
    assert.match(unsupported, /YouTube no está admitido/);
    const displayWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });
    await displayWindow.loadURL(`${serverOrigin}/publica`);
    await waitFor(
      () =>
        displayWindow.webContents.executeJavaScript(
          "Boolean(document.querySelector('.public-screen'))",
        ),
      'La vista pública no cargó en navegador.',
    );
    const desktopOperator = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().startsWith('turnero://app/views/operator/'),
    );
    await desktopOperator.webContents.executeJavaScript(
      "window.turnero.configurarYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')",
    );
    await pause(300);
    assert.equal(
      await displayWindow.webContents.executeJavaScript(
        "document.querySelectorAll('.youtube-host, iframe').length",
      ),
      0,
    );
    assert.match(
      await displayWindow.webContents.executeJavaScript(
        'window.turnero.ajustarVolumenYouTube(0.1,150).then(()=>null,e=>e.message)',
      ),
      /YouTube no está admitido/,
    );
    assert.equal(
      await displayWindow.webContents.executeJavaScript(
        `fetch('/api/salud', {method:'POST', headers:{'Content-Type':'application/json','X-Turnero-Cliente':'navegador'}, body:JSON.stringify(['audio','correcto'])}).then(r=>r.status)`,
      ),
      200,
    );
    const previousDegradations = (
      readFileSync(join(process.env.TURNERO_DATOS, 'turnero.log'), 'utf8').match(
        /Audio degradado\./g,
      ) ?? []
    ).length;
    await displayWindow.webContents.executeJavaScript(
      "window.turnero.registrar('prueba de registro HTTP'); window.turnero.informarSalud('audio','degradado')",
    );
    await waitFor(() => {
      const logText = readFileSync(join(process.env.TURNERO_DATOS, 'turnero.log'), 'utf8');
      return (
        logText
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
          .some(
            (entry) =>
              entry.component === 'renderer:browser' && entry.message === 'prueba de registro HTTP',
          ) && (logText.match(/Audio degradado\./g) ?? []).length > previousDegradations
      );
    }, 'La salud o el mensaje HTTP no se registraron.');
    await operatorWindow.webContents.executeJavaScript('window.turnero.configurarYouTube(null)');
    const callResult = await operatorWindow.webContents.executeJavaScript(
      "window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})",
    );
    assert.equal(callResult.instantanea.actual, 42);
    await waitFor(
      () =>
        displayWindow.webContents.executeJavaScript(
          "document.querySelector('.public-turn strong')?.textContent?.trim()==='42'",
        ),
      'La vista pública del navegador no recibió el turno.',
    );
    await waitFor(async () => {
      const initialData = await (await fetch(`${serverOrigin}/api/inicial`)).json();
      return (
        initialData.entregaAudio?.id === 1 && initialData.entregaAudio.estado === 'reproducido'
      );
    }, 'La vista pública del navegador no confirmó la reproducción por HTTP.');
    await waitFor(
      () =>
        operatorWindow.webContents.executeJavaScript(
          "document.querySelector('.turn-audio-reproducido[data-anuncio-id=\"1\"]')?.textContent === 'Anunciado'",
        ),
      'El operador no mostró el acuse de audio.',
    );
    const noOriginResponse = await fetch(`${serverOrigin}/api/accion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Turnero-Cliente': 'navegador' },
      body: JSON.stringify({ tipo: 'LLAMAR', entrada: '43' }),
    });
    assert.equal(noOriginResponse.status, 403);
    const outsideHostStatus = await new Promise((resolve, reject) => {
      const outboundRequest = request(
        `${serverOrigin}/api/inicial`,
        { headers: { Host: 'otro.local:4317' } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      outboundRequest.on('error', reject);
      outboundRequest.end();
    });
    assert.equal(outsideHostStatus, 403);
    assert.equal(
      (await (await fetch(`${serverOrigin}/api/inicial`)).json()).instantanea.actual,
      42,
    );
    console.log(
      'PASS: navegador local, acuse HTTP, YouTube rechazado sin iframe (incluyendo config de escritorio), salud/registro HTTP y bloqueo de solicitudes externas.',
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
