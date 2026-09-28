import { app, BrowserWindow, ipcMain, powerSaveBlocker, powerMonitor } from 'electron';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Jornada de resistencia: 390 minutos reales, sin modificar relojes ni temporizadores.
const root = fileURLToPath(new URL('../', import.meta.url));
const results = join(root, 'test-results');
mkdirSync(results, { recursive: true });
const data = mkdtempSync(join(results, 'full-day-'));
const reportPath = join(data, 'jornada-completa.json');
const metricsPath = join(data, 'metricas.csv');
const actionsPath = join(data, 'acciones.jsonl');
const realNow = Date.now;
const durationMs = 390 * 60_000;
const preflight = process.argv.includes('--preflight');
let started;
let operatorWindow;
let displayWindow;
let blocker;
let nextSample = 0;
const expectedAudio = new Map();
const receivedAudio = new Map();
process.env.TURNERO_DATOS = data;
app.setAppPath(root);
app.setPath('userData', join(data, 'electron'));

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = async (window, source) => {
  let timeout;
  try {
    return await Promise.race([
      window.webContents.executeJavaScript(source, true),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('La vista no respondió en 15 segundos.')),
          15_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
};
const report = {
  startedAt: new Date(realNow()).toISOString(),
  mode: preflight ? 'preflight' : 'real-time',
  status: 'RUNNING',
  targetMinutes: preflight ? null : 390,
  elapsedMinutes: 0,
  samples: [],
  calls: 0,
  repeats: 0,
  corrections: 0,
  expirations: 0,
  batchesOfSix: 0,
  maxAudioSources: 0,
  publicReloads: [],
  audioProbeEpochs: [],
  logBytes: 0,
  logRotations: 0,
  actions: [],
  invariants: [],
  announcements: [],
  failures: [],
  byStage: {},
  byHour: {},
  actionEffects: {},
  latencyMs: [],
  maxQueueLength: 0,
  limitations: [
    'La latencia de despacho no mide el tiempo hasta oír el audio.',
    'La carga es sintética y reproducible; no representa afluencia medida en cafetería.',
  ],
};

function checkpoint() {
  report.elapsedMinutes = started === undefined ? 0 : (performance.now() - started) / 60_000;
  report.updatedAt = new Date().toISOString();
  report.audioDelivery = { expected: expectedAudio.size, received: receivedAudio.size };
  report.metricsSummary = summarizeMetrics();
  report.latencySummary = summarizeLatencies();
  writeMetricsCsv();
  writeFileSync(reportPath + '.tmp', JSON.stringify(report, null, 2) + '\n');
  renameSync(reportPath + '.tmp', reportPath);
}

async function heartbeat() {
  assert.equal(report.failures.length, 0, 'Se detectó un cierre, suspensión o caída de proceso.');
  for (const [id, expected] of expectedAudio) {
    const received = receivedAudio.get(id);
    if (received) {
      assert.equal(received.n, expected.n, 'El acuse no corresponde al número anunciado.');
      assert.equal(received.estado, 'reproducido', 'Falló un anuncio de audio.');
    } else {
      assert.ok(
        performance.now() - expected.at < 120_000,
        'Un anuncio lleva más de 120 segundos sin confirmación.',
      );
    }
  }
  await verifyAudio(displayWindow);
  if (performance.now() >= nextSample) {
    await checkInvariants(operatorWindow, 'periodica');
    sample('periodica');
    const diagnostic = await run(operatorWindow, 'window.turnero.diagnostico()');
    assert.equal(diagnostic.persistencia, 'correcta');
    assert.notEqual(diagnostic.audio, 'degradado');
    report.finalDiagnostic = diagnostic;
    checkpoint();
    console.log(
      `Progreso: ${report.elapsedMinutes.toFixed(1)}/390 min; anuncios ${receivedAudio.size}/${expectedAudio.size}; informe: ${reportPath}`,
    );
    nextSample = performance.now() + 60_000;
  }
}

async function waitUntil(deadline) {
  while (performance.now() < deadline) {
    await heartbeat();
    await pause(Math.min(1000, Math.max(0, deadline - performance.now())));
  }
}

let temperatureUnavailable = process.platform !== 'win32';
function readTemperatureC() {
  if (temperatureUnavailable) return null;
  try {
    const output = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '(Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction Stop | Measure-Object CurrentTemperature -Average).Average / 10 - 273.15',
      ],
      { encoding: 'utf8', timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    const value = Number(output);
    return Number.isFinite(value) ? Number(value.toFixed(1)) : null;
  } catch (error) {
    temperatureUnavailable = true;
    report.temperatureStatus = {
      available: false,
      reason: String(error.stderr || error.message).trim(),
    };
    console.warn('Temperatura no disponible; se omite esta medición durante el resto del test.');
    return null;
  }
}

function sample(stage) {
  const metrics = app.getAppMetrics();
  const own = metrics.find((metric) => metric.pid === process.pid) ?? metrics[0];
  const cpuPercent = metrics.reduce(
    (total, metric) => total + (metric.cpu?.percentCPUUsage ?? 0),
    0,
  );
  const memoryWorkingSetKb = metrics.reduce(
    (total, metric) => total + (metric.memory?.workingSetSize ?? 0),
    0,
  );
  const logFiles = ['turnero.log', ...Array.from({ length: 5 }, (_, i) => `turnero.log.${i + 1}`)];
  const logBytes = logFiles.reduce((total, file) => {
    try {
      return total + statSync(join(data, file)).size;
    } catch {
      return total;
    }
  }, 0);
  report.logBytes = Math.max(report.logBytes, logBytes);
  report.logRotations = Math.max(
    report.logRotations,
    logFiles.slice(1).filter((file) => {
      try {
        return statSync(join(data, file)).isFile();
      } catch {
        return false;
      }
    }).length,
  );
  report.samples.push({
    stage,
    at: new Date().toISOString(),
    cpuPercent,
    mainCpuPercent: own?.cpu?.percentCPUUsage ?? null,
    memoryWorkingSetKb,
    processCount: metrics.length,
    temperatureC: readTemperatureC(),
    logBytes,
  });
}

async function waitForWindows() {
  for (let attempt = 0; attempt < 150; attempt++) {
    const windows = BrowserWindow.getAllWindows();
    const operator = windows.find((window) => window.webContents.getURL().includes('/operador/'));
    const publicWindow = windows.find((window) =>
      window.webContents.getURL().includes('/publica/'),
    );
    if (
      operator &&
      publicWindow &&
      !operator.webContents.isLoading() &&
      !publicWindow.webContents.isLoading() &&
      (await run(operator, "Boolean(document.querySelector('#turn-number'))")) &&
      (await run(publicWindow, "Boolean(document.querySelector('.public-screen'))"))
    )
      return { operator, publicWindow };
    await pause(100);
  }
  throw new Error('Las vistas no iniciaron dentro del tiempo esperado.');
}

async function dispatch(operator, action) {
  const started = performance.now();
  const result = await run(operator, `window.turnero.despachar(${JSON.stringify(action)})`);
  const elapsedMs = Number((performance.now() - started).toFixed(1));
  if (action.tipo === 'LLAMAR') report.calls++;
  report.actions.push({
    at: new Date().toISOString(),
    action,
    effect: result.efecto,
    announcement: result.anuncio,
    elapsedMs,
    queueLength: result.instantanea.llamados.length + (result.instantanea.actual === null ? 0 : 1),
  });
  report.actionEffects[result.efecto ?? 'SIN_EFECTO'] =
    (report.actionEffects[result.efecto ?? 'SIN_EFECTO'] ?? 0) + 1;
  report.latencyMs.push(elapsedMs);
  report.maxQueueLength = Math.max(
    report.maxQueueLength,
    result.instantanea.llamados.length + (result.instantanea.actual === null ? 0 : 1),
  );
  appendAction({ action, result, elapsedMs });
  if (result.anuncio)
    expectedAudio.set(result.anuncio.id, { n: result.anuncio.n, at: performance.now() });
  return result;
}

async function dispatchBatch(operator, actions) {
  const results = await Promise.all(actions.map((action) => dispatch(operator, action)));
  report.batchesOfSix++;
  return results;
}

function appendAction(entry) {
  writeFileSync(actionsPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, {
    flag: 'a',
  });
}

async function checkInvariants(operator, stage) {
  const inicial = await run(operator, 'window.turnero.obtener()');
  const instantanea = inicial.instantanea;
  const visibles = [instantanea.actual, ...instantanea.llamados].filter((n) => n !== null);
  const invariant = {
    stage,
    queueLength: visibles.length,
    unique: new Set(visibles).size === visibles.length,
    bounded: visibles.length <= 6,
    validNumbers: visibles.every((n) => Number.isInteger(n) && n >= 0 && n <= 99),
    persisted: !instantanea.persistencia,
  };
  report.invariants.push(invariant);
  assert.equal(invariant.unique, true, `La cola tiene turnos duplicados en ${stage}.`);
  assert.equal(invariant.bounded, true, `La cola excede seis turnos en ${stage}.`);
  assert.equal(invariant.validNumbers, true, `La cola tiene un turno inválido en ${stage}.`);
  assert.equal(invariant.persisted, true, `La persistencia falló en ${stage}.`);
}

async function advance(minutes) {
  await waitUntil(performance.now() + minutes * 60_000);
}

function stageStats(stage, fromAction) {
  const actions = report.actions.slice(fromAction);
  const queues = actions.map((item) => item.queueLength);
  const calls = actions.filter((item) => item.action.tipo === 'LLAMAR');
  const stats = {
    at: new Date().toISOString(),
    actions: actions.length,
    calls: calls.length,
    invalid: calls.filter((item) => item.effect === 'CAPTURA_INVALIDA').length,
    announcements: calls.filter((item) => item.effect === 'ANUNCIAR').length,
    averageQueueLength: queues.length
      ? Number((queues.reduce((sum, value) => sum + value, 0) / queues.length).toFixed(2))
      : 0,
    maxQueueLength: queues.length ? Math.max(...queues) : 0,
  };
  report.byStage[stage] = stats;
  return stats;
}

function recordHour(hourLabel, fromAction) {
  const stats = stageStats(`hora-${hourLabel}`, fromAction);
  report.byHour[hourLabel] = stats;
}

async function installAudioProbe(publicWindow) {
  return run(
    publicWindow,
    `(() => {
      if (window.__jornadaAudio) return window.__jornadaAudio;
      const original = AudioContext.prototype.createBufferSource;
      window.__jornadaAudio = { active: 0, max: 0, starts: 0, ends: 0 };
      window.__jornadaAnnouncements = [];
      let visible = false;
      new MutationObserver(() => {
        const element = document.querySelector('.announcement-number');
        const isVisible = Boolean(element);
        const value = element?.textContent?.trim();
        if (isVisible && !visible && value) {
          window.__jornadaAnnouncements.push({ value, at: performance.now() });
        }
        visible = isVisible;
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
      AudioContext.prototype.createBufferSource = function() {
        const source = original.call(this);
        const finish = () => {
          if (source.__jornadaFinished) return;
          source.__jornadaFinished = true;
          window.__jornadaAudio.active--;
          window.__jornadaAudio.ends++;
        };
        const start = source.start.bind(source);
        source.start = (...args) => {
          window.__jornadaAudio.active++;
          window.__jornadaAudio.starts++;
          window.__jornadaAudio.max = Math.max(window.__jornadaAudio.max, window.__jornadaAudio.active);
          return start(...args);
        };
        source.addEventListener('ended', finish, { once: true });
        return source;
      };
      return window.__jornadaAudio;
    })()`,
  );
}

async function verifyAudio(publicWindow) {
  let state;
  try {
    state = await run(publicWindow, 'window.__jornadaAudio');
  } catch (error) {
    if (publicWindow.isDestroyed() || publicWindow.webContents.isCrashed()) throw error;
  }
  if (!state) {
    const ready = await waitForPublicPage(publicWindow);
    assert.ok(ready, 'La pantalla pública no se recuperó tras una recarga.');
    state = await installAudioProbe(publicWindow);
    report.publicReloads.push({
      at: new Date().toISOString(),
      elapsedMinutes: report.elapsedMinutes,
    });
    checkpoint();
  }
  report.audioProbe = state;
  report.maxAudioSources = Math.max(report.maxAudioSources, state.max);
  assert.ok(state.max <= 1, `Se superpusieron fuentes de audio: máximo ${state.max}.`);
}

async function waitForPublicPage(publicWindow) {
  const deadline = performance.now() + 15_000;
  while (performance.now() < deadline) {
    if (publicWindow.isDestroyed() || publicWindow.webContents.isCrashed()) return false;
    try {
      if (
        !publicWindow.webContents.isLoading() &&
        (await run(publicWindow, "Boolean(document.querySelector('.public-screen'))"))
      )
        return true;
    } catch {
      // La navegación puede reemplazar el contexto durante la consulta.
    }
    await pause(100);
  }
  return false;
}

function summarizeMetrics() {
  const numeric = (name) => report.samples.map((sample) => sample[name]).filter(Number.isFinite);
  const summary = {};
  for (const name of ['cpuPercent', 'memoryWorkingSetKb', 'temperatureC', 'logBytes']) {
    const values = numeric(name).sort((a, b) => a - b);
    if (!values.length) {
      summary[name] = { samples: 0, min: null, max: null, average: null, p95: null };
      continue;
    }
    summary[name] = {
      samples: values.length,
      min: values[0],
      max: values.at(-1),
      average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
      p95: values[Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)],
    };
  }
  return summary;
}

function summarizeLatencies() {
  const values = [...report.latencyMs].sort((a, b) => a - b);
  if (!values.length) return { samples: 0, min: null, max: null, average: null, p95: null };
  return {
    samples: values.length,
    min: values[0],
    max: values.at(-1),
    average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
    p95: values[Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)],
  };
}

function readLogSummary() {
  const files = ['turnero.log', ...Array.from({ length: 5 }, (_, i) => `turnero.log.${i + 1}`)];
  const summary = { files: [], lines: 0, errors: 0, warnings: 0, invalidJsonLines: 0 };
  for (const file of files) {
    try {
      const lines = readFileSync(join(data, file), 'utf8').split(/\r?\n/).filter(Boolean);
      summary.files.push({ file, bytes: statSync(join(data, file)).size, lines: lines.length });
      for (const line of lines) {
        summary.lines++;
        try {
          const entry = JSON.parse(line);
          if (entry.nivel === 'error') summary.errors++;
          if (entry.nivel === 'warning') summary.warnings++;
        } catch {
          summary.invalidJsonLines++;
        }
      }
    } catch {
      // A missing rotated file is expected.
    }
  }
  return summary;
}

function writeMetricsCsv() {
  const columns = [
    'stage',
    'at',
    'cpuPercent',
    'mainCpuPercent',
    'memoryWorkingSetKb',
    'processCount',
    'temperatureC',
    'logBytes',
  ];
  writeFileSync(
    metricsPath,
    `${columns.join(',')}\n${report.samples.map((sample) => columns.map((column) => JSON.stringify(sample[column] ?? '')).join(',')).join('\n')}\n`,
  );
}

async function verify() {
  try {
    console.log(`Preparando contenido aislado; evidencia en ${reportPath}`);
    // La resistencia requiere un inventario listo, no probar la instalación inicial.
    // Copia directa a una carpeta nueva; si falla, no se inicia Electron.
    cpSync(join(root, 'contenido'), join(data, 'contenido'), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    checkpoint();
    app.on('child-process-gone', (_event, details) => {
      if (details.reason !== 'clean-exit')
        report.failures.push({ process: details.type, reason: details.reason });
    });
    await import('../build/main/main.js');
    const { operator, publicWindow } = await waitForWindows();
    operatorWindow = operator;
    displayWindow = publicWindow;
    for (const window of [operator, publicWindow]) {
      window.webContents.on('render-process-gone', (_event, details) =>
        report.failures.push(details),
      );
      window.on('closed', () =>
        report.failures.push({ error: 'Ventana cerrada durante la jornada.' }),
      );
    }
    blocker = powerSaveBlocker.start('prevent-display-sleep');
    powerMonitor.on('suspend', () =>
      report.failures.push({ error: 'El equipo se suspendió: jornada interrumpida.' }),
    );
    ipcMain.on('turnero:anuncio:acuse', (event, id, n, estado) => {
      if (event.sender !== publicWindow.webContents) return;
      const entry = { id, n, estado, at: new Date().toISOString() };
      if (estado !== 'reproduciendo') receivedAudio.set(id, entry);
      appendAction({ audioReceipt: entry });
    });
    operator.webContents.setBackgroundThrottling(false);
    publicWindow.webContents.setBackgroundThrottling(false);
    await installAudioProbe(publicWindow);
    await checkInvariants(operator, 'inicio');
    const initial = await run(operator, 'window.turnero.obtener()');
    assert.ok(
      initial.inventario.aviso &&
        initial.inventario.voz.length === 100 &&
        initial.inventario.voz.every(Boolean),
      'Preparación incompleta: se requieren aviso y 100 voces. Consulte turnero.log.',
    );
    const readyDeadline = performance.now() + 30_000;
    do {
      report.environment = await run(operator, 'window.turnero.diagnostico()');
      if (report.environment.audio === 'correcto') break;
      await pause(250);
    } while (performance.now() < readyDeadline);
    assert.equal(
      report.environment.audio,
      'correcto',
      `La precarga de audio no terminó correctamente: ${report.environment.ultimoErrorAplicacion ?? 'consulte turnero.log'}`,
    );
    report.environment = await run(operator, 'window.turnero.diagnostico()');
    if (!report.environment.videosValidos)
      report.limitations.push(
        'No hay videos locales: esta ejecución no valida reproducción prolongada de video.',
      );
    started = performance.now();
    report.startedAt = new Date().toISOString();
    report.expectedFinishAt = new Date(realNow() + durationMs).toISOString();
    sample('inicio');
    checkpoint();
    if (preflight) {
      await dispatchBatch(
        operator,
        [0, 8, 99, 10, 20, 30].map((n) => ({ tipo: 'LLAMAR', entrada: String(n) })),
      );
      const deadline = performance.now() + 120_000;
      while (receivedAudio.size < expectedAudio.size) {
        assert.ok(performance.now() < deadline, 'Faltan acuses en la comprobación previa.');
        await waitUntil(performance.now() + 1000);
      }
      await heartbeat();
      await checkInvariants(operator, 'preflight');
      report.audioProbe = await run(publicWindow, 'window.__jornadaAudio');
      assert.ok(report.audioProbe.starts > 0);
      assert.equal(report.audioProbe.active, 0);
      assert.equal(report.audioProbe.starts, report.audioProbe.ends);
      publicWindow.webContents.reloadIgnoringCache();
      assert.ok(
        await waitForPublicPage(publicWindow),
        'La pantalla no volvió después de recargar.',
      );
      await verifyAudio(publicWindow);
      const postReload = await dispatch(operator, { tipo: 'LLAMAR', entrada: '31' });
      assert.equal(postReload.efecto, 'ANUNCIAR');
      const reloadDeadline = performance.now() + 30_000;
      while (!receivedAudio.has(postReload.anuncio.id)) {
        assert.ok(performance.now() < reloadDeadline, 'El audio no se recuperó tras la recarga.');
        await waitUntil(performance.now() + 500);
      }
      await verifyAudio(publicWindow);
      assert.ok(report.audioProbe.starts > 0, 'El audio no arrancó tras la recarga.');
      assert.equal(report.audioProbe.starts, report.audioProbe.ends);
      report.status = 'PREFLIGHT_PASS';
      report.finishedAt = new Date().toISOString();
      checkpoint();
      console.log(
        `PREFLIGHT_PASS: siete anuncios confirmados, incluido uno tras recarga; no acredita 390 minutos. Informe: ${reportPath}`,
      );
      powerSaveBlocker.stop(blocker);
      app.exit(0);
      return;
    }

    // Etiquetas de referencia; la prueba comienza a la hora real de ejecución.
    const hours = [
      { label: '08:30-09:30', calls: 8, step: 1, peak: false },
      { label: '09:30-10:30', calls: 10, step: 1, peak: false },
      { label: '10:30-11:30', calls: 14, step: 1, peak: true },
      { label: '11:30-12:30', calls: 18, step: 1, peak: true },
      { label: '12:30-13:30', calls: 20, step: 1, peak: true },
      { label: '13:30-14:30', calls: 14, step: 2, peak: false },
      { label: '14:30-15:00', calls: 7, step: 2, peak: false },
    ];
    let ticket = 10;
    for (const [hourIndex, hour] of hours.entries()) {
      const stageEnd = started + Math.min((hourIndex + 1) * 60, 390) * 60_000;
      const actionStart = report.actions.length;
      for (let offset = 0; offset < hour.calls; offset++) {
        await advance(hour.step);
        const number = (ticket + offset * 3 + hourIndex * 11) % 100;
        const result = await dispatch(operator, { tipo: 'LLAMAR', entrada: String(number) });
        assert.equal(result.efecto, 'ANUNCIAR', 'Un llamado válido no produjo anuncio.');
      }

      // Rellamada de un turno visible y de otro que ya pudo salir de pantalla.
      const repeat = (ticket + hourIndex * 11) % 100;
      await dispatch(operator, { tipo: 'LLAMAR', entrada: String(repeat) });
      report.repeats++;

      // El pico fuerza la ventana máxima de cinco llamados y comprueba que no haya duplicados.
      if (hour.peak) {
        await dispatchBatch(
          operator,
          Array.from({ length: 6 }, (_, offset) => ({
            tipo: 'LLAMAR',
            entrada: String((70 + hourIndex * 7 + offset) % 100),
          })),
        );
      }

      const beforeInvalid = (await run(operator, 'window.turnero.obtener()')).instantanea;
      const invalid = await dispatch(operator, { tipo: 'LLAMAR', entrada: 'no-es-un-turno' });
      assert.equal(invalid.efecto, 'CAPTURA_INVALIDA', 'Una entrada inválida alteró la cola.');
      assert.deepEqual(invalid.instantanea, beforeInvalid, 'La captura inválida cambió el estado.');

      // Corrige el último llamado mediante deshacer y confirma que no genera otro anuncio.
      const beforeUndo = (await run(operator, 'window.turnero.obtener()')).instantanea;
      await dispatch(operator, {
        tipo: 'LLAMAR',
        entrada: String(((beforeUndo.actual ?? 0) + 1) % 100),
      });
      const undo = await dispatch(operator, { tipo: 'DESHACER' });
      assert.equal(undo.efecto, null, 'Deshacer produjo un anuncio inesperado.');
      assert.deepEqual(
        [undo.instantanea.actual, ...undo.instantanea.llamados],
        [beforeUndo.actual, ...beforeUndo.llamados],
        'Deshacer no restauró los números.',
      );
      report.corrections++;

      // La vigencia de cinco minutos se evalúa en el siguiente despacho real.
      await advance(6);
      const expired = (await run(operator, 'window.turnero.obtener()')).instantanea;
      assert.deepEqual(
        [expired.actual, ...expired.llamados],
        [null],
        'Los números no vencieron automáticamente.',
      );
      report.expirations++;
      await checkInvariants(operator, hour.label);
      await verifyAudio(publicWindow);
      recordHour(hour.label, actionStart);
      sample(hour.label);
      ticket = (ticket + hour.calls * 3 + 17) % 100;
      const duration = hourIndex === hours.length - 1 ? 30 : 60;
      const elapsed = hour.calls * hour.step + 6;
      assert.ok(elapsed <= duration, `La carga de ${hour.label} excedió la duración de la etapa.`);
      await waitUntil(stageEnd);
      checkpoint();
    }

    assert.ok(performance.now() - started >= durationMs, 'La jornada no duró 390 minutos reales.');
    await heartbeat();
    assert.equal(receivedAudio.size, expectedAudio.size, 'Faltan confirmaciones de audio.');
    assert.ok(expectedAudio.size > 0, 'No se probaron anuncios.');

    const final = await run(operator, 'window.turnero.diagnostico()');
    assert.equal(final.persistencia, 'correcta', 'La persistencia terminó degradada.');
    assert.equal(final.audio, 'correcto', 'El audio terminó degradado.');
    assert.equal(
      await run(publicWindow, 'window.__jornadaAudio.max <= 1'),
      true,
      'Se detectó superposición de audio.',
    );
    report.announcements = await run(publicWindow, 'window.__jornadaAnnouncements');
    report.audioProbe = await run(publicWindow, 'window.__jornadaAudio');
    assert.ok(report.audioProbe.starts > 0, 'No se observaron fuentes de audio.');
    assert.equal(report.audioProbe.active, 0, 'El audio sigue activo al cierre.');
    assert.equal(
      report.audioProbe.starts,
      report.audioProbe.ends,
      'Fuentes de audio sin terminar.',
    );
    report.metricsSummary = summarizeMetrics();
    report.latencySummary = summarizeLatencies();
    report.logSummary = readLogSummary();
    writeMetricsCsv();
    report.finalDiagnostic = final;
    report.finishedAt = new Date(realNow()).toISOString();
    report.status = 'PASS';
    checkpoint();
    console.log(
      `PASS: jornada real de ${report.elapsedMinutes.toFixed(1)} minutos; evidencia en ${reportPath}`,
    );
    powerSaveBlocker.stop(blocker);
    app.exit(0);
  } catch (error) {
    report.error = String(error);
    report.failures.push({
      stage: report.samples.at(-1)?.stage ?? 'arranque',
      error: String(error),
    });
    report.metricsSummary = summarizeMetrics();
    report.logSummary = readLogSummary();
    writeMetricsCsv();
    report.finishedAt = new Date(realNow()).toISOString();
    report.status = 'FAIL';
    checkpoint();
    console.error(error);
    if (blocker !== undefined) powerSaveBlocker.stop(blocker);
    app.exit(1);
  }
}

void verify();
