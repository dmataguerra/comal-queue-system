import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ejecuta el CLI real en datos aislados y conserva los archivos y salidas para reproducir fallos.
const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, 'test-results'), { recursive: true });
const data = mkdtempSync(join(root, 'test-results', 'recovery-cli-'));
const source = join(data, 'origen');
const target = join(data, 'limpio');
mkdirSync(join(source, 'contenido', 'voz'), { recursive: true });
writeFileSync(join(source, 'config.json'), JSON.stringify({ repeticiones: 2, volumenVoz: 0.8 }));
writeFileSync(
  join(source, 'estado.json'),
  JSON.stringify({
    fecha: '2026-10-01',
    actual: 42,
    llamados: [0, 99],
    guardadoEn: '2026-10-01T18:00:00.000Z',
  }),
);
cpSync(join(root, 'contenido', 'voz', '00.wav'), join(source, 'contenido', 'voz', '00.wav'));
writeFileSync(join(source, 'turnero.log.1'), 'registro preservado\n');
const report = { data, steps: [], commands: [] };
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
function cli(args, expected = 0) {
  const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules/tsx/dist/cli.mjs'), 'scripts/datos.ts', ...args],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    },
  );
  report.commands.push({
    args,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  });
  assert.equal(result.status, expected, result.stderr || result.error?.message);
  return result.stdout.trim();
}
try {
  const backup = cli(['backup', source, join(data, 'copias')]).replace('Respaldo creado: ', '');
  cli(['restore', backup, target], 1);
  cli(['restore', backup, target, '--app-cerrada']);
  for (const file of ['estado.json', 'config.json', 'contenido/voz/00.wav', 'turnero.log.1'])
    assert.equal(hash(join(source, file)), hash(join(target, file)), file);
  report.steps.push(
    'backup y restore limpio: hashes idénticos de estado, config, voz y log rotado',
  );
  const validState = readFileSync(join(backup, 'estado.json'));
  for (const invalid of ['{', '{"actual":999}']) {
    writeFileSync(join(backup, 'estado.json'), invalid);
    cli(['restore', backup, target, '--app-cerrada'], 1);
    assert.equal(hash(join(source, 'estado.json')), hash(join(target, 'estado.json')));
  }
  report.steps.push('JSON corrupto y estructura inválida rechazados sin modificar destino');
  writeFileSync(join(backup, 'estado.json'), validState);
  writeFileSync(join(target, 'estado.json'), '{"datos":"previos"}');
  const restored = cli(['restore', backup, target, '--app-cerrada']);
  const previous = /Datos anteriores conservados en (.+)\./.exec(restored)?.[1];
  assert.ok(previous);
  assert.equal(readFileSync(join(previous, 'estado.json'), 'utf8'), '{"datos":"previos"}');
  assert.equal(hash(join(source, 'estado.json')), hash(join(target, 'estado.json')));
  report.steps.push(
    'destino corrupto recuperado desde backup válido; original conservado para reversión',
  );
  report.status = 'PASS';
  console.log(`PASS recuperación CLI: ${data}`);
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(join(data, 'resultado.json'), `${JSON.stringify(report, null, 2)}\n`);
}
