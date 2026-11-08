import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import electronPath from 'electron';
import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testlink } from './testlink.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
for (const line of (await readFile(join(root, 'qa/testlink/.env'), 'utf8')).split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !process.env[line.slice(0, i)])
    process.env[line.slice(0, i)] = line.slice(i + 1).trim();
}
const api = testlink(
  process.env.TESTLINK_API_URL || 'http://127.0.0.1:8090/lib/api/xmlrpc/v1/xmlrpc.php',
  process.env.TESTLINK_API_KEY,
);
if (!process.env.TESTLINK_API_KEY) throw new Error('Falta TESTLINK_API_KEY en qa/testlink/.env');
const output = join(root, 'test-results/qa-integration');
await mkdir(output, { recursive: true });
const data = await mkdtemp(join(output, 'comal-'));
const report = {
  documentCaseId: 'COMAL-QA-001',
  startedAt: new Date().toISOString(),
  dataDirectory: data,
};
let host, driver, activeCaseId, activePlanId, activeBuildId;
async function poll(fn, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Tiempo de espera agotado');
}
async function findOrCreateSuite(projectId, name, details) {
  const roots = await api('getFirstLevelTestSuitesForTestProject', {
    testprojectid: projectId,
  }).catch(() => []);
  const found = Array.isArray(roots) && roots.find((s) => s.name === name);
  if (found) return Number(found.id);
  const created = await api('createTestSuite', {
    testprojectid: projectId,
    testsuitename: name,
    details,
  });
  return Number(created.id ?? created[0]?.id);
}
async function findCaseByPrefix(suiteId, prefix) {
  const cases = await api('getTestCasesForTestSuite', {
    testsuiteid: suiteId,
    deep: false,
    details: 'simple',
  }).catch(() => []);
  return (Array.isArray(cases) ? cases : Object.values(cases || {})).find((t) =>
    t.name.startsWith(prefix),
  );
}
// Reuses the catalog case (imported by qa/automation/import-catalog.mjs) or a stable
// fallback case, so repeated runs only add builds and executions, never duplicate cases.
async function ensureCase({
  projectId,
  planId,
  catalogSuiteId,
  fallbackSuiteId,
  prefix,
  definition,
}) {
  let found =
    (catalogSuiteId && (await findCaseByPrefix(catalogSuiteId, prefix))) ||
    (await findCaseByPrefix(fallbackSuiteId, prefix));
  let caseId = Number(found?.id);
  if (!found) {
    const created = await api('createTestCase', {
      ...definition,
      testsuiteid: fallbackSuiteId,
      testprojectid: projectId,
    });
    caseId = Number(created[0]?.id ?? created.id);
  }
  const details = await api('getTestCase', { testcaseid: caseId });
  const externalId = details[0].full_tc_external_id;
  let linked;
  try {
    linked = await api('getTestCasesForTestPlan', { testplanid: planId, testcaseid: caseId });
  } catch (error) {
    if (!error.message.includes('3030')) throw error;
  }
  if (!linked || !Object.keys(linked).length)
    await api('addTestCaseToTestPlan', {
      testprojectid: projectId,
      testplanid: planId,
      testcaseexternalid: externalId,
      version: Number(details[0].version),
    });
  return { caseId, externalId, reused: Boolean(found) };
}
try {
  await api('about');
  const projectName = 'Comal QA integración';
  const projectResponse = await api('getProjects');
  const projects = Array.isArray(projectResponse) ? projectResponse : [];
  let project = projects.find((p) => p.name === projectName);
  if (!project) {
    await api('createTestProject', {
      testprojectname: projectName,
      testcaseprefix: 'COMAL',
      notes: 'Integración fase 4',
    });
    project = (await api('getProjects')).find((p) => p.name === projectName);
  }
  const projectId = Number(project.id);
  const plans = await api('getProjectTestPlans', { testprojectid: projectId });
  let plan = Array.isArray(plans) && plans.find((p) => p.name === 'Integración fase 4');
  if (!plan) {
    await api('createTestPlan', {
      testprojectname: projectName,
      testplanname: 'Integración fase 4',
      active: true,
      public: true,
    });
    plan = (await api('getProjectTestPlans', { testprojectid: projectId })).find(
      (p) => p.name === 'Integración fase 4',
    );
  }
  const planId = Number(plan.id);
  const catalogSuiteId = await findOrCreateSuite(
    projectId,
    'Catálogo trazable',
    'Diseño; importación no implica ejecución',
  );
  const fallbackSuiteId = await findOrCreateSuite(
    projectId,
    'Integración',
    'Smoke de comunicación real',
  );
  const authorlogin = process.env.TESTLINK_API_USER || 'admin';
  const product = await ensureCase({
    projectId,
    planId,
    catalogSuiteId,
    fallbackSuiteId,
    prefix: 'COMAL-QA-001',
    definition: {
      testcasename: 'COMAL-QA-001 — Anunciar 42 y observar pantalla pública',
      authorlogin,
      summary: 'Smoke Selenium de integración, no regresión completa.',
      preconditions: 'Comal aislado iniciado',
      steps: [
        {
          step_number: 1,
          actions: 'Capturar 42 y pulsar Enter',
          expected_results: 'La vista pública muestra 42',
          execution_type: 2,
        },
      ],
      importance: 3,
      executiontype: 2,
    },
  });
  const caseId = product.caseId;
  activeCaseId = caseId;
  activePlanId = planId;
  report.testlinkCaseId = product.externalId;
  report.testlinkCaseReused = product.reused;
  const buildName = `integration-${new Date().toISOString()}`;
  const build = await api('createBuild', {
    testplanid: planId,
    buildname: buildName,
    buildnotes: 'Fase 4: comunicación Selenium → TestLink',
  });
  report.buildId = Number(build[0]?.id ?? build.id);
  activeBuildId = report.buildId;
  const hostLogPath = join(data, 'electron-host.log');
  report.hostLog = hostLogPath;
  const hostLog = openSync(hostLogPath, 'a');
  host = spawn(electronPath, [join(root, 'qa/automation/comal-host.mjs')], {
    cwd: root,
    env: { ...process.env, TURNERO_DATOS: data, TURNERO_PUERTO: '0' },
    stdio: ['ignore', hostLog, hostLog],
    windowsHide: true,
  });
  const origin = await poll(
    async () =>
      (await readFile(join(data, 'turnero.log'), 'utf8')).match(
        /Navegador local: (http:\/\/127\.0\.0\.1:\d+)/,
      )?.[1],
  );
  report.comalOrigin = origin;
  const options = new chrome.Options().addArguments(
    '--headless=new',
    '--window-size=1440,1000',
    '--autoplay-policy=no-user-gesture-required',
  );
  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.get(`${origin}/publica`);
  await driver.wait(until.elementLocated(By.css('.public-screen')), 20000);
  const publicHandle = await driver.getWindowHandle();
  await driver.switchTo().newWindow('tab');
  await driver.get(origin);
  const input = await driver.wait(until.elementLocated(By.id('turn-number')), 20000);
  await input.sendKeys('42', Key.ENTER);
  await driver.switchTo().window(publicHandle);
  // findElements (plural) returns [] while the public view is still rendering, so the wait
  // keeps polling instead of aborting on NoSuchElementError (flaky under regression load).
  await driver.wait(async () => {
    const [turn] = await driver.findElements(By.css('.public-turn strong'));
    return turn ? (await turn.getText()).trim() === '42' : false;
  }, 20000);
  await writeFile(join(output, 'publica-42.png'), await driver.takeScreenshot(), 'base64');
  const execution = await api('reportTCResult', {
    testcaseid: caseId,
    testplanid: planId,
    buildid: report.buildId,
    status: 'p',
    notes:
      'Selenium Chrome headless: captura real 42 → pantalla pública 42. Evidencia local: test-results/qa-integration/publica-42.png',
  });
  report.passExecution = execution;
  report.readbackPass = await api('getLastExecutionResult', {
    testcaseid: caseId,
    testplanid: planId,
    buildid: report.buildId,
  });
  if (report.readbackPass[0]?.status !== 'p') throw new Error('TestLink no confirmó PASS');
  report.productStatus = 'PASS';
  const executionId = Number(execution[0]?.id ?? execution.id);
  report.attachment = await api('uploadExecutionAttachment', {
    executionid: executionId,
    title: 'Selenium evidence',
    filename: 'publica-42.png',
    filetype: 'image/png',
    content: await readFile(join(output, 'publica-42.png')),
  });
  const failBuild = await api('createBuild', {
    testplanid: planId,
    buildname: `${buildName}-adapter-negative-control`,
    buildnotes: 'Control negativo deliberado del adaptador. No representa defecto de Comal.',
  });
  const failBuildId = Number(failBuild[0]?.id ?? failBuild.id);
  const negative = await ensureCase({
    projectId,
    planId,
    catalogSuiteId: null,
    fallbackSuiteId,
    prefix: 'INFRA-ADAPTER-001',
    definition: {
      testcasename: 'INFRA-ADAPTER-001 — Control negativo de sincronización',
      authorlogin,
      summary:
        'FAIL deliberado para comprobar que TestLink conserva fallos. No es una prueba de negocio.',
      steps: [
        {
          step_number: 1,
          actions: 'Enviar estado f y consultar ejecución',
          expected_results: 'TestLink devuelve f',
          execution_type: 2,
        },
      ],
      importance: 2,
      executiontype: 2,
    },
  });
  const negativeId = negative.caseId;
  report.negativeCaseId = negative.externalId;
  report.controlledFail = await api('reportTCResult', {
    testcaseid: negativeId,
    testplanid: planId,
    buildid: failBuildId,
    status: 'f',
    notes:
      'CONTROL NEGATIVO DEL ADAPTADOR: FAIL deliberado para validar sincronización. No se ejecutó una aserción fallida de Comal ni se atribuye un defecto al producto.',
  });
  report.readbackControlledFail = await api('getLastExecutionResult', {
    testcaseid: negativeId,
    testplanid: planId,
    buildid: failBuildId,
  });
  if (report.readbackControlledFail[0]?.status !== 'f')
    throw new Error('TestLink no confirmó control FAIL');
  report.status = 'PASS';
  report.integrationStatus = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.integrationStatus = 'FAIL';
  report.error = error.stack;
  process.exitCode = 1;
  if (driver) {
    try {
      await writeFile(join(output, 'failure.png'), await driver.takeScreenshot(), 'base64');
    } catch {}
  }
  if (activeCaseId && activeBuildId && report.productStatus !== 'PASS') {
    try {
      report.failureReport = await api('reportTCResult', {
        testcaseid: activeCaseId,
        testplanid: activePlanId,
        buildid: activeBuildId,
        status: 'f',
        notes: String(error.message),
      });
    } catch (reportError) {
      report.reportingError = reportError.message;
    }
  }
} finally {
  if (driver) {
    try {
      await driver.quit();
    } catch (error) {
      report.cleanupError = error.message;
    }
  }
  if (host) host.kill();
  report.finishedAt = new Date().toISOString();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(
    join(output, `attempt-${report.startedAt.replaceAll(':', '-')}.json`),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
