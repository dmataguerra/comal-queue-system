import { Builder, By, Key } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import electronPath from 'electron';
import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const results = join(root, 'test-results', 'qa-ui');
const evidence = join(results, 'evidence');
await mkdir(results, { recursive: true });
await mkdir(evidence, { recursive: true });
const data = await mkdtemp(join(results, 'run-'));
const report = {
  suite: 'qa-ui',
  startedAt: new Date().toISOString(),
  scenarios: [],
  evidenceDirectory: data,
};
let host;
let driver;

async function waitFor(fn, timeout = 20000) {
  return driver.wait(async () => {
    try {
      return await fn();
    } catch {
      return false;
    }
  }, timeout);
}

async function screenshot(name) {
  const path = join(data, `${name}.png`);
  const stablePath = join(evidence, `${name}.png`);
  await writeFile(path, await driver.takeScreenshot(), 'base64');
  await copyFile(path, stablePath);
  return stablePath;
}

async function scenario(id, title, action) {
  const item = { id, title, status: 'FAIL' };
  try {
    item.evidence = await action();
    item.status = 'PASS';
  } catch (error) {
    item.error = error.message;
    try {
      item.failureScreenshot = await screenshot(`${id}-failure`);
    } catch {}
    throw error;
  } finally {
    report.scenarios.push(item);
  }
}

try {
  const hostLogPath = join(data, 'electron-host.log');
  report.hostLog = hostLogPath;
  const hostLog = openSync(hostLogPath, 'a');
  host = spawn(electronPath, [join(root, 'qa/automation/comal-host.mjs')], {
    cwd: root,
    env: { ...process.env, TURNERO_DATOS: data, TURNERO_PUERTO: '0' },
    stdio: ['ignore', hostLog, hostLog],
    windowsHide: true,
  });
  const logPath = join(data, 'turnero.log');
  let origin;
  const deadline = Date.now() + 45000;
  while (!origin && Date.now() < deadline) {
    try {
      origin = (await readFile(logPath, 'utf8')).match(
        /Navegador local: (http:\/\/127\.0\.0\.1:\d+)/,
      )?.[1];
    } catch {}
    if (!origin) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!origin) throw new Error(`No se encontró el origen HTTP de Comal; revisar ${hostLogPath}`);

  const options = new chrome.Options().addArguments(
    '--headless=new',
    '--window-size=1440,1000',
    '--autoplay-policy=no-user-gesture-required',
  );
  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.get(`${origin}/publica`);
  await waitFor(() => driver.findElement(By.css('.public-screen')));
  const publicHandle = await driver.getWindowHandle();
  await driver.switchTo().newWindow('tab');
  await driver.get(origin);
  const input = await waitFor(() => driver.findElement(By.id('turn-number')));
  const operatorHandle = await driver.getWindowHandle();

  await scenario('COMAL-QA-001', 'Llamar 42 y sincronizar las vistas', async () => {
    await input.sendKeys('42', Key.ENTER);
    await driver.switchTo().window(publicHandle);
    const number = await waitFor(async () => {
      const announcement = await driver.findElement(By.css('.announcement-number'));
      const text = (await announcement.getAttribute('textContent')).trim();
      return text || false;
    });
    if (number.trim() !== '42') throw new Error(`La pública mostró ${number}, no 42`);
    const evidence = await screenshot('COMAL-QA-001-publica-42');
    await driver.switchTo().window(operatorHandle);
    await waitFor(
      async () =>
        (await driver.findElement(By.css('.cashier-turn strong')).getText()).trim() === '42',
    );
    return { screenshot: evidence, operatorNumber: '42', publicNumber: number.trim() };
  });

  await scenario('COMAL-QA-003', 'Rechazar una captura inválida sin mutar el turno', async () => {
    await driver.switchTo().window(operatorHandle);
    const operatorInput = await driver.findElement(By.id('turn-number'));
    await operatorInput.sendKeys('abc', Key.ENTER);
    const feedback = await waitFor(() => driver.findElement(By.id('ticket-feedback')));
    const message = await feedback.getText();
    if (!message.includes('Captura inválida')) throw new Error(`Mensaje inesperado: ${message}`);
    const operatorNumber = (
      await driver.findElement(By.css('.cashier-turn.most-recent strong')).getText()
    ).trim();
    if (operatorNumber !== '42')
      throw new Error(`La captura inválida alteró el operador: ${operatorNumber}`);
    const evidence = await screenshot('COMAL-QA-003-invalid-capture');
    await driver.switchTo().window(publicHandle);
    const number = await waitFor(async () => {
      const numbers = await driver.findElements(By.css('.public-turn strong'));
      return numbers.length === 1 && (await numbers[0].getText()).trim() === '42' ? '42' : false;
    });
    if (number !== '42') throw new Error('La captura inválida modificó la vista pública');
    return { screenshot: evidence, feedback: message, operatorNumber, publicNumber: '42' };
  });

  await scenario('COMAL-QA-011', 'Corregir la última captura sin anunciarla', async () => {
    await driver.switchTo().window(operatorHandle);
    const undo = await driver.findElement(By.css('.undo-row button'));
    await waitFor(() => undo.isEnabled());
    await undo.click();
    await waitFor(() => driver.findElement(By.css('.empty-state')));
    const evidence = await screenshot('COMAL-QA-011-correct-last-capture');
    await driver.switchTo().window(publicHandle);
    await waitFor(async () => (await driver.findElements(By.css('.public-turn'))).length === 0);
    return { screenshot: evidence, operatorEmpty: true, publicEmpty: true };
  });

  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  if (driver) {
    try {
      await driver.quit();
    } catch {}
  }
  if (host) host.kill();
  report.finishedAt = new Date().toISOString();
  await writeFile(join(results, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
