(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ComalQueue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const active = o => o.status === 'preparing' || o.status === 'ready';
  const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  function normalize(value) {
    const text = String(value).trim();
    if (!/^\d{1,2}$/.test(text) || +text < 1 || +text > 99) throw new Error('Escribe un número de ticket del 01 al 99.');
    return text.padStart(2, '0');
  }
  function seed(now = Date.now()) {
    const state = { version: 1, demoResetId: uid(), orders: [], events: [], calls: [], connected: true, sessionOpen: true, sessionStarted: now - 3600000 };
    for (let n = 1; n <= 23; n++) {
      const createdAt = now - (80 - n * 2) * 60000;
      const o = { id: uid(), number: String(n).padStart(2, '0'), status: 'delivered', createdAt, readyAt: createdAt + 7 * 60000, closedAt: createdAt + 9 * 60000 };
      state.orders.push(o);
      state.events.push({ id: uid(), orderId: o.id, number: o.number, action: 'delivered', at: o.closedAt, actor: 'Caja 01' });
    }
    for (const [number, minutes, readyMinutes] of [['24', 15, 5], ['25', 12, null], ['26', 12, 3], ['27', 9, null], ['28', 8, 1], ['29', 7, null], ['30', 5, null], ['31', 3, null], ['32', 2, null], ['33', 1, null]]) {
      const o = { id: uid(), number, status: readyMinutes === null ? 'preparing' : 'ready', createdAt: now - minutes * 60000, readyAt: readyMinutes === null ? null : now - readyMinutes * 60000, closedAt: null };
      state.orders.push(o);
      state.events.push({ id: uid(), orderId: o.id, number, action: 'registered', at: o.createdAt, actor: 'Caja 01' });
      if (o.readyAt) {
        const e = { id: uid(), orderId: o.id, number, action: 'ready', at: o.readyAt, actor: 'Caja 01' };
        state.events.push(e); state.calls.push({ ...e });
      }
    }
    return state;
  }
  function requireOperation(state) {
    if (!state.connected) throw new Error('Conexión pausada. Reconecta la demo para guardar cambios.');
    if (!state.sessionOpen) throw new Error('Abre una jornada para registrar o actualizar pedidos.');
  }
  function event(state, order, action, at) {
    const e = { id: uid(), orderId: order.id, number: order.number, action, at, actor: 'Caja 01' };
    state.events.push(e); return e;
  }
  function register(state, value, now = Date.now()) {
    requireOperation(state);
    const number = normalize(value);
    if (state.orders.some(o => o.number === number && active(o))) throw new Error('El ticket ' + number + ' ya está activo. Revisa su estado antes de registrarlo de nuevo.');
    const order = { id: uid(), number, status: 'preparing', createdAt: now, readyAt: null, closedAt: null };
    state.orders.push(order); event(state, order, 'registered', now); return order;
  }
  function transition(state, id, action, now = Date.now()) {
    requireOperation(state);
    const o = state.orders.find(o => o.id === id);
    if (!o) throw new Error('No se encontró el pedido.');
    const allowed = { ready: ['preparing'], delivered: ['ready'], repeat: ['ready'], correct: ['ready'], cancel: ['preparing', 'ready'] };
    if (!allowed[action]?.includes(o.status)) throw new Error('Este pedido ya cambió de estado.');
    if (action === 'ready') { o.status = 'ready'; o.readyAt = now; }
    if (action === 'delivered') { o.status = 'delivered'; o.closedAt = now; }
    if (action === 'cancel') { o.status = 'cancelled'; o.closedAt = now; }
    if (action === 'correct') { o.status = 'preparing'; o.readyAt = null; }
    const e = event(state, o, action, now);
    if (action === 'ready' || action === 'repeat') state.calls.push({ ...e });
    return e;
  }
  function ready(state) { return state.orders.filter(o => o.status === 'ready').sort((a, b) => a.readyAt - b.readyAt); }
  function latest(state) {
    return [...state.calls].reverse().find(c => state.orders.some(o => o.id === c.orderId && o.status === 'ready')) || null;
  }
  function closeSession(state) {
    requireOperation(state);
    if (state.orders.some(active)) throw new Error('Entrega o cancela los pedidos activos antes de cerrar la jornada.');
    state.sessionOpen = false;
  }
  return { active, normalize, seed, register, transition, ready, latest, closeSession };
});
