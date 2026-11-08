import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testlink } from './testlink.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
for (const line of (await readFile(join(root, 'qa/testlink/.env'), 'utf8')).split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !process.env[line.slice(0, i)])
    process.env[line.slice(0, i)] = line.slice(i + 1).trim();
}
const reportPath = join(root, 'test-results/qa-ui/report.json');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
if (report.status !== 'PASS')
  throw new Error('No se reportan resultados UI si la suite no terminó en PASS.');

const map = JSON.parse(
  await readFile(join(root, 'test-results/qa-integration/catalog-map.json'), 'utf8'),
);
const api = testlink(process.env.TESTLINK_API_URL, process.env.TESTLINK_API_KEY);
const project = (await api('getProjects')).find((item) => item.name === 'Comal QA integración');
if (!project) throw new Error('No existe el proyecto Comal QA integración en TestLink.');
const plan = (await api('getProjectTestPlans', { testprojectid: Number(project.id) })).find(
  (item) => item.name === 'Integración fase 4',
);
if (!plan) throw new Error('No existe el plan Integración fase 4 en TestLink.');
const build = await api('createBuild', {
  testplanid: Number(plan.id),
  buildname: `selenium-ui-${report.startedAt}`,
  buildnotes: 'Suite UI Selenium: casos COMAL-QA-001, 003 y 011.',
});
const buildId = Number(build[0]?.id ?? build.id);
const executions = [];
for (const scenario of report.scenarios) {
  const mapped = map.cases.find((item) => item.documentCaseId === scenario.id);
  if (!mapped) throw new Error(`No hay mapeo TestLink para ${scenario.id}.`);
  const result = await api('reportTCResult', {
    testcaseid: mapped.internalId,
    testplanid: Number(plan.id),
    buildid: buildId,
    status: scenario.status === 'PASS' ? 'p' : 'f',
    notes: `Selenium UI: ${scenario.title}. Evidencia: ${scenario.evidence?.screenshot ?? 'sin captura'}`,
  });
  const readback = await api('getLastExecutionResult', {
    testcaseid: mapped.internalId,
    testplanid: Number(plan.id),
    buildid: buildId,
  });
  const expected = scenario.status === 'PASS' ? 'p' : 'f';
  if (readback[0]?.status !== expected) throw new Error(`TestLink no confirmó ${scenario.id}.`);
  const screenshot = scenario.evidence?.screenshot;
  let attachment = null;
  if (screenshot) {
    try {
      attachment = await api('uploadExecutionAttachment', {
        executionid: Number(result[0]?.id ?? result.id),
        title: `Selenium evidence ${scenario.id}`,
        // TestLink's allowed_filenames_regexp only accepts stems of 1-20 chars
        // ([a-zA-Z0-9_-]); longer names fail with error 6002. The case ID fits.
        filename: `${scenario.id}.png`,
        filetype: 'image/png',
        content: await readFile(screenshot),
      });
    } catch (error) {
      attachment = { accepted: false, error: error.message };
    }
  }
  executions.push({
    documentCaseId: scenario.id,
    testlinkCaseId: mapped.testlinkCaseId,
    result,
    readback,
    attachment,
  });
}
const output = {
  reportedAt: new Date().toISOString(),
  buildId,
  planId: Number(plan.id),
  status: executions.every((item) => item.attachment?.accepted !== false)
    ? 'PASS'
    : 'PASS_WITH_LOCAL_EVIDENCE',
  executions,
};
await writeFile(
  join(root, 'test-results/qa-ui/testlink-report.json'),
  JSON.stringify(output, null, 2),
);
console.log(JSON.stringify(output, null, 2));
