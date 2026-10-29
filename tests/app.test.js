import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function harness(){
 const elements=new Map();
 const elem=()=>({value:'',innerHTML:'',hidden:true,inert:false,open:false,dataset:{},
  classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}},
  addEventListener(){},setAttribute(){},querySelectorAll(){return []},
  querySelector(){return null},focus(){},showModal(){this.open=true},close(){this.open=false}});
 const $=selector=>{if(!selector.startsWith('#'))return null;if(!elements.has(selector))elements.set(selector,elem());return elements.get(selector)};
 const doc={querySelector:$,querySelectorAll:()=>[],addEventListener(){},documentElement:elem()};
 const ctx=vm.createContext({document:doc,window:{addEventListener(){}},console,
  scrollY:0,scrollTo(){},setTimeout,clearTimeout,setInterval(){},crypto,Blob,URL,
  alert(){},confirm:()=>true,Date,structuredClone});
 let code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 code=code.replace(/^import .*;\n/gm,'').replace(/\nboot\(\);\s*$/,'');
 vm.runInContext(code,ctx);
 vm.runInContext(`globalThis.api={blank,checkedState,summary,normalize,validateState,setP,syncTask,planTask,vC,
  state:()=>S, reset:o=>{S=checkedState(o);ready=true;cloud={schedule:()=>true}},ui:U};`,ctx);
 return {api:ctx.api,$};
}
const fixture=()=>({h:[{id:'habit-1',name:'Caminar',days:[0,1,2,3,4,5,6],createdOn:'2026-10-01'}],
 hl:{'2026-10-28':{'habit-1':1}},m:{'2026-10':{p:['Una prioridad'],h:['Un logro']}},
 ev:{'2026-10-28':[{t:'Clase',h:'10:00',c:1}]},
 w:{'2026-10-26':{i:'Mi semana',a:[{t:'Estudiar',c:false}],b:[],r:['Aprendí']}},
 d:{'2026-10-28':{i:'Intención',g:'Gracias',n:'Notas',r:'Reflexión',hl:'Anterior',learn:'Aprendizaje',remember:'Recuerdo',c:{h6:'Café'},k:{1:{t:'Estudiar',c:false,s:2,source:'w.2026-10-26.a.0'}},otherCount:2}},
 cfg:{acc:2,hide:{d_gr_wk:false},days:{6:{d_hab:false}}}});
const plain=o=>JSON.parse(JSON.stringify(o));
test('full imported state preserves all entities, source and legacy reflections',()=>{
 const {api}=harness(),data=fixture();assert.deepEqual(plain(api.checkedState(data)),data);
 const s=api.summary(data);assert.equal(s.habitos,1);assert.equal(s.eventos,1);assert.equal(s.vinculos,1);assert.equal(s.origenesAusentes,0);
});
test('legacy string events normalize without losing text',()=>{
 const {api}=harness(),data=fixture();data.ev['2026-10-28']=['Evento antiguo'];
 assert.deepEqual(plain(api.checkedState(data).ev['2026-10-28']),[{t:'Evento antiguo',c:0,h:''}]);
});
test('completion propagates daily to weekly and other linked days',()=>{
 const {api}=harness(),data=fixture();data.d['2026-10-29']=structuredClone(data.d['2026-10-28']);api.reset(data);
 api.setP('d.2026-10-28.k.1.c',true);api.syncTask('d.2026-10-28.k.1.c',true);
 assert.equal(api.state().w['2026-10-26'].a[0].c,true);assert.equal(api.state().d['2026-10-29'].k[1].c,true);
 api.setP('w.2026-10-26.a.0.c',false);api.syncTask('w.2026-10-26.a.0.c',false);
 assert.equal(api.state().d['2026-10-28'].k[1].c,false);
});
test('move form adds source once and preserves original weekly task',()=>{
 const {api,$}=harness(),data=fixture();api.reset(data);api.ui.wk='2026-10-26';
 api.planTask('a',0);$('#moveDate').value='2026-10-30';$('#moveForm').onsubmit({preventDefault(){}});
 const rows=api.state().d['2026-10-30'].k;assert.equal(rows[1].source,'w.2026-10-26.a.0');
 api.planTask('a',0);$('#moveDate').value='2026-10-30';$('#moveForm').onsubmit({preventDefault(){}});
 assert.equal(Object.keys(rows).length,1);assert.equal(api.state().w['2026-10-26'].a[0].t,'Estudiar');
});
test('unsafe keys, invalid dates, huge indices and injected time are rejected',()=>{
 const {api}=harness();
 for(const modify of [d=>{d.d['2026-02-31']={}},d=>{d.d['2026-10-28'].k[999999]={t:'x'}},d=>{d.ev['2026-10-28'][0].h='\" onmouseover=alert(1)'}]){
  const data=fixture();modify(data);assert.throws(()=>api.checkedState(data));
 }
 const poison=JSON.parse('{"h":[],"__proto__":{"polluted":true}}');assert.throws(()=>api.checkedState(poison));
 api.reset(fixture());assert.throws(()=>api.setP('__proto__.polluted',1));
});
test('calendar escapes event text and accepts a safe non-half-hour time',()=>{
 const {api}=harness(),data=fixture();data.ev['2026-10-28'][0]={t:'<img src=x onerror=alert(1)>',h:'10:15',c:0};
 api.reset(data);api.ui.cd='2026-10-28';api.ui.cm='2026-10';api.ui.ed=0;
 const html=api.vC();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(html.includes('10:15'));
});
