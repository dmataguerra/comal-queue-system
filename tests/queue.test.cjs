const { test } = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../dist/queue.js');
const empty = () => ({version:1,orders:[],events:[],calls:[],connected:true,sessionOpen:true,sessionStarted:Date.now()});
test('printed ticket numbers: validation, leading zeros and active duplicates',()=>{
 const s=empty();const o=Q.register(s,'1');assert.equal(o.number,'01');
 for(const v of ['', '00','100','abc','1.5','-1','0001','1e1'])assert.throws(()=>Q.register(s,v));
 assert.throws(()=>Q.register(s,'01'),/ya está activo/);assert.equal(s.orders.length,1);
});
test('out-of-order preparation, queued calls and exactly one ready transition',()=>{
 const s=empty();const a=Q.register(s,'27',100),b=Q.register(s,'28',200);
 Q.transition(s,b.id,'ready',300);assert.equal(a.status,'preparing');assert.equal(Q.latest(s).number,'28');
 assert.throws(()=>Q.transition(s,b.id,'ready',310));assert.equal(s.calls.length,1);
 Q.transition(s,a.id,'ready',400);assert.deepEqual(Q.ready(s).map(o=>o.number),['28','27']);
 Q.transition(s,b.id,'repeat',500);assert.equal(Q.latest(s).number,'28');assert.equal(s.calls.length,3);assert.equal(b.readyAt,300);
});
test('delivered and cancelled numbers can be reused with independent history',()=>{
 const s=empty(),a=Q.register(s,'01');Q.transition(s,a.id,'ready');Q.transition(s,a.id,'delivered');
 assert.equal(Q.latest(s),null);const b=Q.register(s,'1');assert.notEqual(b.id,a.id);
 Q.transition(s,b.id,'cancel');const c=Q.register(s,'01');assert.equal(s.orders.length,3);assert.equal(c.status,'preparing');
 assert.equal(s.events.filter(e=>e.orderId===a.id).length,3);assert.equal(s.events.filter(e=>e.orderId===b.id).length,2);
});
test('correction removes ready item and future invalid transitions are rejected',()=>{
 const s=empty(),o=Q.register(s,'12');assert.throws(()=>Q.transition(s,o.id,'delivered'));
 Q.transition(s,o.id,'ready');Q.transition(s,o.id,'correct');assert.equal(Q.ready(s).length,0);assert.equal(Q.latest(s),null);assert.equal(o.readyAt,null);
 assert.throws(()=>Q.transition(s,o.id,'repeat'));Q.transition(s,o.id,'ready');Q.transition(s,o.id,'cancel');assert.equal(Q.latest(s),null);
});
test('disconnect and session closing never acknowledge unsaved transitions',()=>{
 const s=empty(),o=Q.register(s,'99');assert.throws(()=>Q.closeSession(s),/activos/);
 s.connected=false;assert.throws(()=>Q.register(s,'02'));assert.throws(()=>Q.transition(s,o.id,'ready'));assert.equal(o.status,'preparing');
 s.connected=true;Q.transition(s,o.id,'cancel');Q.closeSession(s);assert.equal(s.sessionOpen,false);assert.throws(()=>Q.register(s,'01'));
});
test('serialization keeps confirmed state and all 99 active numbers work',()=>{
 const s=empty();for(let n=1;n<=99;n++){const o=Q.register(s,String(n));Q.transition(s,o.id,'ready');}
 const restored=JSON.parse(JSON.stringify(s));assert.equal(Q.ready(restored).length,99);assert.equal(restored.calls.length,99);
 assert.equal(new Set(restored.orders.map(o=>o.id)).size,99);assert.equal(Q.latest(restored).number,'99');
});
