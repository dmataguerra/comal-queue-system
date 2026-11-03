import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { crearAperturaManual } from './manual-usuario.js';

test('el lector recibe una copia real del PDF, estable y reparable, fuera de asar', async (t) => {
  const raiz = await mkdtemp(join(tmpdir(), 'comal-manual-'));
  t.after(() => rm(raiz, { recursive: true, force: true }));
  const origen = join(raiz, 'original.pdf');
  const pdf = await readFile(
    join(import.meta.dirname, '../output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf'),
  );
  await writeFile(origen, pdf);
  const rutas: string[] = [];
  const abrir = crearAperturaManual({
    origen,
    cache: join(raiz, 'cache'),
    abrir: async (ruta) => {
      assert.deepEqual(await readFile(ruta), pdf);
      rutas.push(ruta);
      return '';
    },
  });
  await Promise.all([abrir(), abrir()]);
  assert.equal(rutas.length, 1, 'coalesce concurrent requests instead of launching two readers');
  assert.notEqual(rutas[0], origen);
  await writeFile(rutas[0], 'archivo incompleto');
  await abrir();
  assert.equal(rutas[0], rutas[1]);
  assert.deepEqual(await readFile(rutas[1]), pdf);
});

test('manual ausente, incompleto y lector no disponible ofrecen errores recuperables', async (t) => {
  const raiz = await mkdtemp(join(tmpdir(), 'comal-manual-error-'));
  t.after(() => rm(raiz, { recursive: true, force: true }));
  const origen = join(raiz, 'manual.pdf');
  let aperturas = 0;
  const abrir = crearAperturaManual({
    origen,
    cache: join(raiz, 'cache'),
    abrir: async () => {
      aperturas++;
      return 'No association';
    },
  });
  await assert.rejects(abrir(), /No se encontró el manual/);
  await writeFile(origen, 'no es PDF');
  await assert.rejects(abrir(), /incompleto/);
  assert.equal(aperturas, 0);
  await writeFile(origen, '%PDF-1.7\n');
  await assert.rejects(abrir(), /lector de PDF/);
  assert.equal(aperturas, 1);
});
