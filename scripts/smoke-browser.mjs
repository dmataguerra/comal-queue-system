import { app, BrowserWindow, ipcMain } from 'electron';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const resultados = join(raiz, 'test-results');
mkdirSync(resultados, { recursive: true });
process.env.TURNERO_DATOS = mkdtempSync(join(resultados, 'browser-'));
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
app.setAppPath(raiz);
app.setPath('userData', join(process.env.TURNERO_DATOS, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
async function esperar(comprobar, mensaje) {
  for (let intento = 0; intento < 150; intento++) {
    try {
      if (await comprobar()) return;
    } catch {
      /* Carga en curso. */
    }
    await pausa(100);
  }
  throw new Error(mensaje);
}

async function verificar() {
  try {
    await import('../build/main/main.js');
    await esperar(
      async () => (await fetch('http://127.0.0.1:4317/api/inicial')).ok,
      'El servidor de navegador no inició.',
    );
    // El acuse debe llegar por HTTP, nunca por la ventana Electron de respaldo.
    ipcMain.removeAllListeners('turnero:anuncio:acuse');
    const operador = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
    await operador.loadURL('http://127.0.0.1:4317/');
    await esperar(
      () =>
        operador.webContents.executeJavaScript("Boolean(document.querySelector('#turn-number'))"),
      'El operador no cargó en navegador.',
    );
    assert.equal(await operador.webContents.executeJavaScript('typeof window.turnero'), 'object');
    assert.equal(
      await operador.webContents.executeJavaScript('window.turnero.youtubeAdmitido'),
      false,
    );
    assert.match(
      await operador.webContents.executeJavaScript('document.body.textContent'),
      /YouTube no está admitido en navegador/,
    );
    const unsupported = await operador.webContents.executeJavaScript(
      "window.turnero.configurarYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ').then(()=>null,e=>e.message)",
    );
    assert.match(unsupported, /YouTube no está admitido/);
    const publica = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });
    await publica.loadURL('http://127.0.0.1:4317/publica');
    await esperar(
      () =>
        publica.webContents.executeJavaScript("Boolean(document.querySelector('.public-screen'))"),
      'La vista pública no cargó en navegador.',
    );
    // Una configuración guardada desde Electron tampoco activa un iframe sin control en navegador.
    const desktopOperator = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().startsWith('turnero://app/vistas/operador/'),
    );
    await desktopOperator.webContents.executeJavaScript(
      "window.turnero.configurarYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')",
    );
    await pausa(300);
    assert.equal(
      await publica.webContents.executeJavaScript(
        "document.querySelectorAll('.youtube-host, iframe').length",
      ),
      0,
    );
    assert.match(
      await publica.webContents.executeJavaScript(
        'window.turnero.ajustarVolumenYouTube(0.1,150).then(()=>null,e=>e.message)',
      ),
      /YouTube no está admitido/,
    );
    const degradacionesPrevias = (
      readFileSync(join(process.env.TURNERO_DATOS, 'turnero.log'), 'utf8').match(
        /Audio degradado\./g,
      ) ?? []
    ).length;
    await publica.webContents.executeJavaScript(
      "window.turnero.registrar('prueba de registro HTTP'); window.turnero.informarSalud('audio','degradado')",
    );
    // La precarga de otras pantallas puede recuperar la salud antes de leer el diagnóstico.
    // El registro conserva el efecto HTTP aunque el estado ya haya cambiado.
    await esperar(() => {
      const registro = readFileSync(join(process.env.TURNERO_DATOS, 'turnero.log'), 'utf8');
      return (
        registro.includes('[navegador] prueba de registro HTTP') &&
        (registro.match(/Audio degradado\./g) ?? []).length > degradacionesPrevias
      );
    }, 'La salud o el mensaje HTTP no se registraron.');
    await operador.webContents.executeJavaScript('window.turnero.configurarYouTube(null)');
    const llamada = await operador.webContents.executeJavaScript(
      "window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})",
    );
    assert.equal(llamada.instantanea.actual, 42);
    await esperar(
      () =>
        publica.webContents.executeJavaScript(
          "document.querySelector('.public-turn strong')?.textContent?.trim()==='42'",
        ),
      'La vista pública del navegador no recibió el turno.',
    );
    await esperar(async () => {
      const dato = await (await fetch('http://127.0.0.1:4317/api/inicial')).json();
      return dato.entregaAudio?.id === 1 && dato.entregaAudio.estado === 'reproducido';
    }, 'La vista pública del navegador no confirmó la reproducción por HTTP.');
    await esperar(
      () =>
        operador.webContents.executeJavaScript(
          "document.querySelector('.turn-audio-reproducido[data-anuncio-id=\"1\"]')?.textContent === 'Anunciado'",
        ),
      'El operador no mostró el acuse de audio.',
    );
    const sinOrigen = await fetch('http://127.0.0.1:4317/api/accion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Turnero-Cliente': 'navegador' },
      body: JSON.stringify({ tipo: 'LLAMAR', entrada: '43' }),
    });
    assert.equal(sinOrigen.status, 403);
    const fuera = await new Promise((resolver, rechazar) => {
      const peticion = request(
        'http://127.0.0.1:4317/api/inicial',
        { headers: { Host: 'otro.local:4317' } },
        (respuesta) => {
          respuesta.resume();
          resolver(respuesta.statusCode);
        },
      );
      peticion.on('error', rechazar);
      peticion.end();
    });
    assert.equal(fuera, 403);
    assert.equal(
      (await (await fetch('http://127.0.0.1:4317/api/inicial')).json()).instantanea.actual,
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
void verificar();
