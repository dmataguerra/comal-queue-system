import assert from 'node:assert/strict';
import {test} from 'node:test';
import {crearCola} from './cola.js';

test('55 termina antes de 66 y los repetidos mantienen su lugar', async () => {
  const eventos: string[] = [];
  let terminar!: () => void;
  const primero = new Promise<void>(resolve => { terminar = resolve; });
  let completar!: () => void;
  const completo = new Promise<void>(resolve => { completar = resolve; });
  let cantidad = 0;
  const cola = crearCola<number>(async n => {
    eventos.push(`inicio ${n}`);
    if (++cantidad === 1) await primero;
    eventos.push(`fin ${n}`);
    if (cantidad === 3) completar();
  }, error => { throw error; });
  cola.agregar(55); cola.agregar(66); cola.agregar(66);
  assert.deepEqual(eventos, ['inicio 55']);
  terminar(); await completo;
  assert.deepEqual(eventos, ['inicio 55', 'fin 55', 'inicio 66', 'fin 66', 'inicio 66', 'fin 66']);
  cola.detener();
});

test('un fallo permite continuar y detener rechaza nuevos anuncios', async () => {
  const errores: unknown[] = [];
  const vistos: number[] = [];
  let completar!: () => void;
  const completo = new Promise<void>(resolve => { completar = resolve; });
  const cola = crearCola<number>(async n => {
    vistos.push(n);
    if (n === 1) throw new Error('audio ausente');
    completar();
  }, error => errores.push(error));
  cola.agregar(1); cola.agregar(2);
  await completo;
  cola.detener(); cola.agregar(3);
  assert.deepEqual(vistos, [1, 2]);
  assert.equal(errores.length, 1);
});
