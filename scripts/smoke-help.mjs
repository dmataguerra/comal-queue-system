import { app, BrowserWindow, shell } from 'electron';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const resultRoot = join(root, 'test-results');
mkdirSync(resultRoot, { recursive: true });
const output = mkdtempSync(join(resultRoot, 'help-'));
process.env.TURNERO_DATOS = join(output, 'datos');
process.env.TURNERO_PUERTO = '0';
mkdirSync(process.env.TURNERO_DATOS);
cpSync(join(root, 'contenido'), join(process.env.TURNERO_DATOS, 'contenido'), { recursive: true });
app.setAppPath(root);
app.setPath('userData', join(output, 'electron'));
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const openedManuals = [];
shell.openPath = async (path) => {
  openedManuals.push(path);
  return '';
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (window, code) => window.webContents.executeJavaScript(code, true);
const testId = (id) => `[data-testid="${id}"]`;
const storageKey = 'comal.ayuda.progreso.v1';
const focusOnly = process.argv.includes('--focus-diagnostics');
const tours = ['llamar', 'corregir', 'multimedia', 'completo'];
const report = { status: 'RUNNING', output, evaluations: [], screenshots: [], bugs: [] };
const save = () => writeFileSync(join(output, 'resultado.json'), JSON.stringify(report, null, 2));
save();
async function wait(check, message, limit = 15000) {
  const start = Date.now();
  while (Date.now() - start < limit) {
    try {
      if (await check()) return;
    } catch {
      /* La vista puede seguir cargando. */
    }
    await pause(80);
  }
  throw new Error(message);
}
async function evaluation(name, fn) {
  const start = Date.now();
  try {
    const evidence = await fn();
    report.evaluations.push({ name, status: 'PASS', elapsedMs: Date.now() - start, evidence });
    save();
    console.log(`PASS: ${name}`);
    return evidence;
  } catch (error) {
    report.evaluations.push({
      name,
      status: 'FAIL',
      error: String(error),
      elapsedMs: Date.now() - start,
    });
    save();
    throw error;
  }
}
async function click(window, selector) {
  assert.ok(
    await run(window, `Boolean(document.querySelector(${JSON.stringify(selector)}))`),
    `Missing ${selector}`,
  );
  await run(window, `document.querySelector(${JSON.stringify(selector)}).click()`);
  await pause(60);
}
async function key(window, keyCode, modifiers = []) {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
  await pause(80);
}
async function nativeClick(window, x, y) {
  for (const type of ['mouseDown', 'mouseUp']) {
    window.webContents.sendInputEvent({
      type,
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1,
    });
  }
  await pause(100);
}
async function input(window, selector, value) {
  await run(
    window,
    `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', {bubbles:true}));
  })()`,
  );
  await pause(80);
}
async function visible(window, id) {
  return run(window, `Boolean(document.querySelector(${JSON.stringify(testId(id))}))`);
}
async function openHelp(window, keyboard = false) {
  if (keyboard) await key(window, 'F1');
  else {
    await run(window, "document.querySelector('.help-button').focus()");
    await click(window, '.help-button');
  }
  await wait(() => visible(window, 'help-center'), 'Help center did not open');
  assert.equal(await run(window, "document.querySelectorAll('dialog[open]').length"), 1);
}
async function closeHelp(window) {
  await key(window, 'Escape');
  await wait(async () => !(await visible(window, 'help-center')), 'Help center did not close');
  await settleFrame(window);
}
async function settleFrame(window) {
  for (let i = 0; i < 2; i++) {
    await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    await pause(60);
  }
}
async function diagnosticFocus(window, transport) {
  await evaluation(
    `${transport}: F1 tour restores visible focus after Diagnostics remount`,
    async () => {
      await openHelp(window);
      await click(window, '.help-diagnostics-link');
      await wait(
        () => run(window, "Boolean(document.querySelector('.diagnostics-panel .button'))"),
        'Diagnostics unavailable',
      );
      await settleFrame(window);
      await run(window, "document.querySelector('.diagnostics-panel .button').focus()");
      const before = await run(window, 'document.activeElement.outerHTML');
      await openHelp(window, true);
      await startTour(window, 'llamar');
      await key(window, 'Escape');
      await wait(
        async () =>
          !(await visible(window, 'help-center')) && !(await visible(window, 'help-tour')),
        'Escape did not dismiss tour',
      );
      await settleFrame(window);
      const valid = () =>
        run(
          window,
          `(()=>{const e=document.activeElement,r=e?.getBoundingClientRect();return Boolean(e?.matches('.help-button,.diagnostics-panel button,#admin-main')&&r.width>0&&r.height>0);})()`,
        );
      await wait(
        valid,
        'Visible logical focus was not restored after original Diagnostics control unmounted: ' +
          JSON.stringify(
            await run(
              window,
              '({active:document.activeElement?.outerHTML?.slice(0,240),visibility:document.visibilityState,hasFocus:document.hasFocus()})',
            ),
          ),
        1500,
      );
      const after = await run(window, 'document.activeElement.outerHTML');
      assert.ok(
        await run(window, "Boolean(document.querySelector('.diagnostics-panel'))"),
        'Originating Diagnostics page not restored',
      );
      await click(window, '[aria-label="Turnos"]');
      return { before, after };
    },
  );
}
async function startTour(window, id) {
  await click(window, testId(`help-tour-start-${id}`));
  await wait(() => visible(window, 'help-tour'), `Tour ${id} did not start`);
  await settleFrame(window);
  const attrs = await run(
    window,
    `(() => {
    const el=document.querySelector(${JSON.stringify(testId('help-tour'))});
    return {id:el.dataset.tourId,index:Number(el.dataset.stepIndex),count:Number(el.dataset.stepCount)};
  })()`,
  );
  assert.equal(attrs.id, id);
  assert.equal(attrs.index, 0);
  assert.ok(attrs.count > 1, `Tour ${id} needs multiple steps`);
  return attrs;
}
async function closeTour(window) {
  await click(window, testId('help-tour-close'));
  await wait(() => visible(window, 'help-center'), 'Help center did not return after tour');
}
async function completeTour(window) {
  for (let attempts = 0; attempts < 40; attempts++) {
    if (!(await visible(window, 'help-tour'))) return;
    const before = await run(
      window,
      `Number(document.querySelector(${JSON.stringify(testId('help-tour'))}).dataset.stepIndex)`,
    );
    await click(window, testId('help-tour-next'));
    await wait(
      async () =>
        !(await visible(window, 'help-tour')) ||
        (await run(
          window,
          `Number(document.querySelector(${JSON.stringify(testId('help-tour'))}).dataset.stepIndex)`,
        )) !== before,
      'Tour next step did not advance',
    );
  }
  throw new Error('Tour never finished');
}
async function invariantSnapshot(window) {
  return run(
    window,
    `window.turnero.obtener().then(({instantanea,config,inventario,entregasAudio,entregaAudio})=>
    ({instantanea,config,inventario,entregasAudio,entregaAudio}))`,
  );
}
function fileSnapshot() {
  const files = {};
  const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
  for (const name of ['estado.json', 'config.json']) {
    const path = join(process.env.TURNERO_DATOS, name);
    files[name] = existsSync(path) ? hash(path) : null;
  }
  function visit(path, relative) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(child, name);
      else files[name] = hash(child);
    }
  }
  visit(join(process.env.TURNERO_DATOS, 'contenido'), 'contenido');
  return files;
}
async function capture(window, name) {
  await run(
    window,
    `document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).forEach(a=>a.finish())`,
  );
  await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
  await pause(180);
  const image = await window.webContents.capturePage(undefined, {
    stayHidden: true,
    stayAwake: true,
  });
  const path = join(output, `${name}.png`);
  writeFileSync(path, image.toPNG());
  report.screenshots.push(path);
  save();
}
async function setAppearance(window, size, purple) {
  const current = await run(window, 'document.documentElement.dataset.tema');
  if ((current === 'morado') !== purple) await click(window, '.theme-switch');
  for (let i = 0; i < 7; i++) {
    const actual = await run(window, 'Number(document.documentElement.dataset.tamanio)');
    if (actual === size) break;
    await click(
      window,
      actual < size ? '[aria-label="Aumentar tamaño"]' : '[aria-label="Reducir tamaño"]',
    );
  }
  assert.equal(await run(window, 'Number(document.documentElement.dataset.tamanio)'), size);
  assert.equal(
    await run(window, 'document.documentElement.dataset.tema'),
    purple ? 'morado' : 'azul',
  );
}
async function assertGeometry(window, tour = false) {
  const result = await run(
    window,
    `(() => {
    const selectors=${JSON.stringify(tour ? [testId('help-tour-card')] : [testId('help-center')])};
    const boxes=selectors.map(s=>{
      const e=document.querySelector(s),r=e?.getBoundingClientRect();
      return {selector:s,exists:Boolean(e),rect:r&&{left:r.left,top:r.top,right:r.right,bottom:r.bottom},
        horizontalOverflow:e?e.scrollWidth>e.clientWidth+2:false};
    });
    const overflow=document.documentElement.scrollWidth>innerWidth+2;
    const offenders=overflow?Array.from(document.querySelectorAll('body *')).map(e=>{
      const r=e.getBoundingClientRect();return {tag:e.tagName,id:e.id,classes:typeof e.className==='string'?e.className:e.className?.baseVal,
        right:r.right,left:r.left,width:r.width,minWidth:getComputedStyle(e).minWidth};
    }).filter(e=>e.width>0&&(e.left< -2||e.right>innerWidth+2)).slice(0,15):[];
    const current=document.querySelector(${JSON.stringify(testId('help-tour'))});
    const target=current?.dataset.tourTarget?document.querySelector(current.dataset.tourTarget):null;
    const card=document.querySelector(${JSON.stringify(testId('help-tour-card'))});
    let targetGeometry=null;
    if(target&&card){
      const r=target.getBoundingClientRect(),c=card.getBoundingClientRect();
      const left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);
      const area=Math.max(0,right-left)*Math.max(0,bottom-top);
      const covered=Math.max(0,Math.min(right,c.right)-Math.max(left,c.left))*Math.max(0,Math.min(bottom,c.bottom)-Math.max(top,c.top));
      if(area>0)targetGeometry={selector:current.dataset.tourTarget,coveredRatio:covered/area,rect:{left,top,right,bottom}};
    }
    return {viewport:[innerWidth,innerHeight],overflow,boxes,offenders,targetGeometry,tour:current?.dataset.tourId,step:current?.dataset.stepIndex};
  })()`,
  );
  assert.equal(result.overflow, false, JSON.stringify(result));
  if (result.targetGeometry)
    assert.ok(
      result.targetGeometry.coveredRatio < 0.995,
      'Tour card entirely hides the real target: ' + JSON.stringify(result),
    );
  for (const box of result.boxes) {
    assert.ok(box.exists, JSON.stringify(result));
    assert.equal(box.horizontalOverflow, false, JSON.stringify(result));
    assert.ok(
      box.rect.left >= -1 &&
        box.rect.top >= -1 &&
        box.rect.right <= result.viewport[0] + 1 &&
        box.rect.bottom <= result.viewport[1] + 1,
      JSON.stringify(result),
    );
  }
  return result;
}
async function exerciseRenderer(window, transport, publicWindow) {
  await wait(
    () => run(window, "Boolean(document.querySelector('#turn-number'))"),
    `${transport} operator unavailable`,
  );
  window.webContents.setBackgroundThrottling(false);
  window.setContentSize(1366, 900);
  const originUrl = window.webContents.getURL();
  await run(window, `localStorage.setItem(${JSON.stringify(storageKey)},'{broken json')`);
  window.reload();
  await wait(
    () => run(window, "Boolean(document.querySelector('#turn-number'))"),
    'Reload did not restore operator',
  );
  await input(window, '#turn-number', '213298');
  await run(window, "document.querySelector('#turn-number').focus()");
  const initialFocus = await run(
    window,
    '({id:document.activeElement?.id,tag:document.activeElement?.tagName,hasFocus:document.hasFocus()})',
  );
  assert.equal(initialFocus.id, 'turn-number', JSON.stringify(initialFocus));
  await evaluation(`${transport}: corrupt progress, F1, search, article and keyboard`, async () => {
    await openHelp(window, true);
    for (const id of tours) {
      assert.match(
        await run(
          window,
          `document.querySelector(${JSON.stringify(testId(`help-progress-${id}`))}).textContent`,
        ),
        /Pendiente/,
      );
    }
    const all = await run(
      window,
      "Array.from(document.querySelectorAll('[data-help-topic]')).map(e=>e.dataset.helpTopic).sort()",
    );
    assert.equal(all.length, 6);
    await input(window, testId('help-search'), 'correccion');
    const plain = await run(
      window,
      "Array.from(document.querySelectorAll('[data-help-topic]')).map(e=>e.dataset.helpTopic).sort()",
    );
    await input(window, testId('help-search'), 'CORRECCIÓN');
    assert.deepEqual(
      await run(
        window,
        "Array.from(document.querySelectorAll('[data-help-topic]')).map(e=>e.dataset.helpTopic).sort()",
      ),
      plain,
    );
    assert.ok(plain.includes('corregir'));
    await input(window, testId('help-search'), 'zzzz-no-existe');
    assert.equal(await run(window, "document.querySelectorAll('[data-help-topic]').length"), 0);
    assert.match(
      await run(
        window,
        `document.querySelector(${JSON.stringify(testId('help-center'))}).textContent`,
      ),
      /sin resultados|no encontramos|no hay resultados/i,
    );
    await input(window, testId('help-search'), '');
    assert.deepEqual(
      await run(
        window,
        "Array.from(document.querySelectorAll('[data-help-topic]')).map(e=>e.dataset.helpTopic).sort()",
      ),
      all,
    );
    await click(window, '[data-help-topic="corregir"]');
    assert.ok(await visible(window, 'help-article'));
    assert.match(
      await run(
        window,
        `document.querySelector(${JSON.stringify(testId('help-article'))}).textContent`,
      ),
      /corregir|deshacer/i,
    );
    await key(window, 'Tab');
    assert.ok(
      await run(
        window,
        `document.querySelector(${JSON.stringify(testId('help-center'))}).contains(document.activeElement)`,
      ),
    );
    await closeHelp(window);
    await wait(
      () => run(window, "document.activeElement?.id==='turn-number'"),
      'F1 help did not restore capture focus: ' +
        JSON.stringify(
          await run(
            window,
            '({active:document.activeElement?.outerHTML?.slice(0,220),hasFocus:document.hasFocus()})',
          ),
        ),
      1500,
    );
    assert.equal(await run(window, "document.querySelector('#turn-number').value"), '213298');
    return { searchResults: all, normalizedResults: plain };
  });
  const baseline = await invariantSnapshot(window);
  const beforeFiles = fileSnapshot();
  await evaluation(
    `${transport}: tours cancel, back/next, complete and no operational effects`,
    async () => {
      for (const id of tours) {
        await openHelp(window);
        const first = await startTour(window, id);
        assert.equal(
          await run(
            window,
            `document.querySelector(${JSON.stringify(testId('help-tour-prev'))}).disabled`,
          ),
          true,
        );
        await click(window, testId('help-tour-next'));
        await wait(
          () =>
            run(
              window,
              `Number(document.querySelector(${JSON.stringify(testId('help-tour'))}).dataset.stepIndex)===1`,
            ),
          'Second tour step missing',
        );
        await click(window, testId('help-tour-prev'));
        assert.equal(
          await run(
            window,
            `Number(document.querySelector(${JSON.stringify(testId('help-tour'))}).dataset.stepIndex)`,
          ),
          0,
        );
        await closeTour(window);
        assert.match(
          await run(
            window,
            `document.querySelector(${JSON.stringify(testId(`help-progress-${id}`))}).textContent`,
          ),
          /Pendiente/,
        );
        await closeHelp(window);
        assert.equal(await run(window, "document.querySelector('#turn-number').value"), '213298');
        assert.ok(
          await run(window, "Boolean(document.querySelector('.new-turn-panel'))"),
          'Previous page was not restored',
        );
        await openHelp(window);
        await startTour(window, id);
        await completeTour(window);
        await wait(() => visible(window, 'help-center'), 'Center missing after completion');
        assert.match(
          await run(
            window,
            `document.querySelector(${JSON.stringify(testId(`help-progress-${id}`))}).textContent`,
          ),
          /Completado/,
        );
        const progress = await run(
          window,
          `JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}))`,
        );
        assert.ok(progress.completados.includes(id));
        await closeHelp(window);
        assert.equal(await run(window, "document.querySelector('#turn-number').value"), '213298');
        assert.deepEqual(await invariantSnapshot(window), baseline, `Tour ${id} changed operation`);
        assert.deepEqual(fileSnapshot(), beforeFiles, `Tour ${id} changed persisted files`);
        report.evaluations.push({
          name: `${transport}: ${id} (${first.count} steps)`,
          status: 'PASS',
        });
      }
      assert.equal(window.webContents.getURL(), originUrl);
      assert.equal(
        await run(
          publicWindow,
          `Boolean(document.querySelector(${JSON.stringify(testId('help-center') + ',' + testId('help-tour'))}))`,
        ),
        false,
      );
      return {
        tours,
        preserved: [
          'queue',
          'configuration',
          'audio deliveries',
          'content files',
          'ticket input',
          'operator page',
        ],
      };
    },
  );
  await evaluation(
    `${transport}: progress survives reload and help close restores trigger`,
    async () => {
      window.reload();
      await wait(
        () => run(window, "Boolean(document.querySelector('.help-button'))"),
        'Reload unavailable',
      );
      await run(window, "document.querySelector('.help-button').focus()");
      await openHelp(window);
      for (const id of tours) {
        assert.match(
          await run(
            window,
            `document.querySelector(${JSON.stringify(testId(`help-progress-${id}`))}).textContent`,
          ),
          /Completado/,
        );
      }
      await closeHelp(window);
      assert.ok(
        await run(window, "document.activeElement===document.querySelector('.help-button')"),
      );
    },
  );
  await evaluation(
    `${transport}: native pointer/keyboard cannot activate operation behind tour`,
    async () => {
      await input(window, '#turn-number', '213298');
      await openHelp(window);
      await startTour(window, 'llamar');
      const before = await invariantSnapshot(window);
      const focusEscaped = await run(
        window,
        `(() => {
      document.querySelector('#turn-number').focus();
      return document.activeElement===document.querySelector('#turn-number');
    })()`,
      );
      assert.equal(focusEscaped, false, 'Background ticket gained focus during tour');
      const point = await run(
        window,
        `(() => {
      const r=document.querySelector('#turn-number').getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`,
      );
      await nativeClick(window, point.x, point.y);
      await key(window, 'Enter');
      assert.deepEqual(
        await invariantSnapshot(window),
        before,
        'Enter or pointer dispatched a real call',
      );
      assert.equal(await run(window, "document.querySelector('#turn-number').value"), '213298');
      for (const modifiers of [[], ['shift'], [], []]) {
        await key(window, 'Tab', modifiers);
        assert.ok(
          await run(
            window,
            `document.querySelector(${JSON.stringify(testId('help-tour'))}).contains(document.activeElement)`,
          ),
          'Keyboard focus escaped tour',
        );
      }
      await key(window, 'Escape');
      await wait(
        async () =>
          !(await visible(window, 'help-tour')) && !(await visible(window, 'help-center')),
        'Escape did not close help and tour',
      );
      await settleFrame(window);
      await wait(
        () => run(window, "document.activeElement===document.querySelector('.help-button')"),
        'Escape did not restore original focus',
        1500,
      );
      assert.deepEqual(await invariantSnapshot(window), before);
    },
  );
  await diagnosticFocus(window, transport);
  await evaluation(
    `${transport}: completed tours accumulate in memory when storage fails`,
    async () => {
      await run(window, `localStorage.removeItem(${JSON.stringify(storageKey)})`);
      window.reload();
      await wait(
        () => run(window, "Boolean(document.querySelector('#turn-number'))"),
        'Storage test reload unavailable',
      );
      await run(
        window,
        `(() => {
      const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem;
      Storage.prototype.getItem=function(key){if(key===${JSON.stringify(storageKey)})throw new Error('QA storage blocked');return originalGet.call(this,key)};
      Storage.prototype.setItem=function(key,value){if(key===${JSON.stringify(storageKey)})throw new Error('QA storage blocked');return originalSet.call(this,key,value)};
      window.__qaRestoreStorage=()=>{Storage.prototype.getItem=originalGet;Storage.prototype.setItem=originalSet;};
    })()`,
      );
      try {
        for (const id of ['llamar', 'corregir']) {
          await openHelp(window);
          await startTour(window, id);
          await completeTour(window);
          await closeHelp(window);
        }
        await openHelp(window);
        for (const id of ['llamar', 'corregir']) {
          assert.match(
            await run(
              window,
              `document.querySelector(${JSON.stringify(testId(`help-progress-${id}`))}).textContent`,
            ),
            /Completado/,
            `Completed ${id} disappeared from current session when storage was blocked`,
          );
        }
        await closeHelp(window);
      } finally {
        await run(window, 'window.__qaRestoreStorage();delete window.__qaRestoreStorage;');
      }
      assert.equal(
        await run(window, `localStorage.getItem(${JSON.stringify(storageKey)})`),
        null,
        'Storage unexpectedly persisted',
      );
      return {
        accumulatedInMemory: ['llamar', 'corregir'],
        persistentStorage: 'unavailable intentionally',
      };
    },
  );
  await evaluation(
    `${transport}: a missing tour target offers fallback and still exits`,
    async () => {
      await run(
        window,
        `(() => {
      const el=document.querySelector('[data-help="corregir"]');
      window.__qaMissingTarget=el;
      el.removeAttribute('data-help');
    })()`,
      );
      try {
        await openHelp(window);
        await startTour(window, 'corregir');
        await wait(
          () => run(window, "Boolean(document.querySelector('.help-tour-fallback'))"),
          'Missing target did not offer fallback',
        );
        await assertGeometry(window, true);
        await capture(window, `${transport}-missing-target`);
        await click(window, testId('help-tour-next'));
        await closeTour(window);
        await closeHelp(window);
      } finally {
        await run(
          window,
          "window.__qaMissingTarget?.setAttribute('data-help','corregir');delete window.__qaMissingTarget;",
        );
      }
    },
  );
  await evaluation(
    `${transport}: responsive help and tours, both themes and seven scales`,
    async () => {
      const matrix = [];
      const dimensions =
        transport === 'desktop'
          ? [
              [1366, 900],
              [900, 600],
            ]
          : [
              [1366, 900],
              [900, 600],
              [480, 720],
              [390, 720],
            ];
      window.setMinimumSize(360, 400);
      for (const [width, height] of dimensions) {
        window.setContentSize(width, height);
        for (const purple of [false, true]) {
          for (const size of [70, 80, 90, 100, 110, 120, 130]) {
            await setAppearance(window, size, purple);
            await openHelp(window);
            const center = await assertGeometry(window);
            await startTour(window, 'completo');
            const tour = await assertGeometry(window, true);
            if (size === 130) {
              window.setContentSize(width + 20, height + 20);
              await settleFrame(window);
              await assertGeometry(window, true);
              window.setContentSize(width, height);
            }
            if ([70, 130].includes(size)) {
              await capture(
                window,
                `${transport}-${width}-${height}-${purple ? 'morado' : 'azul'}-${size}-tour`,
              );
            }
            if (size === 130 && [900, 480, 390].includes(width)) {
              const count = await run(
                window,
                `Number(document.querySelector(${JSON.stringify(testId('help-tour'))}).dataset.stepCount)`,
              );
              for (let step = 1; step < count; step++) {
                await click(window, testId('help-tour-next'));
                await settleFrame(window);
                await assertGeometry(window, true);
                if (step >= 5)
                  await capture(
                    window,
                    `${transport}-${width}-${height}-${purple ? 'morado' : 'azul'}-${size}-multimedia-step-${step}`,
                  );
              }
            }
            await closeTour(window);
            if ([70, 130].includes(size)) {
              await capture(
                window,
                `${transport}-${width}-${height}-${purple ? 'morado' : 'azul'}-${size}-center`,
              );
              if (size === 130 && [900, 480, 390].includes(width)) {
                await run(
                  window,
                  `(()=>{const el=document.querySelector(${JSON.stringify(testId('help-center'))});el.scrollTop=el.scrollHeight;})()`,
                );
                await settleFrame(window);
                const reachable = await run(
                  window,
                  `(()=>{const d=document.querySelector(${JSON.stringify(testId('help-center'))}),b=d.querySelector('[aria-label="Cerrar"]'),r=b.getBoundingClientRect(),p=d.getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1;})()`,
                );
                assert.ok(reachable, 'Help close control disappeared while scrolling');
                await capture(
                  window,
                  `${transport}-${width}-${height}-${purple ? 'morado' : 'azul'}-${size}-center-bottom`,
                );
              }
            }
            await closeHelp(window);
            matrix.push({ width, height, size, theme: purple ? 'morado' : 'azul', center, tour });
          }
        }
      }
      window.setContentSize(1366, 900);
      await setAppearance(window, 100, false);
      return { cases: matrix.length, matrix };
    },
  );
  await evaluation(
    `${transport}: reduced motion and cancellation preserve originating Multimedia page`,
    async () => {
      window.webContents.debugger.attach('1.3');
      await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
      assert.ok(await run(window, "matchMedia('(prefers-reduced-motion: reduce)').matches"));
      await click(window, '[aria-label="Multimedia"]');
      await wait(
        () => run(window, "Boolean(document.querySelector('#youtube-url'))"),
        'Multimedia draft input missing',
      );
      const draft = 'https://www.youtube.com/watch?v=qa-draft-no-aplicar';
      await input(window, '#youtube-url', draft);
      const savedConfig = (await invariantSnapshot(window)).config;
      await openHelp(window);
      await startTour(window, 'llamar');
      await assertGeometry(window, true);
      await capture(window, `${transport}-reduced-motion-tour`);
      await closeTour(window);
      await closeHelp(window);
      assert.ok(
        await run(
          window,
          "document.querySelector('[aria-label=\"Multimedia\"]').getAttribute('aria-current')==='page'",
        ),
        'Tour did not restore originating Multimedia page',
      );
      assert.equal(
        await run(window, "document.querySelector('#youtube-url').value"),
        draft,
        'Tour cancellation discarded unapplied YouTube draft',
      );
      await openHelp(window);
      await startTour(window, 'completo');
      await completeTour(window);
      await closeHelp(window);
      assert.equal(
        await run(window, "document.querySelector('#youtube-url').value"),
        draft,
        'Completing full tour discarded unapplied YouTube draft',
      );
      await openHelp(window);
      await startTour(window, 'llamar');
      await key(window, 'Escape');
      await wait(
        async () =>
          !(await visible(window, 'help-tour')) && !(await visible(window, 'help-center')),
        'Escape did not leave tour',
      );
      await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
      assert.equal(
        await run(window, "document.querySelector('#youtube-url').value"),
        draft,
        'Escape discarded unapplied YouTube draft',
      );
      assert.deepEqual(
        (await invariantSnapshot(window)).config,
        savedConfig,
        'Tutorial applied the YouTube draft',
      );
      await click(window, '[aria-label="Turnos"]');
      await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
      });
      window.webContents.debugger.detach();
    },
  );
}
async function verify() {
  try {
    await import('../build/main/main.js');
    await wait(
      () =>
        BrowserWindow.getAllWindows().filter(
          (w) =>
            /\/views\/(operator|display)\//.test(w.webContents.getURL()) &&
            !w.webContents.isLoading(),
        ).length === 2,
      'Desktop views unavailable',
    );
    const desktop = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/operator/'),
    );
    const publicWindow = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/display/'),
    );
    publicWindow.webContents.setAudioMuted(true);
    await wait(
      () => run(desktop, "Boolean(document.querySelector('#turn-number'))"),
      'Desktop input unavailable',
    );
    await run(desktop, "window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})");
    await wait(
      async () => {
        const s = await run(desktop, 'window.turnero.obtener()');
        return (
          s.entregasAudio?.length &&
          s.entregasAudio.every((a) => !['pendiente', 'reproduciendo'].includes(a.estado))
        );
      },
      'Seed test announcement did not settle',
      35000,
    );
    let origin;
    await wait(() => {
      const log = readFileSync(join(process.env.TURNERO_DATOS, 'turnero.log'), 'utf8');
      origin = log.match(/Navegador local: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      return Boolean(origin);
    }, 'Ephemeral HTTP server unavailable');
    const browser = new BrowserWindow({
      show: false,
      width: 1366,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
    await browser.loadURL(`${origin}/`);
    if (focusOnly) {
      await wait(
        () => run(browser, "Boolean(document.querySelector('.help-button'))"),
        'HTTP help unavailable',
      );
      await diagnosticFocus(desktop, 'desktop');
      await diagnosticFocus(browser, 'browser');
      report.status = 'PASS';
      report.scope = 'Targeted Diagnostics focus regression only; full matrix not run.';
      save();
      app.exit(0);
      return;
    }
    await exerciseRenderer(desktop, 'desktop', publicWindow);
    await run(desktop, "window.turnero.despachar({tipo:'QUITAR',n:42})");
    await exerciseRenderer(browser, 'browser', publicWindow);
    await evaluation('public display: PDF opening capability is rejected', async () => {
      const error = await run(
        publicWindow,
        'window.turnero.abrirManual().then(()=>null,e=>e.message)',
      );
      assert.ok(error, 'Public display unexpectedly opened manual');
      assert.equal(openedManuals.length, 0);
      return { rejection: error };
    });
    await evaluation(
      'desktop: PDF API opens exact packaged bytes through managed local path',
      async () => {
        const expected = createHash('sha256')
          .update(readFileSync(join(root, 'output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf')))
          .digest('hex');
        await openHelp(desktop);
        await click(desktop, testId('help-pdf'));
        await wait(() => openedManuals.length === 1, 'PDF was not passed to the native opener');
        const path = openedManuals[0];
        assert.ok(path.endsWith('.pdf'));
        assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), expected);
        assert.equal(readFileSync(path).subarray(0, 5).toString(), '%PDF-');
        await closeHelp(desktop);
        return {
          path,
          sha256: expected,
          nativeReader: 'intercepted intentionally; actual OS association not tested',
        };
      },
    );
    await evaluation(
      'browser: PDF fetch and download work from the local HTTP server',
      async () => {
        const downloadPath = join(output, 'manual-descargado.pdf');
        let done = false;
        let downloadError;
        const onDownload = (_event, item) => {
          item.setSavePath(downloadPath);
          item.once('done', (_e, state) => {
            downloadError = state === 'completed' ? null : state;
            done = true;
          });
        };
        browser.webContents.session.on('will-download', onDownload);
        await openHelp(browser);
        await click(browser, testId('help-pdf'));
        await wait(() => done, 'PDF download did not complete');
        browser.webContents.session.removeListener('will-download', onDownload);
        assert.equal(downloadError, null);
        assert.equal(
          createHash('sha256').update(readFileSync(downloadPath)).digest('hex'),
          createHash('sha256')
            .update(readFileSync(join(root, 'output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf')))
            .digest('hex'),
        );
        await closeHelp(browser);
        return { downloadPath };
      },
    );
    report.status = 'PASS';
    report.limitations = [
      'Physical PDF reader association and a packaged NSIS installer are outside this source smoke run.',
    ];
    save();
    console.log(`PASS: help evals and screenshots in ${output}`);
    app.exit(0);
  } catch (error) {
    report.status = 'FAIL';
    report.error = String(error?.stack ?? error);
    for (const [index, window] of BrowserWindow.getAllWindows().entries()) {
      try {
        if (window.webContents.getURL().includes('/operator/'))
          await capture(window, `failure-operator-${index}`);
      } catch {
        /* Si tampoco se puede capturar la ventana, se conserva el error original. */
      }
    }
    save();
    console.error(error);
    app.exit(1);
  }
}
void verify();
