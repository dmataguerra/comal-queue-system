import assert from 'node:assert/strict';
import test from 'node:test';
import { checkStateSpace, STATE_RESERVE } from './store.js';
test('guardado de estado rechaza disco bajo antes de escribir', () => {
  assert.throws(
    () => checkStateSpace('C:/datos/estado.json', () => STATE_RESERVE - 1),
    /Espacio insuficiente/,
  );
  assert.doesNotThrow(() => checkStateSpace('C:/datos/estado.json', () => STATE_RESERVE));
});
test('guardado tolera consulta de espacio no disponible pero conserva otros errores', () => {
  assert.doesNotThrow(() =>
    checkStateSpace('C:/datos/estado.json', () => {
      throw Object.assign(new Error('No compatible'), { code: 'ENOSYS' });
    }),
  );
  assert.throws(() =>
    checkStateSpace('C:/datos/estado.json', () => {
      throw Object.assign(new Error('Permiso denegado'), { code: 'EACCES' });
    }),
  );
});
