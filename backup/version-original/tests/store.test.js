import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CloudStore} from '../public/store.js';
const mock=()=>{
 let row=null,calls=0,fail=false,lost=false,hold=null;
 const client={rpc:async(_,op)=>{
  calls++;if(hold)await hold;
  if(fail)return {error:Error('offline')};
  if(row?.revision===op.p_revision)return {data:{revision:row.revision}};
  if((row?.revision||null)!==op.p_expected)return {error:Error('STATE_CONFLICT')};
  row={data:structuredClone(op.p_data),revision:op.p_revision};
  if(lost){lost=false;return {error:Error('response lost')}}
  return {data:{revision:row.revision}};
 }};
 return {client,get row(){return row},get calls(){return calls},
  set fail(v){fail=v},set lost(v){lost=v},set hold(v){hold=v}};
};
test('coalesce inputs; snapshot is detached from later edits',async()=>{
 const m=mock(),s=new CloudStore(m.client,'A',()=>{}),state={text:'uno'};
 s.schedule(()=>state);state.text='dos';s.schedule(()=>state);
 await s.flush();assert.deepEqual(m.row.data,{text:'dos'});assert.equal(m.calls,1);
 state.text='tres';assert.equal(m.row.data.text,'dos');assert.equal(s.unsaved,false);
});
test('edits during a request are serialized and saved in a second operation',async()=>{
 const m=mock(),s=new CloudStore(m.client,'A',()=>{});let value=1,release;
 m.hold=new Promise(r=>release=r);s.schedule(()=>({value}));const saving=s.flush();
 value=2;s.schedule(()=>({value}));m.hold=null;release();await saving;
 assert.equal(m.row.data.value,2);assert.equal(m.calls,2);assert.equal(s.unsaved,false);
});
test('two devices cannot silently overwrite each other',async()=>{
 const m=mock(),a=new CloudStore(m.client,'A',()=>{}),b=new CloudStore(m.client,'A',()=>{});
 a.schedule(()=>({from:'a'}));await a.flush();
 b.schedule(()=>({from:'b'}));await assert.rejects(b.flush(),/STATE_CONFLICT/);
 assert.equal(m.row.data.from,'a');assert.equal(b.unsaved,true);assert.ok(b.pending);
});
test('offline preserves operation; retry uses the identical revision',async()=>{
 const m=mock(),s=new CloudStore(m.client,'A',()=>{});m.fail=true;
 s.schedule(()=>({note:'privado'}));await assert.rejects(s.flush(),/offline/);
 const revision=s.pending.p_revision;m.fail=false;await s.retry();
 assert.equal(m.row.revision,revision);assert.equal(m.row.data.note,'privado');
});
test('lost acknowledgement is idempotent on retry',async()=>{
 const m=mock(),s=new CloudStore(m.client,'A',()=>{});m.lost=true;
 s.schedule(()=>({note:'una sola escritura lógica'}));await assert.rejects(s.flush());
 const revision=m.row.revision;await s.retry();assert.equal(m.row.revision,revision);
 assert.equal(s.unsaved,false);
});
test('stopping a session cancels queued work',async()=>{
 const m=mock(),s=new CloudStore(m.client,'A',()=>{});s.schedule(()=>({secret:1}));s.stop();
 await assert.rejects(s.flush(),/Sesión cerrada/);assert.equal(m.calls,0);assert.equal(s.pending,null);
});
test('validation failure blocks write and keeps dirty flag for recovery',async()=>{
 const m=mock(),s=new CloudStore(m.client,'A',()=>{});
 s.schedule(()=>{throw Error('invalid state')});await assert.rejects(s.flush(),/invalid state/);
 assert.equal(m.calls,0);assert.equal(s.unsaved,true);
});
