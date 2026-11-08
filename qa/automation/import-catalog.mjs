import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { testlink } from './testlink.mjs';
for (const line of (await readFile('qa/testlink/.env', 'utf8')).split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !process.env[line.slice(0, i)])
    process.env[line.slice(0, i)] = line.slice(i + 1).trim();
}
const api = testlink(process.env.TESTLINK_API_URL, process.env.TESTLINK_API_KEY);
const catalogue = JSON.parse(await readFile('qa/catalogo/casos-prueba.json', 'utf8'));
const project = (await api('getProjects')).find((p) => p.name === 'Comal QA integración');
if (!project) throw new Error('Ejecuta primero qa:integration para crear proyecto y plan');
const projectId = Number(project.id);
const plan = (await api('getProjectTestPlans', { testprojectid: projectId })).find(
  (p) => p.name === 'Integración fase 4',
);
const roots = await api('getFirstLevelTestSuitesForTestProject', { testprojectid: projectId });
let suite = Array.isArray(roots) && roots.find((s) => s.name === 'Catálogo trazable');
if (!suite)
  suite = await api('createTestSuite', {
    testprojectid: projectId,
    testsuitename: 'Catálogo trazable',
    details: 'Diseño; importación no implica ejecución',
  });
const suiteId = Number(suite.id ?? suite[0]?.id);
const existing = await api('getTestCasesForTestSuite', {
  testsuiteid: suiteId,
  deep: false,
  details: 'full',
});
const existingCases = Array.isArray(existing) ? existing : Object.values(existing || {});
const mapping = [];
const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const c of catalogue.cases) {
  const name = `${c.id} — ${c.title}`;
  let found = existingCases.find((t) => t.name === name);
  if (!found) {
    const result = await api('createTestCase', {
      testcasename: name,
      testsuiteid: suiteId,
      testprojectid: projectId,
      authorlogin: process.env.TESTLINK_API_USER || 'admin',
      summary: `<p>${esc(c.useCase)} | ${esc(c.type)} | ${esc(c.source)}</p>`,
      preconditions: esc(JSON.stringify(c.preconditions)),
      steps: c.steps.map((s, i) => ({
        step_number: i + 1,
        actions: esc(s),
        expected_results: i === c.steps.length - 1 ? esc(JSON.stringify(c.expected)) : '',
        execution_type: c.automation === 'Selenium' ? 2 : 1,
      })),
      importance: c.priority === 'P0' ? 3 : 2,
      executiontype: /selenium/i.test(JSON.stringify(c.automation)) ? 2 : 1,
    });
    found = result[0] ?? result;
  }
  const id = Number(found.id);
  const details = await api('getTestCase', { testcaseid: id });
  const externalId = details[0].full_tc_external_id;
  let linked;
  try {
    linked = await api('getTestCasesForTestPlan', { testplanid: Number(plan.id), testcaseid: id });
  } catch (error) {
    if (!error.message.includes('3030')) throw error;
  }
  if (!linked || !Object.keys(linked).length)
    await api('addTestCaseToTestPlan', {
      testprojectid: projectId,
      testplanid: Number(plan.id),
      testcaseexternalid: externalId,
      version: Number(details[0].version),
    });
  mapping.push({
    documentCaseId: c.id,
    testlinkCaseId: externalId,
    internalId: id,
    status: 'planned-not-executed',
  });
}
await mkdir('test-results/qa-integration', { recursive: true });
await writeFile(
  'test-results/qa-integration/catalog-map.json',
  JSON.stringify(
    { importedAt: new Date().toISOString(), projectId, planId: Number(plan.id), cases: mapping },
    null,
    2,
  ),
);
console.log(`Catálogo registrado: ${mapping.length} casos; ninguna ejecución creada.`);
