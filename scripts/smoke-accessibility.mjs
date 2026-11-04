import { app, BrowserWindow } from 'electron';
import axe from 'axe-core';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const results = join(root, 'test-results');
mkdirSync(results, { recursive: true });
const output = mkdtempSync(join(results, 'accessibility-'));
process.env.TURNERO_DATOS = output;
process.env.TURNERO_PUERTO = '0';
app.setAppPath(root);
app.setPath('userData', join(output, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (window, code) => window.webContents.executeJavaScript(code, true);
const report = {
  status: 'RUNNING',
  engine: `axe-core ${axe.version}`,
  scope:
    'Automated WCAG 2 A/AA, 2.1 A/AA and 2.2 AA checks; manual accessibility acceptance remains separate.',
  evaluations: [],
};
const save = () => writeFileSync(join(output, 'resultado.json'), JSON.stringify(report, null, 2));
async function wait(check, message) {
  for (let i = 0; i < 150; i++) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error(message);
}
async function settle(window) {
  await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
  await pause(100);
}
async function click(window, selector) {
  assert.ok(await run(window, `Boolean(document.querySelector(${JSON.stringify(selector)}))`));
  await run(window, `document.querySelector(${JSON.stringify(selector)}).click()`);
  await settle(window);
}
async function audit(window, name) {
  await settle(window);
  const result = await run(
    window,
    `axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}})
      .then(r => ({violations: r.violations, incomplete: r.incomplete, passedRules: r.passes.length}))`,
  );
  report.evaluations.push({ name, ...result });
  save();
  console.log(
    `${result.violations.length ? 'FAIL' : 'PASS'}: ${name} (${result.violations.length} rule violations)`,
  );
}
async function verify() {
  const timeout = setTimeout(() => {
    report.status = 'FAIL';
    report.error = 'Accessibility audit exceeded 120 seconds.';
    save();
    app.exit(1);
  }, 120000);
  try {
    await import('../build/main/main.js');
    await wait(
      () => BrowserWindow.getAllWindows().filter((w) => !w.webContents.isLoading()).length === 2,
      'Desktop views did not load.',
    );
    const desktop = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/operador/'),
    );
    const display = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/publica/'),
    );
    assert.ok(desktop && display);
    const origin = readFileSync(join(output, 'turnero.log'), 'utf8').match(
      /http:\/\/127\.0\.0\.1:\d+/,
    )?.[0];
    assert.ok(origin, 'Local browser server did not start.');
    const browser = new BrowserWindow({
      show: false,
      width: 1366,
      height: 900,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    await browser.loadURL(`${origin}/vistas/operador/index.html`);
    for (const window of [desktop, display, browser]) {
      window.webContents.setBackgroundThrottling(false);
      await run(window, `${axe.source}; void 0;`);
    }
    for (const theme of ['azul', 'morado']) {
      for (const [name, window] of [
        ['desktop', desktop],
        ['browser', browser],
      ]) {
        await wait(
          () => run(window, "Boolean(document.querySelector('.help-button'))"),
          'Operator unavailable.',
        );
        if ((await run(window, 'document.documentElement.dataset.tema')) !== theme)
          await click(window, '.theme-switch');
        await click(window, '[aria-label="Turnos"]');
        await audit(window, `${name}/${theme}/turns`);
        await click(window, '[aria-label="Multimedia"]');
        await audit(window, `${name}/${theme}/media`);
        await click(window, '.help-button');
        await wait(
          () => run(window, "Boolean(document.querySelector('dialog[open]'))"),
          'Help dialog did not open.',
        );
        await audit(window, `${name}/${theme}/help`);
        await click(window, '[data-testid="help-tour-start-completo"]');
        await wait(
          () => run(window, "Boolean(document.querySelector('[data-testid=help-tour]'))"),
          'Tour did not open.',
        );
        await audit(window, `${name}/${theme}/tour`);
        await click(window, '[data-testid="help-tour-close"]');
        await wait(
          () => run(window, "Boolean(document.querySelector('dialog[open]'))"),
          'Help did not return.',
        );
        await click(window, '.help-diagnostics-link');
        await wait(
          () => run(window, "Boolean(document.querySelector('.diagnostics-panel'))"),
          'Diagnostics unavailable.',
        );
        await audit(window, `${name}/${theme}/diagnostics`);
      }
      await wait(
        () => run(display, `document.documentElement.dataset.tema === '${theme}'`),
        'Public theme did not synchronize.',
      );
      await audit(display, `public/${theme}`);
    }
    const failures = report.evaluations.filter((e) => e.violations.length);
    report.status = failures.length ? 'FAIL' : 'PASS';
    save();
    console.log(
      `${report.status}: ${report.evaluations.length} accessibility evaluations; ${output}`,
    );
    app.exit(failures.length ? 1 : 0);
  } catch (error) {
    report.status = 'FAIL';
    report.error = String(error?.stack ?? error);
    save();
    console.error(error);
    app.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}
void verify();
