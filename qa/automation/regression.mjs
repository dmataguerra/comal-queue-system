// Phase 5/6 regression runner: executes every catalog case with the most appropriate tool
// (node:test unit/integration tests, Electron smoke suites, Selenium UI suite, TestLink
// integration smoke), then reports PASS/FAIL/BLOCKED per case to TestLink with read-back.
//
// Usage: npm run qa:regression            (run + report to TestLink)
//        npm run qa:regression -- --no-testlink   (run only, local report)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { testlink } from './testlink.mjs';
import { CASES } from './regression-map.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = join(root, 'test-results', 'qa-regression');
const logs = join(output, 'logs');
await mkdir(logs, { recursive: true });
const useTestLink = !process.argv.includes('--no-testlink');
const startedAt = new Date().toISOString();
const productVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const catalog = JSON.parse(await readFile(join(root, 'qa/catalogo/casos-prueba.json'), 'utf8'));

function run(label, command, args, { timeout = 15 * 60000, env = {} } = {}) {
  const logPath = join(logs, `${label.replace(/[^\w.-]+/g, '_')}.log`);
  return new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => chunks.push(d));
    const timer = setTimeout(() => child.kill(), timeout);
    child.on('close', async (code, signal) => {
      clearTimeout(timer);
      await writeFile(logPath, Buffer.concat(chunks));
      resolve({ code, signal, ms: Date.now() - started, log: logPath });
    });
  });
}

// ---- unit / integration (node:test via tsx) ---------------------------------------------
async function runUnit(file, pattern) {
  const xml = join(
    logs,
    `unit-${file.replace(/[\\/]/g, '_')}-${Buffer.from(pattern).toString('hex').slice(0, 16)}.xml`,
  );
  const result = await run(`unit-${file}-${pattern.slice(0, 30)}`, process.execPath, [
    join(root, 'node_modules/tsx/dist/cli.mjs'),
    '--test',
    `--test-name-pattern=${pattern}`,
    '--test-reporter=junit',
    `--test-reporter-destination=${xml}`,
    file,
  ]);
  const body = existsSync(xml) ? await readFile(xml, 'utf8') : '';
  const names = [...body.matchAll(/<testcase name="([^"]*)"/g)].map((m) => m[1]);
  const failures = (body.match(/<failure/g) || []).length;
  const skipped = (body.match(/<skipped/g) || []).length;
  const executed = names.length - skipped;
  const pass = result.code === 0 && executed > 0 && failures === 0;
  return {
    kind: 'unit',
    ref: `${file} /${pattern}/`,
    status: pass ? 'PASS' : 'FAIL',
    detail: `${executed} tests, ${failures} failures${executed === 0 ? ' (pattern matched no test)' : ''}`,
    tests: names,
    evidence: xml,
  };
}

// ---- shared one-shot suites (each runs once and is reused by several cases) --------------
const once = new Map();
const memo = (key, fn) => {
  if (!once.has(key)) once.set(key, fn());
  return once.get(key);
};

const SMOKES = {
  browser: ['electron', 'scripts/smoke-browser.mjs'],
  hardening: ['electron', 'scripts/smoke-hardening.mjs'],
  help: ['electron', 'scripts/smoke-help.mjs'],
  accessibility: ['electron', 'scripts/smoke-accessibility.mjs'],
  theme: ['electron', 'scripts/smoke-theme.mjs'],
  interface: ['electron', 'scripts/smoke-interface.mjs'],
  'display-scale': ['electron', 'scripts/smoke-display-scale.mjs'],
  'audio-controls': ['electron', 'scripts/smoke-audio-controls.mjs'],
  background: ['electron', 'scripts/smoke-background.mjs'],
  desktop: ['electron', 'scripts/smoke-desktop.mjs'],
  'full-day-preflight': ['electron', 'scripts/smoke-full-day.mjs', '--preflight'],
  destructive: ['node', 'scripts/smoke-destructive-regressions.mjs'],
  media: ['node', 'scripts/smoke-media.mjs'],
  recovery: ['node', 'scripts/validar-recuperacion.mjs'],
};

function runSmoke(name) {
  return memo(`smoke:${name}`, async () => {
    const [runtime, script, ...args] = SMOKES[name];
    const command = runtime === 'electron' ? electronPath : process.execPath;
    const result = await run(`smoke-${name}`, command, [join(root, script), ...args]);
    return {
      kind: 'smoke',
      ref: `${script} ${args.join(' ')}`.trim(),
      status: result.code === 0 ? 'PASS' : 'FAIL',
      detail: `exit ${result.code ?? result.signal} in ${Math.round(result.ms / 1000)} s`,
      evidence: result.log,
    };
  });
}

function seleniumReport() {
  return memo('selenium', async () => {
    const result = await run('selenium-ui', process.execPath, [join(root, 'qa/automation/ui.mjs')]);
    const path = join(root, 'test-results/qa-ui/report.json');
    const report = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : { scenarios: [] };
    return { result, report };
  });
}

async function runSelenium(id) {
  const { result, report } = await seleniumReport();
  const scenario = report.scenarios.find((s) => s.id === id);
  return {
    kind: 'selenium',
    ref: `qa/automation/ui.mjs ${id}`,
    status: scenario?.status === 'PASS' ? 'PASS' : 'FAIL',
    detail: scenario
      ? (scenario.error ?? 'assertions passed')
      : `scenario not executed (suite exit ${result.code})`,
    evidence: scenario?.evidence?.screenshot ?? scenario?.failureScreenshot ?? result.log,
  };
}

function runIntegration() {
  return memo('integration', async () => {
    const result = await run('testlink-integration', process.execPath, [
      join(root, 'qa/automation/integration.mjs'),
    ]);
    const path = join(root, 'test-results/qa-integration/report.json');
    const report = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : {};
    const pass = result.code === 0 && report.integrationStatus === 'PASS';
    return {
      kind: 'integration',
      ref: 'qa/automation/integration.mjs',
      status: pass ? 'PASS' : 'FAIL',
      detail: pass
        ? `TestLink ${report.testlinkCaseId} build ${report.buildId}: PASS and controlled FAIL read back`
        : (report.error?.split('\n')[0] ?? `exit ${result.code}`),
      evidence: path,
    };
  });
}

// ---- execute catalog -------------------------------------------------------------------
const results = [];
for (const entry of catalog.cases) {
  const plan = CASES[entry.id];
  const checks = [];
  if (!plan) {
    results.push({
      id: entry.id,
      title: entry.title,
      status: 'BLOCKED',
      reason: 'No execution mapping defined',
      checks,
    });
    continue;
  }
  for (const [file, pattern] of plan.unit ?? []) checks.push(await runUnit(file, pattern));
  for (const name of plan.smoke ?? []) checks.push(await runSmoke(name));
  for (const id of plan.selenium ?? []) checks.push(await runSelenium(id));
  if (plan.integration) checks.push(await runIntegration());
  let status;
  if (checks.some((c) => c.status === 'FAIL')) status = 'FAIL';
  else if (plan.manual) status = 'BLOCKED';
  else status = checks.length ? 'PASS' : 'BLOCKED';
  results.push({
    id: entry.id,
    title: entry.title,
    priority: entry.priority,
    status,
    manual: plan.manual,
    checks,
  });
  console.log(
    `${entry.id} ${status.padEnd(7)} ${checks.map((c) => `${c.kind}:${c.status}`).join(' ')}`,
  );
}

const summary = {
  total: results.length,
  pass: results.filter((r) => r.status === 'PASS').length,
  fail: results.filter((r) => r.status === 'FAIL').length,
  blocked: results.filter((r) => r.status === 'BLOCKED').length,
};
const report = { suite: 'qa-regression', productVersion, startedAt, summary, results };

// ---- report to TestLink -----------------------------------------------------------------
if (useTestLink) {
  try {
    for (const line of (await readFile(join(root, 'qa/testlink/.env'), 'utf8')).split(/\r?\n/)) {
      const i = line.indexOf('=');
      if (i > 0 && !process.env[line.slice(0, i)])
        process.env[line.slice(0, i)] = line.slice(i + 1).trim();
    }
    const api = testlink(process.env.TESTLINK_API_URL, process.env.TESTLINK_API_KEY);
    const map = JSON.parse(
      await readFile(join(root, 'test-results/qa-integration/catalog-map.json'), 'utf8'),
    );
    const build = await api('createBuild', {
      testplanid: map.planId,
      buildname: `regression-${productVersion}-${startedAt}`,
      buildnotes: `Fase 5/6: regresión completa del catálogo sobre Comal ${productVersion}.`,
    });
    const buildId = Number(build[0]?.id ?? build.id);
    report.testlink = { planId: map.planId, buildId, executions: [] };
    const code = { PASS: 'p', FAIL: 'f', BLOCKED: 'b' };
    for (const r of results) {
      const mapped = map.cases.find((c) => c.documentCaseId === r.id);
      if (!mapped) {
        report.testlink.executions.push({ id: r.id, error: 'not in catalog-map.json' });
        continue;
      }
      const notes = [
        `Regresión automatizada ${startedAt} — ${r.status}`,
        ...r.checks.map((c) => `[${c.status}] ${c.kind} ${c.ref}: ${c.detail}`),
        r.manual ? `Pendiente manual/hardware: ${r.manual}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const execution = await api('reportTCResult', {
        testcaseid: mapped.internalId,
        testplanid: map.planId,
        buildid: buildId,
        status: code[r.status],
        notes,
      });
      const readback = await api('getLastExecutionResult', {
        testcaseid: mapped.internalId,
        testplanid: map.planId,
        buildid: buildId,
      });
      const executionId = Number(execution[0]?.id ?? execution.id);
      // Attach Selenium screenshots. Name = case ID: TestLink rejects stems > 20 chars (6002).
      const shot = r.checks.find((c) => c.kind === 'selenium' && /\.png$/i.test(c.evidence ?? ''));
      let attachment = null;
      if (shot && existsSync(shot.evidence)) {
        try {
          await api('uploadExecutionAttachment', {
            executionid: executionId,
            title: `Selenium ${r.id}`,
            filename: `${r.id}.png`,
            filetype: 'image/png',
            content: await readFile(shot.evidence),
          });
          attachment = { accepted: true, filename: `${r.id}.png` };
        } catch (error) {
          attachment = { accepted: false, error: error.message.slice(0, 300) };
        }
      }
      r.testlink = {
        caseId: mapped.testlinkCaseId,
        executionId,
        attachment,
        readbackStatus: readback[0]?.status,
        confirmed: readback[0]?.status === code[r.status],
      };
      report.testlink.executions.push({ id: r.id, ...r.testlink });
    }
    report.testlink.allConfirmed = results.every((r) => r.testlink?.confirmed);
  } catch (error) {
    report.testlinkError = error.stack;
    process.exitCode = 1;
  }
}

report.finishedAt = new Date().toISOString();
await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      summary,
      testlink: report.testlink?.allConfirmed,
      testlinkError: report.testlinkError?.split('\n')[0],
    },
    null,
    2,
  ),
);
if (summary.fail) process.exitCode = 1;
