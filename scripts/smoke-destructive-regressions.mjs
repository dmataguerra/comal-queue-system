import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.versions.electron) {
  const { default: electron } = await import('electron');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [fileURLToPath(import.meta.url)], {
    cwd: root,
    env,
    windowsHide: true,
    stdio: 'inherit',
  });
  child.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
} else {
  const { app, BrowserWindow } = await import('electron');
  const output = join(root, 'test-results');
  mkdirSync(output, { recursive: true });
  const data = mkdtempSync(join(output, 'destructive-regressions-'));
  process.env.TURNERO_DATOS = data;
  app.setAppPath(root);
  app.setPath('userData', join(data, 'electron'));
  for (const category of ['videos', 'banner'])
    mkdirSync(join(data, 'contenido', category), { recursive: true });
  writeFileSync(join(data, 'contenido/videos/corrupto.mp4'), 'Esto no es un video MP4');
  copyFileSync(
    join(root, 'public/assets/troyanos-logo.png'),
    join(data, 'contenido/banner/respaldo.png'),
  );
  writeFileSync(join(data, 'config.json'), JSON.stringify({ youtubeUrl: null }));
  BrowserWindow.prototype.show = function () {};
  BrowserWindow.prototype.showInactive = function () {};
  BrowserWindow.prototype.maximize = function () {};
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const run = (window, source) => window.webContents.executeJavaScript(source, true);
  async function wait(check) {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      if (await check()) return;
      await pause(100);
    }
    throw new Error('Timeout de regresión destructiva');
  }

  async function verify() {
    const timeout = setTimeout(() => app.exit(1), 60000);
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
          (await run(operator, "Boolean(document.querySelector('#turn-number'))"))
        );
      });
      for (const window of [operator, client]) window.webContents.setBackgroundThrottling(false);
      const snapshot = () => run(operator, 'window.turnero.obtener()');
      const before = await snapshot();
      for (const text of ['1234567', '1234567890'.repeat(1000), '123456x']) {
        await run(
          operator,
          "document.querySelector('#turn-number').focus(); document.querySelector('#turn-number').select()",
        );
        // Chromium text insertion exercises the field's native length restriction.
        await operator.webContents.insertText(text);
        await wait(() =>
          run(
            operator,
            "document.querySelector('#turn-number').getAttribute('aria-invalid') === 'true'",
          ),
        );
        assert.equal(await run(operator, "document.querySelector('#turn-number').value"), text);
        await run(operator, "document.querySelector('.register-button').click()");
        await wait(() =>
          run(
            operator,
            "document.querySelector('#ticket-feedback').textContent.includes('inválida')",
          ),
        );
        const after = await snapshot();
        assert.deepEqual(
          after.instantanea,
          before.instantanea,
          'La captura inválida cambió los turnos',
        );
        assert.deepEqual(
          after.entregasAudio,
          before.entregasAudio,
          'La captura inválida generó audio',
        );
      }
      await run(
        operator,
        "document.querySelector('#turn-number').focus(); document.querySelector('#turn-number').select()",
      );
      await operator.webContents.insertText('123456');
      await wait(() =>
        run(
          operator,
          "document.querySelector('#turn-number').getAttribute('aria-invalid') === 'false'",
        ),
      );
      await run(operator, "document.querySelector('.register-button').click()");
      await wait(async () => (await snapshot()).instantanea.actual === 56);
      await wait(() =>
        run(
          client,
          'Boolean(document.querySelector(\'[aria-label="Imágenes de la Facultad de Informática"]\'))',
        ),
      );
      const multimedia = () =>
        run(
          operator,
          "Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes('Multimedia')).click()",
        );
      for (const reload of [false, true]) {
        if (reload) {
          operator.reload();
          client.reload();
          await wait(() => run(operator, "Boolean(document.querySelector('#turn-number'))"));
        }
        await multimedia();
        await wait(() => run(operator, "Boolean(document.querySelector('.media-file.broken'))"));
        const notice = await run(
          operator,
          "document.querySelector('.media-library-notice').textContent",
        );
        assert.match(notice, /Si todos fallan, muestra las imágenes de respaldo/);
        assert.doesNotMatch(notice, /Ahora se muestran los videos/);
        await wait(() =>
          run(
            client,
            'Boolean(document.querySelector(\'[aria-label="Imágenes de la Facultad de Informática"]\'))',
          ),
        );
      }
      console.log(
        'PASS: pegado de 7 y 10000 dígitos y sufijo inválido sin truncar, sin mutación ni audio; ticket válido; respaldo y aviso veraz con MP4 corrupto antes y después de recargar.',
      );
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    } finally {
      clearTimeout(timeout);
    }
  }
  void verify();
}
