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
    for (const w of [operator, client]) w.webContents.setBackgroundThrottling(false);
    operator.setContentSize(1366, 900);
    client.setContentSize(1920, 1080);
    await wait(() => run(operator, "Boolean(document.querySelector('.zoom-tools'))"));
    await wait(() => run(client, "Boolean(document.querySelector('.public-screen'))"));
    const click = (selector) =>
      run(operator, 'document.querySelector(' + JSON.stringify(selector) + ').click()');
    const dialog = () => run(operator, "Boolean(document.querySelector('dialog[open]'))");
    const state = () => run(operator, 'window.turnero.obtener().then(s=>s.instantanea)');
    await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})");
    await wait(() => run(operator, "Boolean(document.querySelector('.turn-actions'))"));
    await click('.turn-action.danger');
    await wait(dialog);
    assert.equal((await state()).actual, 42);
    await click('.session-confirmation input');
    await click('.modal-actions .secondary');
    await click('.turn-action');
    await wait(dialog);
    assert.equal(
      await run(operator, "document.querySelector('.session-confirmation input').checked"),
      false,
    );
    await capture(operator, 'ui-confirmacion');
    await click('.session-confirmation input');
    await click('.modal-actions .primary');
    await wait(async () => !(await dialog()));
    await wait(() => run(operator, "!document.querySelector('.turn-action').disabled"));
    await click('.turn-action.danger');
    await wait(async () => (await state()).actual === null);
    assert.equal(await dialog(), false);
    await run(operator, "window.turnero.despachar({tipo:'LLAMAR',entrada:'43'})");
    operator.reload();
    await wait(() => run(operator, "Boolean(document.querySelector('.turn-actions'))"));
    await click('.turn-action.danger');
    await wait(dialog);
    await run(operator, "window.turnero.despachar({tipo:'QUITAR',n:43})");
    await pause(100);
    await click('.modal-actions .danger');
    assert.equal((await state()).actual, null);
    for (const n of [10, 20, 30, 40, 50, 60])
      await run(operator, 'window.turnero.despachar({tipo:"LLAMAR",entrada:"' + n + '"})');
    await click('.turn-action');
    await wait(dialog);
    await click('.modal-actions .primary');
    await wait(async () => !(await dialog()));
    await click('.theme-switch');
    const typography = () =>
      run(
        operator,
        `Array.from(document.querySelectorAll('.panel h2')).map(el=>{const c=getComputedStyle(el);return [c.fontSize,c.fontFamily,c.fontWeight,c.lineHeight].join('|')})`,
      );
    for (const [width, height] of [
      [1366, 900],
      [900, 650],
    ]) {
      operator.setContentSize(width, height);
      await pause(150);
      assert.equal(
        await run(
          operator,
          `Array.from(document.querySelectorAll('.sidebar nav .icon')).every(el => getComputedStyle(el).display !== 'none')`,
        ),
        true,
        'Navigation icons hidden',
      );
      const reference = (await typography())[0];
      assert.ok(
        (await typography()).every((t) => t === reference),
        'Panel titles differ',
      );
      for (const size of [110, 100, 90, 100]) {
        const currentSize = Number(await run(operator, 'document.documentElement.dataset.tamanio'));
        if (currentSize !== size)
          await click(
            size > currentSize ? '[aria-label="Aumentar tamaño"]' : '[aria-label="Reducir tamaño"]',
          );
        await wait(() =>
          run(client, 'document.documentElement.dataset.tamanio === "' + size + '"'),
        );
        assert.equal(await run(operator, 'document.documentElement.dataset.tamanio'), String(size));
        assert.equal(
          await run(
            operator,
            `(() => {
            const top = document.querySelector('.new-turn-panel').getBoundingClientRect();
            const bottom = document.querySelector('.repeat-panel').getBoundingClientRect();
            const ready = document.querySelector('.ready-panel').getBoundingClientRect();
            const icon = document.querySelector('#screen-heading .icon');
            return Math.abs(ready.top - top.top) < 2 && Math.abs(ready.bottom - bottom.bottom) < 2
              && getComputedStyle(icon).maskImage.includes('/pixel/monitor.svg');
          })()`,
          ),
          true,
          'En pantalla debe abarcar ambos paneles y usar el monitor pixel art',
        );
        assert.equal(
          await run(operator, 'document.documentElement.scrollWidth <= innerWidth'),
          true,
          'Operator horizontal overflow',
        );
        assert.equal(
          await run(
            operator,
            `Array.from(document.querySelectorAll('.turn-actions')).every(el=>{const r=el.getBoundingClientRect(),p=el.closest('.cashier-turn').getBoundingClientRect();return r.right<=p.right+1&&r.left>=p.left})`,
          ),
          true,
          'Actions overflow',
        );
        assert.equal(
          await run(
            client,
            `Array.from(document.querySelectorAll('.public-turn strong')).every(el=>el.getBoundingClientRect().height<=el.parentElement.getBoundingClientRect().height+1)`,
          ),
          true,
          'Public numbers clipped',
        );
        if (size === 110) {
          await capture(operator, 'ui-turnos-' + width);
          await capture(client, 'ui-cliente');
        }
      }
      await run(
        operator,
        `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes('Multimedia')).click()`,
      );
      assert.ok(
        (await typography()).every((t) => t === reference),
        'Multimedia title scale differs',
      );
      await capture(operator, 'ui-multimedia-' + width);
      await run(
        operator,
        `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes('Turnos')).click()`,
      );
    }
    const assets = await run(
      operator,
      `Promise.all(Array.from(new Set(Array.from(document.querySelectorAll('.icon')).map(el=>el.style.maskImage.slice(5,-2)))).map(async url=>{const r=await fetch(url);return r.ok&&(await r.text()).includes('<svg')}))`,
    );
    assert.ok(assets.every(Boolean), 'SVG assets unavailable');
    await click('[aria-label="Aumentar tamaño"]');
    operator.reload();
    await wait(() => run(operator, "Boolean(document.querySelector('.zoom-tools'))"));
    assert.equal(await run(operator, 'document.documentElement.dataset.tamanio'), '110');
    assert.equal(
      await run(operator, `document.querySelector('[aria-label="Aumentar tamaño"]').disabled`),
      true,
    );
    console.log(
      'PASS: confirmations, cancel, shared session opt-out, reload reset, stale turn guard, homogeneous titles, size bounds/sync/persistence, two operator sizes, public numbers and SVG assets.',
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
