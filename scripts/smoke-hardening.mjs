import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { copyFile } from 'node:fs/promises';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, 'test-results'), { recursive: true });
const data = mkdtempSync(join(root, 'test-results', 'hardening-'));
process.env.TURNERO_DATOS = data;
app.setAppPath(root);
app.setPath('userData', join(data, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (window, source) => window.webContents.executeJavaScript(source, true);
async function wait(check) {
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error('Timeout de regresión de anuncios/importación.');
}

async function verify() {
  try {
    await import('../build/main/main.js');
    let operator;
    await wait(async () => {
      operator = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('/operador/'),
      );
      return (
        operator &&
        !operator.webContents.isLoading() &&
        (await run(operator, "Boolean(document.querySelector('#turn-number'))"))
      );
    });
    operator.webContents.setBackgroundThrottling(false);
    await wait(() => run(operator, "window.turnero.diagnostico().then(d=>d.audio==='correcto')"));
    const ids = await run(
      operator,
      `(async()=>{ const ids=[];for(let i=0;i<6;i++){ids.push((await window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})).anuncio.id);}return ids;})()`,
    );
    assert.equal(new Set(ids).size, 6);
    const error = await run(
      operator,
      "window.turnero.despachar({tipo:'LLAMAR',entrada:'43'}).then(()=>null,e=>e.message)",
    );
    assert.match(error, /cola de audio está llena/);
    assert.equal((await run(operator, 'window.turnero.obtener()')).instantanea.actual, 42);
    await wait(() => run(operator, "document.body.textContent.includes('Audio: 6/6 en espera')"));
    await run(operator, "document.querySelector('#turn-number').focus()");
    await operator.webContents.insertText('43');
    await wait(() =>
      run(operator, "document.querySelector('#call-hint').textContent.includes('Turno nuevo')"),
    );
    await run(operator, "document.querySelector('.register-button').click()");
    await wait(() =>
      run(
        operator,
        "document.querySelector('.form-feedback').textContent.includes('Audio en espera: intenta de nuevo')",
      ),
    );
    assert.equal(await run(operator, "document.querySelector('#turn-number').value"), '43');
    assert.equal((await run(operator, 'window.turnero.obtener()')).instantanea.actual, 42);
    assert.equal(
      await run(
        operator,
        "document.querySelector('.form-feedback').textContent.includes('Error invoking remote method')",
      ),
      false,
    );
    await wait(() =>
      run(
        operator,
        `window.turnero.obtener().then(x=>x.entregasAudio.some(e=>e.id===${ids[0]}&&e.estado==='reproducido'))`,
      ),
    );
    assert.equal(
      await run(operator, "Number(document.querySelector('.turn-audio').dataset.anuncioId)"),
      ids[5],
    );
    await run(operator, "window.turnero.despachar({tipo:'QUITAR',n:42})");
    await wait(() =>
      run(
        operator,
        "window.turnero.obtener().then(x=>x.entregasAudio.filter(e=>e.estado==='descartado').length>=4)",
      ),
    );
    await wait(() =>
      run(
        operator,
        "window.turnero.obtener().then(x=>x.entregasAudio.every(e=>e.estado!=='pendiente'&&e.estado!=='reproduciendo'))",
      ),
    );
    const { importarArchivos } = await import('../build/main/contenido.js');
    const origin = join(data, 'prueba.mp4');
    writeFileSync(origin, 'video de prueba');
    let start, release;
    const copying = new Promise((resolve) => {
      start = resolve;
    });
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const operation = importarArchivos(join(data, 'contenido'), 'videos', [origin], () => {}, {
      copiar: async (source, target) => {
        start();
        await blocked;
        await copyFile(source, target);
      },
    });
    await copying;
    try {
      const result = await Promise.race([
        run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'43'})"),
        pause(3000).then(() => {
          throw new Error('IPC bloqueado por importación');
        }),
      ]);
      assert.equal(result.instantanea.actual, 43);
    } finally {
      release();
    }
    assert.equal((await operation).agregados.length, 1);
    for (const n of [44, 45, 46, 47, 48])
      await run(operator, `window.turnero.despachar({tipo:'LLAMAR',entrada:'${n}'})`);
    await wait(() =>
      run(
        operator,
        "document.body.textContent.includes('Seis turnos visibles') && document.body.textContent.includes('más antiguo (43)')",
      ),
    );
    console.log(
      'PASS: IDs repetidos, saturación sin mutación, fila más reciente, descarte de pendientes e IPC disponible durante copia lenta.',
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
