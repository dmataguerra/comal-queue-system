import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'test-results');
mkdirSync(output, { recursive: true });
process.env.TURNERO_DATOS = mkdtempSync(join(output, 'theme-'));
app.setAppPath(root);
app.setPath('userData', join(process.env.TURNERO_DATOS, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (window, source) => window.webContents.executeJavaScript(source, true);
async function wait(check) {
  for (let i = 0; i < 150; i++) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error('Theme check timed out');
}
async function capture(window, name) {
  // Hidden windows can defer compositor frames; finish only finite UI transitions.
  await run(
    window,
    `document.getAnimations().filter(a => a.effect.getTiming().iterations !== Infinity).forEach(a => a.finish())`,
  );
  await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
  await pause(300);
  const image = await window.webContents.capturePage(undefined, {
    stayHidden: true,
    stayAwake: true,
  });
  writeFileSync(join(output, name + '.png'), image.toPNG());
}
async function verify() {
  try {
    await import('../build/main/main.js');
    await wait(
      () =>
        BrowserWindow.getAllWindows().filter(
          (w) =>
            /\/vistas\/(operador|publica)\//.test(w.webContents.getURL()) &&
            !w.webContents.isLoading(),
        ).length === 2,
    );
    const operator = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/operador/'),
    );
    const client = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/publica/'),
    );
    for (const window of [operator, client]) window.webContents.setBackgroundThrottling(false);
    // Exercise both motion modes explicitly, independent of the runner's OS preference.
    client.webContents.debugger.attach('1.3');
    await client.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    operator.setContentSize(1366, 900);
    client.setContentSize(1920, 1080);
    await wait(() => run(operator, "Boolean(document.querySelector('.theme-switch'))"));
    await wait(() => run(client, "Boolean(document.querySelector('.public-screen'))"));
    const theme = (w) => run(w, 'document.documentElement.dataset.tema');
    const geometry = (w) =>
      run(
        w,
        `JSON.stringify(Array.from(document.querySelectorAll('.panel, .public-queue, .public-media-frame')).map(el => { const r = el.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; }))`,
      );
    assert.equal(await theme(operator), 'azul');
    assert.equal(await theme(client), 'azul');
    const before = await Promise.all([geometry(operator), geometry(client)]);
    await run(operator, `document.querySelector('.theme-switch').click()`);
    await wait(async () => (await theme(client)) === 'morado');
    assert.equal(await theme(operator), 'morado');
    assert.deepEqual(await Promise.all([geometry(operator), geometry(client)]), before);
    assert.equal(
      await run(operator, `document.querySelector('.theme-switch').getAttribute('aria-checked')`),
      'true',
    );
    assert.equal(
      await run(
        client,
        `getComputedStyle(document.querySelector('.background-blue-start')).stopColor`,
      ),
      'rgb(168, 131, 206)',
    );
    assert.equal(
      await run(
        operator,
        `getComputedStyle(document.querySelector('.button.primary')).backgroundImage.includes('129, 85, 166')`,
      ),
      true,
    );
    await capture(operator, 'theme-morado-operador');
    await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})");
    await wait(() => run(client, "Boolean(document.querySelector('.announcement-number'))"));
    await capture(client, 'theme-morado-anuncio');
    await capture(client, 'theme-morado-cliente');
    assert.ok(
      await run(
        client,
        `document.querySelectorAll('.public-animated-background animate').length > 0`,
      ),
    );
    for (const window of [operator, client]) {
      window.reload();
      await wait(async () => !window.webContents.isLoading() && (await theme(window)) === 'morado');
    }
    await wait(() => run(operator, "Boolean(document.querySelector('.theme-switch'))"));
    await run(
      operator,
      `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes('Multimedia')).click()`,
    );
    await pause(300);
    await capture(operator, 'theme-morado-multimedia');
    await run(operator, `document.querySelector('.help-button').click()`);
    await pause(300);
    await capture(operator, 'theme-morado-ayuda');
    await run(operator, `document.querySelector('.modal .icon-button').click()`);
    await run(operator, `document.querySelector('.theme-switch').click()`);
    await wait(async () => (await theme(client)) === 'azul');
    assert.equal(
      await run(
        client,
        `getComputedStyle(document.querySelector('.background-blue-start')).stopColor`,
      ),
      'rgb(0, 88, 200)',
    );
    await run(client, `localStorage.setItem('comal.tema', 'unknown')`);
    client.reload();
    await wait(async () => !client.webContents.isLoading() && (await theme(client)) === 'azul');
    await client.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await wait(() =>
      run(client, `document.querySelectorAll('.public-animated-background animate').length === 0`),
    );
    assert.equal(
      await run(
        client,
        `document.querySelectorAll('.public-animated-background animate').length === 0`,
      ),
      true,
    );
    client.webContents.debugger.detach();
    console.log(
      'PASS: default blue, switch semantics, cross-window sync, unchanged layout, palette, animation, persisted reload and invalid preference fallback.',
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
