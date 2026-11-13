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
let origin;
let publicHandle;
let operatorHandle;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, timeout = 20000) {
  return driver.wait(async () => {
    try {
      return await fn();
    } catch {
      return false;
    }
  }, timeout);
}

// Like waitFor, but throws a descriptive error built from the last observed value.
async function expectEventually(fn, describe, timeout = 20000) {
  let last;
  try {
    return await waitFor(async () => {
      last = await fn();
      return last?.ok ? last : false;
    }, timeout);
  } catch {
    throw new Error(`${describe}; observado: ${JSON.stringify(last?.observed ?? last)}`);
  }
}

async function screenshot(name) {
  const path = join(data, `${name}.png`);
  const stablePath = join(evidence, `${name}.png`);
  await writeFile(path, await driver.takeScreenshot(), 'base64');
  await copyFile(path, stablePath);
  return stablePath;
}

const texts = (selector) =>
  driver.executeScript(
    'return [...document.querySelectorAll(arguments[0])].map((e) => e.textContent.trim());',
    selector,
  );
const js = (code, ...args) => driver.executeScript(code, ...args);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function toOperator() {
  await driver.switchTo().window(operatorHandle);
}
async function toPublic() {
  await driver.switchTo().window(publicHandle);
}

const operatorRows = () => texts('.cashier-turn .cashier-ticket strong');
const operatorCurrent = async () =>
  (await texts('.cashier-turn.most-recent .cashier-ticket strong'))[0] ?? null;
const publicRows = () => texts('.public-turn strong');
const feedbackText = async () =>
  (await driver.findElement(By.id('ticket-feedback')).getText()).trim();
const dialogOpen = () => js('return Boolean(document.querySelector("dialog[open]"));');

async function expectOperator(expected, label) {
  await toOperator();
  await expectEventually(
    async () => {
      const rows = await operatorRows();
      const current = await operatorCurrent();
      return {
        ok: same(rows, expected) && current === (expected[0] ?? null),
        observed: { rows, current },
      };
    },
    `${label}: el operador no mostró ${JSON.stringify(expected)}`,
  );
}
async function expectPublic(expected, label) {
  await toPublic();
  await expectEventually(
    async () => {
      const rows = await publicRows();
      return { ok: same(rows, expected), observed: rows };
    },
    `${label}: la pública no mostró ${JSON.stringify(expected)}`,
  );
}
async function expectViews(expected, label) {
  await expectOperator(expected, label);
  await expectPublic(expected, label);
  await toOperator();
}

async function loadOperator() {
  await toOperator();
  await driver.get(origin);
  await waitFor(() => driver.findElement(By.id('turn-number')));
  await waitFor(async () => !(await dialogOpen()));
}

async function activeAnnouncements() {
  return (await driver.findElements(By.css('.turn-audio-pendiente, .turn-audio-reproduciendo')))
    .length;
}

async function clearInput() {
  const input = await driver.findElement(By.id('turn-number'));
  await input.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
  await waitFor(async () => (await input.getAttribute('value')) === '', 5000);
  return input;
}

// Calls a ticket through the real capture form. Waits for audio-queue availability first
// (the product rejects calls while 6 announcements are active) and retries while busy.
async function call(entry) {
  await toOperator();
  const deadline = Date.now() + 90000;
  await waitFor(async () => (await activeAnnouncements()) < 5, 50000).catch(() => {});
  const input = await clearInput();
  await input.sendKeys(String(entry));
  const button = await driver.findElement(By.css('.register-button'));
  for (;;) {
    await waitFor(() => button.isEnabled(), 10000);
    await input.sendKeys(Key.ENTER);
    try {
      await waitFor(async () => (await input.getAttribute('value')) === '', 2500);
      return;
    } catch {
      const message = await feedbackText();
      if (/Audio en espera|cola de audio está llena/i.test(message) && Date.now() < deadline) {
        await sleep(2000);
        continue;
      }
      throw new Error(`No se pudo llamar ${entry}: ${message}`);
    }
  }
}

async function rowButton(number, kind) {
  const label =
    kind === 'quitar'
      ? `Quitar de la pantalla el turno ${number}`
      : `Anunciar de nuevo el turno ${number}`;
  const button = await waitFor(() => driver.findElement(By.css(`button[aria-label="${label}"]`)));
  await waitFor(() => button.isEnabled(), 10000);
  return button;
}
async function announcementIds(number) {
  return js(
    `return [...document.querySelectorAll('.cashier-turn')]
      .filter((r) => r.querySelector('.cashier-ticket strong')?.textContent.trim() === arguments[0])
      .flatMap((r) => [...r.querySelectorAll('[data-anuncio-id]')].map((e) => ({
        id: Number(e.dataset.anuncioId),
        estado: [...e.classList].find((c) => c.startsWith('turn-audio-'))?.slice(11),
      })));`,
    number,
  );
}

// Brings the queue to an empty, known state through the real UI (quitar + confirm) after a
// fresh operator load, so no scenario depends on what the previous one left behind.
async function resetState() {
  await loadOperator();
  for (let guard = 0; guard < 12; guard++) {
    const rows = await operatorRows();
    if (!rows.length) break;
    const button = await rowButton(rows[0], 'quitar');
    await button.click();
    await waitFor(
      async () => (await dialogOpen()) || (await operatorRows()).length < rows.length,
      10000,
    );
    if (await dialogOpen()) {
      await driver.findElement(By.css('dialog[open] .modal-actions .button.danger')).click();
    }
    await waitFor(async () => (await operatorRows()).length < rows.length, 10000);
  }
  await expectViews([], 'Estado inicial vacío');
}

async function setupState(numbers) {
  await resetState();
  for (const n of numbers) await call(n);
  await expectViews([...numbers].reverse(), `Preparación ${numbers.join(',')}`);
}

async function scenario(id, title, action) {
  const item = { id, title, status: 'FAIL' };
  const started = Date.now();
  console.log(`> ${id} ${title}`);
  try {
    const result = await action();
    if (!result?.screenshot) throw new Error('El escenario no produjo evidencia');
    item.evidence = result;
    item.status = 'PASS';
  } catch (error) {
    item.error = error.message;
    try {
      item.failureScreenshot = await screenshot(`${id}-failure`);
      item.evidence = { screenshot: item.failureScreenshot };
    } catch {}
    try {
      // Recover the operator tab for the next scenario.
      const handles = await driver.getAllWindowHandles();
      for (const handle of handles)
        if (![operatorHandle, publicHandle].includes(handle)) {
          await driver.switchTo().window(handle);
          await driver.close();
        }
      await loadOperator();
    } catch {}
  } finally {
    item.durationMs = Date.now() - started;
    console.log(`  ${item.status} (${item.durationMs} ms)${item.error ? ` ${item.error}` : ''}`);
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
  const deadline = Date.now() + 45000;
  while (!origin && Date.now() < deadline) {
    try {
      origin = (await readFile(logPath, 'utf8')).match(
        /Navegador local: (http:\/\/127\.0\.0\.1:\d+)/,
      )?.[1];
    } catch {}
    if (!origin) await sleep(250);
  }
  if (!origin) throw new Error(`No se encontró el origen HTTP de Comal; revisar ${hostLogPath}`);

  const options = new chrome.Options().addArguments(
    ...(process.env.QA_HEADED === '1' ? [] : ['--headless=new']),
    '--window-size=1440,1000',
    '--autoplay-policy=no-user-gesture-required',
  );
  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.get(`${origin}/publica`);
  await waitFor(() => driver.findElement(By.css('.public-screen')));
  publicHandle = await driver.getWindowHandle();
  await driver.switchTo().newWindow('tab');
  operatorHandle = await driver.getWindowHandle();
  await loadOperator();

  await scenario('COMAL-QA-001', 'Llamar 42 y sincronizar las vistas', async () => {
    await resetState();
    await call('42');
    await toPublic();
    const number = await expectEventually(async () => {
      const text = (await texts('.announcement-number'))[0] ?? '';
      return { ok: text === '42', observed: text };
    }, 'La tarjeta de anuncio pública no mostró 42');
    await expectPublic(['42'], 'Lista pública');
    const shot = await screenshot('COMAL-QA-001-publica-42');
    await expectOperator(['42'], 'Operador');
    return { screenshot: shot, operatorNumber: '42', publicNumber: number.observed };
  });

  await scenario('COMAL-QA-002', 'Normalización y extremos', async () => {
    await resetState();
    const steps = [
      ['213298', ['98']],
      ['8', ['08', '98']],
      ['00', ['00', '08', '98']],
      ['99', ['99', '00', '08', '98']],
      ['000000', ['00', '99', '08', '98']],
    ];
    const observed = [];
    for (const [entry, expected] of steps) {
      await call(entry);
      await expectViews(expected, `Entrada ${entry}`);
      observed.push({ entry, current: expected[0] });
    }
    await toPublic();
    const publicShot = await screenshot('COMAL-QA-002-publica');
    await toOperator();
    const shot = await screenshot('COMAL-QA-002-operador');
    return { screenshot: shot, publicScreenshot: publicShot, observed };
  });

  await scenario('COMAL-QA-003', 'Rechazar una captura inválida sin mutar el turno', async () => {
    await setupState(['42']);
    const before = await announcementIds('42');
    const attempts = [
      ['abc', 'Captura inválida: usa de 1 a 6 dígitos.'],
      ['', 'Escribe el número del ticket.'],
      ['-42', 'Captura inválida: usa de 1 a 6 dígitos.'],
      ['', 'Escribe el número del ticket.'],
      ['4.2', 'Captura inválida: usa de 1 a 6 dígitos.'],
      ['', 'Escribe el número del ticket.'],
      ['1234567', 'Captura inválida: usa de 1 a 6 dígitos.'],
      ['', 'Escribe el número del ticket.'],
      ['+7', 'Captura inválida: usa de 1 a 6 dígitos.'],
    ];
    const messages = [];
    for (const [entry, expected] of attempts) {
      const input = await clearInput();
      if (entry) await input.sendKeys(entry);
      if (entry) {
        const invalid = await input.getAttribute('aria-invalid');
        if (invalid !== 'true') throw new Error(`"${entry}" no quedó marcado aria-invalid`);
      }
      await input.sendKeys(Key.ENTER);
      const message = await expectEventually(async () => {
        const fb = await driver.findElement(By.id('ticket-feedback'));
        const text = (await fb.getText()).trim();
        const cls = await fb.getAttribute('class');
        return { ok: text === expected && cls.includes('error'), observed: { text, cls } };
      }, `Mensaje para "${entry}"`);
      if ((await input.getAttribute('value')) !== entry)
        throw new Error(`La captura "${entry}" se borró pese a ser inválida`);
      await expectOperator(['42'], `Operador tras "${entry}"`);
      messages.push({ entry, feedback: message.observed.text });
    }
    const after = await announcementIds('42');
    if (!same(before, after))
      throw new Error(`Hubo anuncio con captura inválida: ${JSON.stringify({ before, after })}`);
    const shot = await screenshot('COMAL-QA-003-invalid-capture');
    await expectPublic(['42'], 'Pública tras capturas inválidas');
    await toOperator();
    return { screenshot: shot, attempts: messages, operatorNumber: '42', publicNumber: '42' };
  });

  await scenario('COMAL-QA-004', 'Capacidad visual: actual + 5 anteriores', async () => {
    await resetState();
    const numbers = ['11', '12', '13', '14', '15', '16', '17'];
    for (const [i, n] of numbers.entries()) {
      await call(n);
      await expectOperator(
        numbers
          .slice(0, i + 1)
          .reverse()
          .slice(0, 6),
        `Tras llamar ${n}`,
      );
      if (i === 5) {
        const notice = await js(
          'return document.querySelector(".operator-notices")?.textContent ?? "";',
        );
        if (!notice.includes('Seis turnos visibles'))
          throw new Error(`Sin aviso de capacidad con 6 turnos: ${notice}`);
      }
    }
    const expected = ['17', '16', '15', '14', '13', '12'];
    await expectViews(expected, 'Tras 7 llamados');
    const badge = (await texts('.count-badge'))[0];
    if (badge !== '6') throw new Error(`Contador En pantalla = ${badge}, se esperaba 6`);
    const shot = await screenshot('COMAL-QA-004-operador');
    await toPublic();
    const publicShot = await screenshot('COMAL-QA-004-publica');
    await toOperator();
    return { screenshot: shot, publicScreenshot: publicShot, visible: expected, dropped: '11' };
  });

  await scenario('COMAL-QA-008', 'Repetir el turno actual', async () => {
    await setupState(['98', '42']);
    const before = await waitFor(async () => {
      const ids = await announcementIds('42');
      return ids.length ? ids : false;
    });
    const input = await clearInput();
    await input.sendKeys('42');
    await expectEventually(async () => {
      const hint = (await texts('#call-hint'))[0];
      return { ok: hint === 'Ya está en la TV: solo se repite el anuncio.', observed: hint };
    }, 'Pista de repetición');
    await call('42');
    await expectEventually(async () => {
      const text = await feedbackText();
      return { ok: text === 'Turno 42 en cola de audio de nuevo.', observed: text };
    }, 'Mensaje de repetición');
    await expectViews(['42', '98'], 'Lista tras repetir');
    const after = await expectEventually(async () => {
      const ids = await announcementIds('42');
      return { ok: ids.some((e) => e.id > Math.max(...before.map((b) => b.id))), observed: ids };
    }, 'No se registró un nuevo anuncio del 42');
    const shot = await screenshot('COMAL-QA-008-repeat-current');
    return {
      screenshot: shot,
      previousAnnouncement: before,
      newAnnouncement: after.observed,
      list: ['42', '98'],
    };
  });

  await scenario('COMAL-QA-009', 'Rellamar el anterior', async () => {
    await setupState(['98', '42']);
    const input = await clearInput();
    await input.sendKeys('98');
    await expectEventually(async () => {
      const hint = (await texts('#call-hint'))[0];
      return { ok: hint === 'Está en llamados: vuelve a ser el turno actual.', observed: hint };
    }, 'Pista de rellamado');
    await call('98');
    await expectViews(['98', '42'], 'Tras rellamar 98');
    const shot = await screenshot('COMAL-QA-009-recall-previous');
    return { screenshot: shot, list: ['98', '42'] };
  });

  await scenario('COMAL-QA-010', 'Rellamar un número desplazado', async () => {
    const numbers = ['21', '22', '23', '24', '25', '26', '27'];
    await resetState();
    for (const n of numbers) await call(n);
    await expectViews(['27', '26', '25', '24', '23', '22'], 'Preparación con 21 desplazado');
    const input = await clearInput();
    await input.sendKeys('21');
    await expectEventually(async () => {
      const hint = (await texts('#call-hint'))[0];
      return { ok: hint === 'Turno nuevo.', observed: hint };
    }, 'Pista de turno nuevo');
    await call('21');
    const expected = ['21', '27', '26', '25', '24', '23'];
    await expectViews(expected, 'Tras rellamar 21');
    const shot = await screenshot('COMAL-QA-010-recall-displaced');
    return { screenshot: shot, list: expected, dropped: '22' };
  });

  await scenario('COMAL-QA-011', 'Corregir la última captura sin anunciarla', async () => {
    await resetState();
    await call('42');
    await expectViews(['42'], 'Preparación');
    const before = await announcementIds('42');
    const undo = await driver.findElement(By.css('.undo-row button'));
    await waitFor(() => undo.isEnabled());
    await undo.click();
    await waitFor(() => driver.findElement(By.css('.empty-state')));
    await expectViews([], 'Tras corregir');
    await expectEventually(async () => {
      const enabled = await driver.findElement(By.css('.undo-row button')).isEnabled();
      return { ok: !enabled, observed: { enabled } };
    }, 'Corregir siguió habilitado tras usarlo una vez');
    const ids = await js('return document.querySelectorAll("[data-anuncio-id]").length;');
    if (ids !== 0 || before.length !== 1)
      throw new Error(`Corregir generó anuncios: antes ${before.length}, después ${ids}`);
    const shot = await screenshot('COMAL-QA-011-correct-last-capture');
    return { screenshot: shot, operatorEmpty: true, publicEmpty: true, undoDisabledAfter: true };
  });

  await scenario('COMAL-QA-030', 'Quitar: cancelar conserva, confirmar promueve', async () => {
    await setupState(['98', '42']);
    const undo = () => driver.findElement(By.css('.undo-row button')).isEnabled();
    if (!(await undo())) throw new Error('Precondición: corrección pendiente no disponible');
    await (await rowButton('42', 'quitar')).click();
    const copy = await expectEventually(async () => {
      const text = (await texts('dialog[open] .modal-copy'))[0];
      return { ok: text === 'Se quitará el turno 42 de la pantalla.', observed: text };
    }, 'Diálogo de quitar');
    await driver
      .findElement(By.xpath('//dialog[@open]//button[normalize-space()="Cancelar"]'))
      .click();
    await waitFor(async () => !(await dialogOpen()));
    await expectViews(['42', '98'], 'Tras cancelar');
    if (!(await undo())) throw new Error('Cancelar invalidó la corrección');
    const cancelShot = await screenshot('COMAL-QA-030-cancel');

    await (await rowButton('42', 'quitar')).click();
    await waitFor(() => dialogOpen());
    await driver.findElement(By.css('dialog[open] .modal-actions .button.danger')).click();
    await expectViews(['98'], 'Tras quitar el actual');
    await expectEventually(async () => {
      const enabled = await undo();
      const text = (await texts('.undo-row > span'))[0];
      return {
        ok: !enabled && text === 'No hay una captura pendiente de corrección.',
        observed: { enabled, text },
      };
    }, 'Quitar no invalidó la corrección');
    const shot = await screenshot('COMAL-QA-030-remove-current');

    await call('42');
    await expectViews(['42', '98'], 'Preparación anterior');
    await (await rowButton('98', 'quitar')).click();
    await waitFor(() => dialogOpen());
    await driver.findElement(By.css('dialog[open] .modal-actions .button.danger')).click();
    await expectViews(['42'], 'Tras quitar el anterior');
    if (await undo()) throw new Error('Quitar el anterior no invalidó la corrección');
    const previousShot = await screenshot('COMAL-QA-030-remove-previous');
    return {
      screenshot: shot,
      cancelScreenshot: cancelShot,
      removePreviousScreenshot: previousShot,
      dialog: copy.observed,
    };
  });

  await scenario('COMAL-QA-031', 'No volver a mostrar confirmación durante la sesión', async () => {
    await setupState(['98', '42']);
    await (await rowButton('98', 'quitar')).click();
    await waitFor(() => dialogOpen());
    const checkbox = await driver.findElement(By.css('dialog[open] .session-confirmation input'));
    await checkbox.click();
    if (!(await checkbox.isSelected())) throw new Error('No se marcó "No volver a mostrar"');
    await driver.findElement(By.css('dialog[open] .modal-actions .button.danger')).click();
    await expectViews(['42'], 'Quitar confirmado');

    const before = await announcementIds('42');
    await (await rowButton('42', 'anunciar')).click();
    await sleep(300);
    if (await dialogOpen())
      throw new Error('Anunciar pidió confirmación tras "No volver a mostrar"');
    await expectEventually(async () => {
      const text = await feedbackText();
      const ids = await announcementIds('42');
      const newer = ids.some((e) => e.id > Math.max(0, ...before.map((b) => b.id)));
      return {
        ok: text === 'Turno 42 en cola de audio de nuevo.' && newer,
        observed: { text, ids },
      };
    }, 'Anunciar sin confirmación');

    await call('98');
    await expectViews(['98', '42'], 'Preparación quitar sin confirmación');
    await (await rowButton('42', 'quitar')).click();
    await sleep(300);
    if (await dialogOpen()) throw new Error('Quitar pidió confirmación tras "No volver a mostrar"');
    await expectViews(['98'], 'Quitar sin confirmación');
    const shot = await screenshot('COMAL-QA-031-no-confirmation');

    // A new operator session (page reload) restores the confirmation.
    await loadOperator();
    await (await rowButton('98', 'quitar')).click();
    await expectEventually(async () => {
      const open = await dialogOpen();
      const checked = await js(
        'return document.querySelector("dialog[open] .session-confirmation input")?.checked;',
      );
      return { ok: open && checked === false, observed: { open, checked } };
    }, 'La confirmación no volvió tras reiniciar la sesión del operador');
    const resetShot = await screenshot('COMAL-QA-031-confirmation-restored');
    await driver
      .findElement(By.xpath('//dialog[@open]//button[normalize-space()="Cancelar"]'))
      .click();
    await waitFor(async () => !(await dialogOpen()));
    await expectViews(['98'], 'Cancelar tras reinicio');
    return { screenshot: shot, restoredScreenshot: resetShot, restartedBy: 'recarga del operador' };
  });

  await scenario('COMAL-QA-032', 'Ayuda por teclado: F1 y Escape', async () => {
    await loadOperator();
    const input = await driver.findElement(By.id('turn-number'));
    await input.click();
    const activeId = () => js('return document.activeElement?.id ?? null;');
    if ((await activeId()) !== 'turn-number') throw new Error('Precondición: foco en captura');
    await input.sendKeys(Key.F1);
    await expectEventually(async () => {
      const open = await js(
        'return Boolean(document.querySelector("[data-testid=help-center][open]"));',
      );
      const inside = await js(
        'return Boolean(document.activeElement?.closest("[data-testid=help-center]"));',
      );
      return { ok: open && inside, observed: { open, inside } };
    }, 'F1 no abrió la ayuda con foco dentro');
    // Navigate: open the first topic with the keyboard and verify the article.
    await driver.findElement(By.css('[data-testid=help-center] .help-topic')).sendKeys(Key.ENTER);
    const topic = await expectEventually(async () => {
      const id = await js(
        'return document.querySelector("[data-testid=help-article]")?.dataset.helpTopic ?? null;',
      );
      return { ok: Boolean(id), observed: id };
    }, 'No se abrió un tema de ayuda');
    const shot = await screenshot('COMAL-QA-032-help-open');
    await driver.switchTo().activeElement().sendKeys(Key.ESCAPE);
    await expectEventually(async () => {
      const open = await dialogOpen();
      const id = await activeId();
      return { ok: !open && id === 'turn-number', observed: { open, id } };
    }, 'Escape no cerró la ayuda o no devolvió el foco a la captura');
    const closedShot = await screenshot('COMAL-QA-032-help-closed');
    return { screenshot: shot, closedScreenshot: closedShot, topic: topic.observed };
  });

  await scenario('COMAL-QA-036', 'Tema y escala persisten al recargar', async () => {
    await loadOperator();
    const state = () =>
      js(
        `const d = document.documentElement;
         return { tema: d.dataset.tema, tamanio: d.dataset.tamanio,
                  escala: d.style.getPropertyValue('--ui-scale') };`,
      );
    const initial = await state();
    const sizeButton = (label) => driver.findElement(By.css(`button[aria-label="${label}"]`));
    for (let i = 0; i < 8 && (await sizeButton('Reducir tamaño').isEnabled()); i++)
      await sizeButton('Reducir tamaño').click();
    const min = await state();
    if (min.tamanio !== '70' || min.escala !== '0.7')
      throw new Error(`Mínimo de escala incorrecto: ${JSON.stringify(min)}`);
    for (let i = 0; i < 8 && (await sizeButton('Aumentar tamaño').isEnabled()); i++)
      await sizeButton('Aumentar tamaño').click();
    const max = await state();
    if (max.tamanio !== '130' || max.escala !== '1.3')
      throw new Error(`Máximo de escala incorrecto: ${JSON.stringify(max)}`);
    await sizeButton('Reducir tamaño').click();
    const switchButton = await driver.findElement(By.css('.theme-switch'));
    await switchButton.click();
    const otherTheme = initial.tema === 'morado' ? 'azul' : 'morado';
    const changed = await state();
    if (changed.tema !== otherTheme || changed.tamanio !== '120')
      throw new Error(`Cambio no aplicado: ${JSON.stringify(changed)}`);

    await loadOperator();
    const reloaded = await state();
    const checked = await driver.findElement(By.css('.theme-switch')).getAttribute('aria-checked');
    if (reloaded.tema !== otherTheme || reloaded.tamanio !== '120' || reloaded.escala !== '1.2')
      throw new Error(`No persistió tras recargar: ${JSON.stringify(reloaded)}`);
    if (checked !== String(otherTheme === 'morado'))
      throw new Error(`Interruptor de tema incoherente: aria-checked=${checked}`);
    const shot = await screenshot('COMAL-QA-036-operator-reloaded');

    await toPublic();
    await driver.navigate().refresh();
    await waitFor(() => driver.findElement(By.css('.public-screen')));
    const publicState = await state();
    if (publicState.tema !== otherTheme || publicState.tamanio !== '120')
      throw new Error(`La pública del mismo origen no conservó: ${JSON.stringify(publicState)}`);
    const publicShot = await screenshot('COMAL-QA-036-public-reloaded');

    // Restore defaults so later evidence uses the standard look.
    await loadOperator();
    await js(
      'localStorage.setItem("comal.tema", arguments[0]); localStorage.setItem("comal.tamanio", arguments[1]);',
      initial.tema,
      initial.tamanio,
    );
    await toPublic();
    await driver.navigate().refresh();
    await waitFor(() => driver.findElement(By.css('.public-screen')));
    await loadOperator();
    return { screenshot: shot, publicScreenshot: publicShot, initial, reloaded, publicState };
  });

  await scenario(
    'COMAL-QA-038',
    'HTTP/SSE: dos vistas convergen y se recuperan al recargar',
    async () => {
      await resetState();
      await call('31');
      await call('64');
      await expectViews(['64', '31'], 'Convergencia tras llamar');
      await toPublic();
      await driver.navigate().refresh();
      await waitFor(() => driver.findElement(By.css('.public-screen')));
      await expectPublic(['64', '31'], 'Pública tras recargar');
      const publicShot = await screenshot('COMAL-QA-038-public-reloaded');

      await call('77');
      await expectViews(['77', '64', '31'], 'Convergencia tras recarga');
      await loadOperator();
      await expectOperator(['77', '64', '31'], 'Operador tras recargar');

      await driver.switchTo().newWindow('tab');
      await driver.get(`${origin}/publica`);
      await waitFor(() => driver.findElement(By.css('.public-screen')));
      await expectEventually(async () => {
        const rows = await publicRows();
        return { ok: same(rows, ['77', '64', '31']), observed: rows };
      }, 'Una tercera vista nueva no convergió');
      const shot = await screenshot('COMAL-QA-038-third-view');
      await driver.close();
      await toOperator();
      return { screenshot: shot, publicReloadScreenshot: publicShot, state: ['77', '64', '31'] };
    },
  );

  // COMAL-QA-045: the public footer shows Querétaro weather from open-meteo. The request is
  // answered inside the page (CDP script injected before any app code), so the test needs
  // no Internet and controls the data: valid reading, then a network failure.
  await scenario('COMAL-QA-045', 'Clima en la pantalla pública (respuesta simulada)', async () => {
    const fakeWeather = (mode) => `(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = String(input?.url ?? input);
        if (!url.startsWith('https://api.open-meteo.com/')) return realFetch(input, init);
        window.__qaWeatherRequests = (window.__qaWeatherRequests ?? 0) + 1;
        if (${JSON.stringify(mode)} === 'fail') return Promise.reject(new TypeError('offline'));
        return Promise.resolve(new Response(JSON.stringify({
          current: { temperature_2m: 23.4, weather_code: 0 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      };
    })();`;
    const weatherText = async () => {
      const items = await driver.findElements(By.css('.footer-ticker-item'));
      for (const item of items) {
        const text = await item.getAttribute('textContent');
        if (text.includes('°C')) return text.replace(/\s+/g, ' ').trim();
      }
      return null;
    };
    await driver.switchTo().newWindow('tab');
    let injected = await driver.sendAndGetDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: fakeWeather('ok'),
    });
    await driver.get(`${origin}/publica`);
    await waitFor(() => driver.findElement(By.css('.public-screen')));
    // 23.4 must be rounded to 23 and weather_code 0 described as "Despejado".
    const { observed: shown } = await expectEventually(async () => {
      const text = await weatherText();
      return { ok: /23°C\s*Despejado en Querétaro/.test(text ?? ''), observed: text };
    }, 'El clima simulado (23.4 °C, código 0) no apareció como "23°C Despejado en Querétaro"');
    const requests = await driver.executeScript('return window.__qaWeatherRequests ?? 0');
    if (requests < 1) throw new Error('La vista pública no consultó open-meteo');
    const shot = await screenshot('COMAL-QA-045-weather');

    await driver.sendDevToolsCommand('Page.removeScriptToEvaluateOnNewDocument', {
      identifier: injected.identifier,
    });
    injected = await driver.sendAndGetDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: fakeWeather('fail'),
    });
    await driver.navigate().refresh();
    await waitFor(() => driver.findElement(By.css('.public-screen')));
    await expectEventually(async () => {
      const count = await driver.executeScript('return window.__qaWeatherRequests ?? 0');
      return { ok: count >= 1, observed: count };
    }, 'La vista pública no intentó consultar el clima tras recargar');
    await driver.sleep(500);
    if (await weatherText()) throw new Error('Con la red caída se mostró un clima inventado');
    const clock = await driver.findElement(By.css('.footer-time strong')).getText();
    if (!/\d{1,2}:\d{2}\s?(AM|PM)/i.test(clock))
      throw new Error(`El pie dejó de funcionar sin clima; reloj: "${clock}"`);
    await driver.sendDevToolsCommand('Page.removeScriptToEvaluateOnNewDocument', {
      identifier: injected.identifier,
    });
    await driver.close();
    await toOperator();
    return { screenshot: shot, shown, offlineClock: clock, weatherRequests: requests };
  });

  const failed = report.scenarios.filter((s) => s.status !== 'PASS');
  report.status = failed.length ? 'FAIL' : 'PASS';
  if (failed.length) process.exitCode = 1;
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
  console.log(
    JSON.stringify(
      {
        status: report.status,
        scenarios: report.scenarios.map(({ id, status, durationMs, error }) => ({
          id,
          status,
          durationMs,
          error,
        })),
      },
      null,
      2,
    ),
  );
}
