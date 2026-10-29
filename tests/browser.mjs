// Prueba con un backend SIMULADO; no demuestra RLS ni entrega real de correo.
// npm install --no-save playwright ; npx playwright install chromium
// Terminal 1: python3 -m http.server 8765 --directory public
// Terminal 2: node tests/browser.mjs
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
const rows=new Map();let offline=false;const errors=[];
const mockClient=`
export function makeClient(){
 const listeners=[];const current=()=>JSON.parse(sessionStorage.getItem('test-user')||'null');
 const emit=()=>listeners.forEach(cb=>cb('SIGNED_IN',current()?{user:current()}:null));
 const req=async(body)=>{const r=await fetch('/mock',{method:'POST',body:JSON.stringify({...body,uid:current()?.id})});return r.json()};
 return {
 auth:{getSession:async()=>({data:{session:current()?{user:current()}:null}}),onAuthStateChange:cb=>listeners.push(cb),
 signInWithOtp:async({email})=>{sessionStorage.setItem('test-email',email);return {}},
 verifyOtp:async({token})=>{if(token!=='123456')return {error:Error('Código inválido')};const user={id:'00000000-0000-0000-0000-000000000001',email:sessionStorage.getItem('test-email')};sessionStorage.setItem('test-user',JSON.stringify(user));emit();return {data:{user}}},
 signOut:async()=>{sessionStorage.removeItem('test-user');listeners.forEach(cb=>cb('SIGNED_OUT',null));return {}}},
 from:()=>({select:cols=>({eq:(_,uid)=>({maybeSingle:()=>req({op:'read',cols,uid})})})}),
 rpc:(name,p)=>req({op:name,p})};
}`;
async function tab(width=1280){
 const context=await browser.newContext({viewport:{width,height:850}});
 await context.route('**/client.js',r=>r.fulfill({contentType:'application/javascript',body:mockClient}));
 await context.route('**/mock',async route=>{
  const b=route.request().postDataJSON();let result;
  if(offline)result={error:{message:'offline'}};
  else if(b.op==='read'){const row=rows.get(b.uid);result={data:row?(b.cols==='revision'?{revision:row.revision}:row):null};}
  else if(b.op==='save_planner'){
   const row=rows.get(b.uid),op=b.p;
   if(row?.revision===op.p_revision)result={data:{revision:row.revision}};
   else if((row?.revision||null)!==op.p_expected)result={error:{message:'STATE_CONFLICT'}};
   else{rows.set(b.uid,{data:op.p_data,revision:op.p_revision});result={data:{revision:op.p_revision}};}
  }else result={error:{message:'ADMIN_REQUIRED'}};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8765/');return page;
}
async function login(p){
 await p.locator('#email').fill('test@example.com');await p.locator('#send-code').click();
 await p.locator('#code').fill('123456');await p.locator('#code-form .btn').first().click();
 await p.locator('#planner').waitFor({state:'visible'});
}
async function saved(p){await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado en la nube');}
try{
 const p=await tab();await login(p);await p.locator('[data-a=startpreset][data-k=full]').click();await saved(p);
 await p.locator('[data-a=dt][data-k=n]').click();const note=p.locator('textarea[data-p$=".n"]');
 await note.fill('Mi reflexión privada 🧡');await p.locator('#save-now').click();await saved(p);
 await p.reload();await p.locator('#planner').waitFor({state:'visible'});await p.locator('[data-a=dt][data-k=n]').click();
 assert.equal(await p.locator('textarea[data-p$=".n"]').inputValue(),'Mi reflexión privada 🧡');
 // Hábito y registro histórico.
 await p.locator('#nav [data-k=h]').click();await p.locator('[data-a=hadd]').click();
 await p.locator('#habitName').fill('Caminar');await p.locator('#habitForm button[type=submit]').click();
 await p.locator('[data-a=hab]').click();await p.locator('#save-now').click();await saved(p);
 // Tarea semanal trasladada: conserva source y completado en ambos sentidos.
 await p.locator('#nav [data-k=w]').click();await p.locator('input[data-p$=".a.0.t"]').fill('Estudiar');
 await p.locator('[data-a=move][data-r=a][data-i="0"]').click();await p.locator('#moveForm .btn').click();
 await p.locator('[data-a=tog][data-p$=".k.1.c"]').click();await p.locator('#save-now').click();await saved(p);
 const state=rows.values().next().value.data,week=Object.values(state.w)[0];
 assert.equal(week.a[0].c,true);assert.ok(Object.values(state.d).some(d=>d.k?.[1]?.source));
 // Otro dispositivo recupera la misma agenda.
 const q=await tab(390);await login(q);await q.locator('[data-a=dt][data-k=n]').click();
 assert.equal(await q.locator('textarea[data-p$=".n"]').inputValue(),'Mi reflexión privada 🧡');
 assert.equal(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Carrera real entre dos pestañas con la misma revisión.
 await p.locator('[data-a=dt][data-k=n]').click();await p.locator('textarea[data-p$=".n"]').fill('Desde computador');
 await p.locator('#save-now').click();await saved(p);
 await q.locator('textarea[data-p$=".n"]').fill('Desde celular');await q.locator('#save-now').click();
 await q.locator('#cloud-error').waitFor({state:'visible'});assert.match(await q.locator('#cloud-status').textContent(),/otro dispositivo/);
 const downloadEvent=q.waitForEvent('download');await q.locator('#rescue').click();await downloadEvent;
 q.once('dialog',d=>d.accept());await q.locator('#load-cloud').click();await q.locator('#planner:not([inert])').waitFor();
 await q.locator('[data-a=dt][data-k=n]').click();assert.equal(await q.locator('textarea[data-p$=".n"]').inputValue(),'Desde computador');
 // Desconexión: congela edición y permite recuperar sin borrar memoria.
 offline=true;await p.locator('textarea[data-p$=".n"]').fill('Pendiente sin red');await p.locator('#save-now').click();
 await p.locator('#cloud-error').waitFor({state:'visible'});offline=false;await p.locator('#retry-save').click();await saved(p);
 // Importación repetida reemplaza, no acumula. Respaldo exportado v2.
 const imported=structuredClone(rows.values().next().value.data),backup=Buffer.from(JSON.stringify({format:'con-intencion',version:2,data:imported}));
 for(let i=0;i<2;i++){
  await p.locator('#dbt').click();p.once('dialog',d=>d.accept());
  await p.locator('#imp').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:backup});
  await p.waitForFunction(()=>!document.querySelector('#dlg').open);await saved(p);
 }
 assert.deepEqual(rows.values().next().value.data,imported);
 assert.equal(await p.evaluate(()=>localStorage.getItem('agenda1')),null);
 await p.locator('#logout').click();await p.locator('#login-form').waitFor({state:'visible'});
 assert.equal(await p.locator('#v').textContent(),'');assert.equal(await p.locator('#planner').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS: login, reload, habits, task source/sync, mobile, conflicts, offline/retry, repeated import, logout. Backend simulated.');
}finally{await browser.close();}
