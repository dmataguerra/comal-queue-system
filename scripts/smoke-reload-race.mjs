// Regression: an announcement accepted while the public display is reloading must still play.
// Before the fix, the event arrived before the view subscribed and the turn was silently
// discarded 45 seconds later.
import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, 'test-results'), { recursive: true });
const data = mkdtempSync(join(root, 'test-results', 'reload-race-'));
process.env.TURNERO_DATOS = data;
process.env.TURNERO_PUERTO = '0';
app.setAppPath(root);
app.setPath('userData', join(data, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (window, source) => window.webContents.executeJavaScript(source, true);
async function wait(check, message) {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    try {
      if (await check()) return;
    } catch {
      /* The page may be mid-reload; try again. */
    }
    await pause(100);
  }
  throw new Error(message);
}
const findWindow = (view) =>
  BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes(`/${view}/`));
async function verify() {
  try {
    await import('../build/main/main.js');
    let operator;
    let display;
    await wait(async () => {
      operator = findWindow('operador');
      display = findWindow('publica');
      return (
        operator &&
        display &&
        !operator.webContents.isLoading() &&
        !display.webContents.isLoading() &&
        (await run(operator, "window.turnero.diagnostico().then(d=>d.audio==='correcto')"))
      );
    }, 'The app did not become ready with working audio.');
    operator.webContents.setBackgroundThrottling(false);
    display.webContents.setBackgroundThrottling(false);
    // Reload the display and call a turn before its renderer can subscribe again.
    display.webContents.reloadIgnoringCache();
    const result = await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'27'})");
    const id = result.anuncio.id;
    await wait(
      () =>
        run(
          operator,
          `window.turnero.obtener().then(x=>x.entregasAudio.find(e=>e.id===${id})?.estado==='reproducido')`,
        ),
      'The announcement made during the reload was not played.',
    ).catch(async (error) => {
      const all = await run(operator, 'window.turnero.obtener().then(x=>x.entregasAudio)');
      throw new Error(`${error.message} Deliveries: ${JSON.stringify(all)}`);
    });
    const deliveries = await run(operator, 'window.turnero.obtener().then(x=>x.entregasAudio)');
    assert.equal(
      deliveries.filter((e) => e.n === 27).length,
      1,
      'The announcement must be delivered exactly once.',
    );
    console.log('PASS: announcement accepted during a display reload is played once.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    // app.quit() would drop the exit code; exit explicitly so CI sees failures.
    app.exit(process.exitCode ?? 0);
  }
}
void verify();
