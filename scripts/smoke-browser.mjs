import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const resultados = join(raiz, 'test-results');
mkdirSync(resultados, { recursive: true });
process.env.TURNERO_DATOS = mkdtempSync(join(resultados, 'browser-'));
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
    const operador = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await operador.loadURL('http://127.0.0.1:4317/');
    await esperar(
      () =>
        operador.webContents.executeJavaScript("Boolean(document.querySelector('#turn-number'))"),
      'El operador no cargó en navegador.',
    );
    assert.equal(await operador.webContents.executeJavaScript('typeof window.turnero'), 'object');
    const publica = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await publica.loadURL('http://127.0.0.1:4317/publica');
    await esperar(
      () =>
        publica.webContents.executeJavaScript("Boolean(document.querySelector('.public-screen'))"),
      'La vista pública no cargó en navegador.',
    );
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
      return dato.entregaAudio?.id === 1 && dato.entregaAudio.estado !== 'pendiente';
    }, 'La vista pública de Electron no informó el resultado del audio.');
    await esperar(
      () =>
        operador.webContents.executeJavaScript(
          "document.body.textContent.includes('audio terminado en la vista pública') || document.body.textContent.includes('fallo de audio')",
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
      'PASS: navegador local, operador, pantalla pública, eventos y bloqueo de solicitudes externas.',
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verificar();
