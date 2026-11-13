import assert from 'node:assert/strict';
import test from 'node:test';
import { checkStateSpace, STATE_RESERVE } from './store.js';
test('state save rejects low disk space before writing', () => {
  assert.throws(
    () => checkStateSpace('C:/datos/estado.json', () => STATE_RESERVE - 1),
    /Espacio insuficiente/,
  );
  assert.doesNotThrow(() => checkStateSpace('C:/datos/estado.json', () => STATE_RESERVE));
});
test('save tolerates an unavailable space query but keeps other errors', () => {
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
