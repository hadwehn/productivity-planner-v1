import { makeClient } from './client.js';
import { CloudStore } from './store.js';
let cloud=null,ready=false,client=null,sessionUser=null,polling=false,authGeneration=0;

const $=s=>document.querySelector(s);
const M=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const D=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const Q=[["Ningún día en el que aprendes algo es una pérdida total.","David Eddings"],["La vida es como andar en bicicleta. Para mantener el equilibrio, debes seguir avanzando.","Albert Einstein"],["Tu éxito es una serie de pequeñas victorias.","Jamie Tardy"],["Conviértete en todo aquello que eres capaz de llegar a ser.","Abraham Maslow"],["El optimismo es la fe que conduce al logro.","Helen Keller"],["Una clave importante para la confianza en uno mismo es la preparación.","Arthur Ashe"],["Define el éxito según tus propios términos. Alcánzalo siguiendo tus propias reglas.","Anne Sweeney"]];
const p2=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const pd=s=>{const a=s.split('-');return new Date(+a[0],a[1]-1,+a[2])};
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const wd=d=>(d.getDay()+6)%7, mon=d=>add(d,-wd(d)), td=()=>iso(new Date());
const ym=(s,n)=>{const a=s.split('-'),d=new Date(+a[0],a[1]-1+n,1);return d.getFullYear()+'-'+p2(d.getMonth()+1)};
const mt=s=>{const a=s.split('-');return M[a[1]-1]+' '+a[0]};
const dim=s=>{const a=s.split('-');return new Date(+a[0],+a[1],0).getDate()};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let S,loadFailure=false;
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const blank=()=>({h:[],hl:{},m:{},ev:{},w:{},d:{},cfg:{acc:0,hide:{},days:{}}});
function validateState(o){
 if(!plain(o)||!Array.isArray(o.h))throw Error('Falta la lista de hábitos.');
 const check=(v,depth=0)=>{if(depth>30)throw Error('Archivo demasiado complejo.');if(v&&typeof v==='object')for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Clave no permitida.');check(v[k],depth+1)}};check(o);
 for(const k of ['hl','m','ev','w','d'])if(o[k]!==undefined&&!plain(o[k]))throw Error('Formato incorrecto: '+k);
 if(o.cfg!==undefined&&!plain(o.cfg))throw Error('Preferencias incorrectas.');
 for(const h of o.h)if(!plain(h)||typeof h.id!=='string'||!h.id||typeof h.name!=='string'||(h.days!==undefined&&(!Array.isArray(h.days)||h.days.some(d=>!Number.isInteger(d)||d<0||d>6))))throw Error('Hábito incorrecto.');
 if(o.cfg?.order!==undefined&&(!Array.isArray(o.cfg.order)||o.cfg.order.some(x=>typeof x!=='string')))throw Error('Orden de módulos incorrecto.');
 if(new Set(o.h.map(h=>h.id)).size!==o.h.length)throw Error('Hábitos duplicados.');
 for(const v of Object.values(o.ev||{}))if(!Array.isArray(v)||v.some(x=>typeof x!=='string'&&(!plain(x)||typeof x.t!=='string'||(x.h!==undefined&&typeof x.h!=='string'))))throw Error('Evento incorrecto.');
 for(const k of ['hl','m','w','d'])for(const v of Object.values(o[k]||{}))if(!plain(v))throw Error('Registro incorrecto: '+k);
 for(const k of ['hide','days'])if(o.cfg?.[k]!==undefined&&!plain(o.cfg[k]))throw Error('Preferencias incorrectas.');
 for(const v of Object.values(o.cfg?.days||{}))if(!plain(v))throw Error('Día personalizado incorrecto.');
 for(const day of Object.values(o.d||{})){if(day.k!==undefined&&(!plain(day.k)&&!Array.isArray(day.k)))throw Error('Tareas diarias incorrectas.');for(const row of Object.values(day.k||{}))if(row!==null&&(!plain(row)||(row.t!==undefined&&typeof row.t!=='string')))throw Error('Tarea incorrecta.');if(day.otherCount!==undefined&&(!Number.isInteger(day.otherCount)||day.otherCount<2||day.otherCount>500))throw Error('Cantidad de tareas incorrecta.');if(day.priorityCount!==undefined&&(!Number.isInteger(day.priorityCount)||day.priorityCount<1||day.priorityCount>3))throw Error('Cantidad de prioridades incorrecta.');if(day.c!==undefined&&!plain(day.c))throw Error('Agenda incorrecta.');}
 for(const week of Object.values(o.w||{}))for(const k of ['a','b']){if(week[k]!==undefined&&!plain(week[k])&&!Array.isArray(week[k]))throw Error('Tareas semanales incorrectas.');for(const row of Object.values(week[k]||{}))if(row!==null&&(!plain(row)||(row.t!==undefined&&typeof row.t!=='string')))throw Error('Tarea semanal incorrecta.');}
 return o;
}
function normalize(o){const v=Object.assign(blank(),o);v.cfg=Object.assign({acc:0,hide:{},days:{}},v.cfg);v.cfg.hide=v.cfg.hide||{};v.cfg.days=v.cfg.days||{};v.cfg.theme=v.cfg.theme==='soft'?'soft':'modern';Object.keys(v.ev).forEach(k=>v.ev[k]=v.ev[k].map(x=>typeof x==='string'?{t:x,c:0,h:''}:{...x,c:Number.isInteger(x.c)&&x.c>=-1&&x.c<6?x.c:-1}));return v;}
S=normalize(blank());

// Identidad azul permanente; dos paletas para los elementos personalizables.
const ACC=['#3569B0','#C24A32','#247759','#744DB2','#B86D08','#176A83']; // Compatibilidad con respaldos anteriores.
const PALETTES={
 modern:['#3569B0','#FF4050','#2FC45B','#AC4EDF','#FF9B00','#24AFC1'],
 soft:['#3569B0','#B96B65','#4D8970','#9478B5','#C28F44','#518D9B']
};
const EC=PALETTES.modern;
const eventColor=i=>i===-1?'#A6ADB7':(PALETTES[S.cfg.theme==='soft'?'soft':'modern'])[Number.isInteger(i)&&i>=0&&i<6?i:0];
const colorSwatches=selected=>Array.from({length:6},(_,i)=>`<span class="theme-dot${selected===i?' active':''}" style="background:${eventColor(i)}"></span>`).join('');
// Una taxonomía para hábitos y calendario: el índice conserva el color y los respaldos existentes.
// Los nombres describen ámbitos de la vida, no restringen qué puede registrarse en ellos.
const CATEGORY_NAMES=['Trabajo y estudios','Hogar y gestiones','Salud y movimiento','Ocio y creatividad','Otros','Relaciones y social'];
// Orden fijo por frecuencia esperada; los índices y colores existentes no se alteran.
const CATEGORY_ORDER=[2,0,5,1,3,4];
const categoryName=i=>i===-1?'Sin categoría':CATEGORY_NAMES[Number.isInteger(i)&&i>=0&&i<6?i:0];
const TS=['',...Array.from({length:48},(_,i)=>p2(i>>1)+':'+(i%2?'30':'00'))];
function applyAcc(){
 const root=document.documentElement;
 root.style.setProperty('--acc','#3569B0');
 root.style.setProperty('--acc-soft','#EDF3FB');
 root.dataset.theme=S.cfg.theme==='soft'?'soft':'modern';
 document.querySelectorAll('[data-a=theme]').forEach(b=>{
  const on=b.dataset.k===root.dataset.theme;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));
 });
}
applyAcc();
const DEF={d_pl_wk:false,d_star_we:true,d_oth_we:true,d_co_we:false,d_hab_wk:true,d_hab_we:true,d_co_wk:false,d_learn_wk:false,d_learn_we:false,d_remember_wk:false,d_remember_we:false};
const vis=k=>{const v=S.cfg.hide[k];return v===undefined?DEF[k]!==false:!v};
function migCfg(){const h=S.cfg.hide,both=['d_gr','d_hl','d_rf'],wk=['d_star','d_oth','d_co'];
 Object.keys(h).filter(k=>/^d_/.test(k)&&!/_(wk|we)$/.test(k)).forEach(k=>{const v=h[k];delete h[k];
  if(both.includes(k)){h[k+'_wk']=v;h[k+'_we']=v}else if(wk.includes(k))h[k+'_wk']=v;else if(k==='d_pl')h[k+'_we']=v})}
migCfg();
S.cfg.days=S.cfg.days||{};
const dayGroup=w=>w>4?'we':'wk';
const dayVis=(k,w)=>{
 const overrides=S.cfg.days[w]||{};
 return overrides[k]===undefined?vis(k+'_'+dayGroup(w)):overrides[k];
};
const hasDayOverrides=w=>Object.keys(S.cfg.days[w]||{}).length>0;
function unifyClosure(){
 if(S.cfg.closeUnified)return;
 const oldDays=D.map((_,w)=>['d_hl','d_rf','d_learn','d_remember'].some(k=>dayVis(k,w)));
 for(const group of ['wk','we'])S.cfg.hide['d_rf_'+group]=!['d_hl','d_rf','d_learn','d_remember'].some(k=>vis(k+'_'+group));
 for(let w=0;w<7;w++){const overrides=S.cfg.days[w]||{};for(const k of ['d_hl','d_learn','d_remember'])delete overrides[k];if(oldDays[w]!==vis('d_rf_'+dayGroup(w)))overrides.d_rf=oldDays[w];else delete overrides.d_rf;if(Object.keys(overrides).length)S.cfg.days[w]=overrides;else delete S.cfg.days[w];}
 S.cfg.closeUnified=true;
}
unifyClosure();
function setDayVisibility(k,w,value){const overrides=S.cfg.days[w]=S.cfg.days[w]||{};if(value===vis(k+'_'+dayGroup(w)))delete overrides[k];else overrides[k]=value;if(!Object.keys(overrides).length)delete S.cfg.days[w];}
function setGroupVisibility(k,group,value){S.cfg.hide[k+'_'+group]=!value;}
const empty=()=>'<p class="sub" style="text-align:center;margin:40px 0">Tienes todo oculto. Actívalo desde el botón ⋯.</p>';
const WQ=['¿Qué te hizo bien esta semana?','¿Qué quieres retomar o dejar para después?','¿Qué aprendiste y te gustaría llevar a la próxima semana?','¿Qué podrías ajustar para cuidarte y enfocarte mejor?'];
const OPT={w:[['Plan',[['w_prog','Progreso de la semana'],['w_int','Intención de la semana'],['w_imp','Tareas importantes'],['w_sec','Tareas secundarias']]],['Revisión',WQ.map((q,i)=>['w_r'+i,q])]],d:[['Plan',[['d_int','Intención del día'],['d_hab','Hábitos del día'],['d_gr','Gratitud'],['d_star','Tareas más importantes'],['d_oth','Tareas secundarias'],['d_co','Compromisos con hora'],['d_pl','Planes del día'],['d_rf','Reflexión del día']]]]};
const PRESETS={
 light:{label:'Ligero',description:'Una intención, tu prioridad y una reflexión breve.',modules:['d_int','d_star','d_rf']},
 balanced:{label:'Equilibrado',description:'Intención, gratitud, hábitos, tareas y reflexión.',modules:['d_int','d_gr','d_hab','d_star','d_oth','d_rf']},
 full:{label:'Completo',description:'Todos los espacios, incluidos planes y agenda por horas.',modules:['d_int','d_gr','d_hab','d_star','d_oth','d_pl','d_co','d_rf']}
};
function modeCards(action='preset',selected=S.cfg.preset){return `<div class="mode-list">${Object.entries(PRESETS).map(([key,p])=>`<button class="mode-card${key===selected?' selected':''}" data-a="${action}" data-k="${key}" aria-pressed="${key===selected}"><b>${p.label}</b><span>${p.description}</span></button>`).join('')}</div>`;}
function applyPreset(key,initial=false){const preset=PRESETS[key];if(!preset)return;for(const [k] of OPT.d[0][1])for(const group of ['wk','we'])setGroupVisibility(k,group,preset.modules.includes(k));if(initial)S.cfg.days={};S.cfg.preset=key;S.cfg.closeUnified=true;save();}
const persHTML=()=>{const daily=dailyPrefsHTML(OPT.d[0][1]);if(U.tab!=='w')return daily;return daily+`<details><summary class="link">Personalizar la semana</summary><p class="sub">Ocultar espacios conserva lo que escribiste.</p>${OPT.w.map(([n,L])=>`<h2 class="pref-title">${n}</h2>`+L.map(([k,l])=>`<label class="tg"><span>${l}</span><input type="checkbox" data-a="vis" data-k="${k}"${vis(k)?' checked':''}></label>`).join('')).join('')}</details><hr class="hr0">`;};
function dailyPrefsHTML(items){
 const perDay=U.pm==='day',w=U.pday;
 const rows=[['Al partir el día',items.filter(x=>['d_int','d_gr'].includes(x[0]))],['Durante el día',items.filter(x=>!['d_int','d_gr','d_rf'].includes(x[0]))],['Al terminar el día',items.filter(x=>x[0]==='d_rf')]].map(([title,list])=>`<h2 class="pref-title">${title}</h2>`+list.map(([k,label])=>`<label class="tg"><span>${label}</span><input id="pref-${k}" type="checkbox" data-a="dayvis" data-k="${k}"${dayVis(k,w)?' checked':''}></label>`).join('')).join('');
 return `<h2>Tu día, a tu manera</h2><p class="sub">Elige una categoría o adapta cada día. Tus respuestas siempre se conservan.</p><div class="seg prefs-tabs"><button id="pref-mode-group" class="${!perDay?'on':''}" data-a="prefmode" data-k="group" aria-pressed="${!perDay}">Por categoría</button><button id="pref-mode-day" class="${perDay?'on':''}" data-a="prefmode" data-k="day" aria-pressed="${perDay}">Por día</button></div>`
 +(perDay?`<div class="day-picks" aria-label="Día de la semana">${D.map((name,i)=>`<button id="pref-day-${i}" class="${i===w?'on ':''}${hasDayOverrides(i)?'custom':''}" data-a="prefday" data-i="${i}" aria-label="${name}" aria-pressed="${i===w}">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][i]}</button>`).join('')}</div><b>${D[w]}</b><p class="sub pref-state">${hasDayOverrides(w)?'Este día tiene ajustes propios.':'Este día sigue '+(PRESETS[S.cfg.preset]?.label.toLowerCase()||'tu configuración actual')+'.'} Los cambios se aplican cada ${D[w].toLowerCase()}.</p>${hasDayOverrides(w)?'<button id="pref-reset" class="pref-reset" data-a="prefreset">Volver a la categoría base</button>':''}<div class="pref-list">${rows}</div>${sortPrefs()}`
 :modeCards()+`<p class="mode-description">La categoría se aplica a todos los días. ${hasAnyDayOverrides()?'Tus ajustes por día se mantienen y tienen prioridad.':'Puedes adaptar cualquier día en la otra pestaña.'}</p>${hasAnyDayOverrides()?'<button class="link" data-a="allreset">Aplicar la categoría también a los días personalizados</button>':''}`)
 +'<hr class="hr0">';
}
function hasAnyDayOverrides(){return D.some((_,w)=>hasDayOverrides(w));}
function refreshPrefs(focusId){
 const dialog=$('#dlg'),top=dialog.scrollTop;
 const expanded=$('#pers details')?.open;$('#pers').innerHTML=persHTML();if($('#pers details'))$('#pers details').open=!!expanded;R();dialog.scrollTop=top;
 const target=document.getElementById(focusId);if(target)target.focus({preventScroll:true});
}
let statusTimer;
function toast(message){$('#status').textContent=message;$('#status').classList.add('show');clearTimeout(statusTimer);statusTimer=setTimeout(()=>$('#status').classList.remove('show'),3200)}
const save=()=>{if(!cloud||!ready)return false;return cloud.schedule(()=>checkedState(S));};
const g=(p,d='')=>{const v=p.split('.').reduce((o,k)=>o==null?o:o[k],S);return v??d};
function setP(p,v){const k=p.split('.');if(k.some(x=>['__proto__','constructor','prototype'].includes(x)))throw Error('Ruta no permitida.');let o=S;for(let i=0;i<k.length-1;i++){const key=k[i];if(o[key]==null)o[key]=/^\d+$/.test(k[i+1])?[]:{};o=o[key]}o[k[k.length-1]]=v;save()}

const U={startOpen:true,endOpen:true,tab:'d',hd:td(),ed:-1,pop:null,hm:td().slice(0,7),cm:td().slice(0,7),cd:td(),wk:iso(mon(new Date())),wt:'p',dd:td(),dt:'p',co:false,pm:'group',pday:wd(pd(td()))};

const inp=(p,ph='')=>`<textarea data-p="${p}" rows="1" aria-label="${esc(ph||p)}" placeholder="${esc(ph)}">${esc(g(p))}</textarea>`;
const ta=(p,ph='',r=3)=>`<textarea aria-label="${esc(ph||p)}" data-p="${p}" rows="${r}" placeholder="${esc(ph)}">${esc(g(p))}</textarea>`;
const pageHeader=(t,s='')=>`<div class="top"><div><h1>${t}</h1><div class="sub">${s}</div></div></div>`;
const mn=(k,s)=>`<div class="top" style="margin-top:0"><button class="ib" data-a="m" data-k="${k}" data-n="-1" aria-label="Mes anterior">‹</button><div style="text-align:center"><b style="text-transform:capitalize">${mt(s)}</b>${s!==td().slice(0,7)?`<br><button class="sub" style="text-decoration:underline;min-height:28px" data-a="hoy" data-k="${k}">Ir a hoy</button>`:''}</div><button class="ib" data-a="m" data-k="${k}" data-n="1" aria-label="Mes siguiente">›</button></div>`;
const chk=(p)=>{const c=g(p,false);return `<button class="chk${c?' on':''}" data-a="tog" data-p="${p}" aria-label="Marcar tarea" aria-pressed="${!!c}">${c?'✓':''}</button>`};

function vH(){
 const m=U.hm,n=dim(m),T=td();
 if(U.hd.slice(0,7)!==m)U.hd=m===T.slice(0,7)?T:m+'-01';
 let st='',ok=0;
 for(let i=1;i<=n;i++){const k=m+'-'+p2(i);st+=`<button class="chip${k===U.hd?' on':''}" data-a="hd" data-k="${k}"><span>${D[wd(pd(k))][0]}</span><b>${i}</b></button>`}
 const L=S.h.map(h=>{
  let c=0,scheduled=0,cells='';
  for(let i=1;i<=n;i++){const k=m+'-'+p2(i),v=(S.hl[k]||{})[h.id]||0;if(k<=T&&habitDue(h,k)){scheduled++;if(v===1)c++}cells+=`<i class="c${v===1?1:0}${k===T?' t':''}"></i>`}
  let streak=0;for(let back=0;back<370;back++){const date=iso(add(pd(T),-back));if(h.createdOn&&date<h.createdOn)break;if(!habitDue(h,date))continue;if((S.hl[date]||{})[h.id]===1)streak++;else if(date!==T)break;}
  ok+=c;const v=(S.hl[U.hd]||{})[h.id]||0,pc=scheduled?Math.round(c/scheduled*100):0;
  return `<div class="card habit-card" data-habit-id="${esc(h.id)}" style="--habit-color:${eventColor(h.color??0)}" title="${categoryName(h.color??0)}"><div class="row"><button type="button" class="habit-drag-handle" data-habit-drag="${esc(h.id)}" aria-label="Mover ${esc(h.name)}. Usa las flechas arriba y abajo, o mantén presionado y arrastra." title="Arrastrar para ordenar · flechas ↑ ↓" aria-keyshortcuts="ArrowUp ArrowDown">⠿</button><button class="hb s${v===1?1:0}${U.pop===h.id?' pop':''}" data-a="hab" data-id="${esc(h.id)}" aria-label="Marcar">${v===1?'✓':''}</button><div style="flex:1"><b>${esc(h.name)}</b><div class="sub">${c} de ${scheduled} días previstos · ${streak} ${streak===1?'día':'días'} de racha</div></div><div class="ring" style="--p:${pc}"><span>${pc}%</span></div><button class="ib" data-a="hen" data-id="${esc(h.id)}" aria-label="Editar">✎</button></div><div class="grid">${cells}</div></div>`}).join('');
 const tot=S.h.reduce((sum,h)=>sum+Array.from({length:n},(_,i)=>m+'-'+p2(i+1)).filter(k=>k<=T&&habitDue(h,k)).length,0),pc=tot?Math.round(ok/tot*100):0,full=S.h.length&&S.h.every(h=>(S.hl[U.hd]||{})[h.id]===1);
 return `<div class="sticky-page-head">${pageHeader('Hábitos','Pequeños pasos. Siempre puedes retomar.')+mn('hm',m)}</div>`
  +'<button class="btn habit-add-top" data-a="hadd">＋ Nuevo hábito</button>'
  +(S.h.length?`<div class="card"><div class="row"><div class="ring big" style="--p:${pc}"><span>${pc}%</span></div><div><b>Tu mes</b><div class="sub">${ok} registros. Los días futuros no cuentan.</div></div></div></div>`:'')
  +`<div class="strip">${st}</div>`
  +(L||'<p class="sub">Aún no tienes hábitos. Crea el primero.</p>')
  +'<p class="habit-tip">Cada marca cuenta. La racha solo considera tus días programados y puedes retomarla cuando quieras.</p>';
}

function vC(){
 const m=U.cm,a=m.split('-').map(Number),off=wd(new Date(a[0],a[1]-1,1)),n=dim(m),rows=Math.ceil((off+n)/7);
 let gr=D.map(d=>`<div class="sub">${d[0]}</div>`).join('');
 for(let i=0;i<rows*7;i++){
  const d=i-off+1;if(d<1||d>n){gr+='<div></div>';continue}
  const k=m+'-'+p2(d),e=(S.ev[k]||[]).filter(x=>x.t.trim()||x.h);
  gr+=`<button class="cd${k===U.cd?' sel':''}${k===td()?' today':''}${e.length?' has':''}" data-a="cd" data-k="${k}">${d}<span class="dts">${e.slice(0,3).map(x=>`<u style="background:${k===U.cd?'#fff':eventColor(x.c)}"></u>`).join('')}</span></button>`}
  const t=pd(U.cd),L=(S.ev[U.cd]||[]).map((x,i)=>({x,i})).sort((p,q)=>(p.x.h||'99').localeCompare(q.x.h||'99'));
  const list=L.map(({x,i})=>`<button class="ev" style="--c:${eventColor(x.c??-1)}" data-a="eventedit" data-i="${i}" aria-label="Editar evento ${esc(x.t||'Sin título')}"><b>${esc(x.h||'Todo el día')}</b><span>${esc(x.t)||'Sin título'}</span></button>`).join('');
 const tri=k=>[0,1,2].map(i=>`<div class="row"><span class="num">${i+1}</span>${inp('m.'+m+'.'+k+'.'+i)}</div>`).join('');
 return `<div class="sticky-page-head">${pageHeader('Calendario')+mn('cm',m)}</div>`+`<div class="card"><div class="cal">${gr}</div></div>`
  +`<div class="card"><h2>${D[wd(t)]} ${t.getDate()} de ${M[t.getMonth()]}</h2>${list||'<p class="sub" style="margin:0 0 8px">Día libre. Agrega lo que quieras recordar.</p>'}<button class="btn ghost" data-a="eva">+ Evento</button></div>`
  +`<div class="card"><h2>3 prioridades del mes</h2>${tri('p')}</div><div class="card"><h2>3 highlights del mes</h2>${tri('h')}</div>`;
}

function vW(){
 const k=U.wk,a=pd(k),b=add(a,6),W='w.'+k+'.',f=d=>d.getDate()+' '+M[d.getMonth()].slice(0,3);
 const rowsF=r=>[0,1,2,3,4].map(i=>`<div class="row${g(W+r+'.'+i+'.c',false)?' done':''}"><span class="num">${i+1}</span>${chk(W+r+'.'+i+'.c')}${inp(W+r+'.'+i+'.t','Tarea '+(i+1))}${g(W+r+'.'+i+'.t')?`<button class="tiny-action" data-a="move" data-r="${r}" data-i="${i}" aria-label="Planificar en un día">↗</button>`:''}</div>`).join('');
 const head=`<div class="sticky-page-head"><div class="top"><button class="ib" data-a="wk" data-n="-1" aria-label="Semana anterior">‹</button><div style="text-align:center"><h1>Semana</h1><div class="sub">${f(a)} – ${f(b)}${k!==iso(mon(new Date()))?' · <button data-a="hoyw" style="text-decoration:underline">Esta semana</button>':''}</div></div><button class="ib" data-a="wk" data-n="1" aria-label="Semana siguiente">›</button></div><div class="seg"><button class="${U.wt==='p'?'on':''}" data-a="wt" data-k="p">Plan</button><button class="${U.wt==='r'?'on':''}" data-a="wt" data-k="r">Revisión</button></div></div>`;
 if(U.wt==='r')return head+(WQ.map((q,i)=>vis('w_r'+i)?`<div class="card"><label class="q">${i+1}. ${q}</label>${ta(W+'r.'+i,'',4)}</div>`:'').join('')||empty());
 const planned=['a','b'].map(r=>[0,1,2,3,4].filter(i=>String(g(W+r+'.'+i+'.t')).trim()).length),dn=['a','b'].map(r=>[0,1,2,3,4].filter(i=>String(g(W+r+'.'+i+'.t')).trim()&&g(W+r+'.'+i+'.c',false)).length),total=planned[0]+planned[1],pc=total?Math.round((dn[0]+dn[1])/total*100):0;
 const P=[['w_prog',`<div class="card"><div class="row"><div id="weekProgress" class="ring big" style="--p:${pc}"><span>${dn[0]+dn[1]}/${total}</span></div><div><b>Tu semana</b><div class="sub">${total?'Avanza a tu ritmo. Solo contamos tareas escritas.':'Elige unas pocas tareas que valgan tu tiempo.'}</div></div></div></div>`],
  ['w_int',`<div class="card intent"><h2>Intención de la semana</h2>${ta(W+'i','¿Cuál es mi intención para esta semana?',2)}</div>`],
  ['w_imp',`<div class="card pr"><h2>Prioridades de la semana</h2><p class="sub" style="margin:-4px 0 4px">Hasta cinco. No necesitas llenar todos los espacios.</p>${rowsF('a')}</div>`],
  ['w_sec',`<div class="card"><h2>Otras tareas de la semana</h2>${rowsF('b')}</div>`]].filter(x=>vis(x[0])).map(x=>x[1]).join('');
 return head+monthContext(k)+(P||empty());
}

// Dos filas iniciales; las adicionales se guardan para cada fecha.
function otherTaskCount(date){
 const day=S.d[date]||{},rows=day.k||{};
 const existing=Object.keys(rows).filter(k=>/^\d+$/.test(k)&&Number(k)>0&&Number(k)<=500).map(Number);
 const stored=Number(day.otherCount);
 return Math.max(2,Number.isFinite(stored)?Math.floor(stored):2,...existing);
}
function vD(){
 const k=U.dd,t=pd(k),w=wd(t),Z='d.'+k+'.';
 const head=`<div class="sticky-page-head"><div class="top"><button class="ib" data-a="dd" data-n="-1" aria-label="Día anterior">‹</button><div style="text-align:center"><h1>${D[w]}</h1><div class="sub">${t.getDate()} de ${M[t.getMonth()]} ${t.getFullYear()}${k!==td()?' · <button data-a="today" style="text-decoration:underline">Hoy</button>':''}</div></div><button class="ib" data-a="dd" data-n="1" aria-label="Día siguiente">›</button></div><div class="seg"><button class="${U.dt!=='n'?'on':''}" data-a="dt" data-k="p">Planificación</button><button class="${U.dt==='n'?'on':''}" data-a="dt" data-k="n">Notas</button></div></div>`;
 if(U.dt==='n')return head+'<p class="section-note">Un espacio libre para tus ideas, sin orden ni reglas.</p>'+ta(Z+'n','Escribe tus notas…',12);
 const gr=`<div class="card gratitude-card"><h2>Estoy agradecido por...</h2><p class="sub gratitude-hint">No hace falta llenar los tres espacios. Agradece a tu manera.</p><div class="gratitude-list">${['g','g2','g3'].map((f,i)=>`<div class="gratitude-row"><span class="gratitude-number">${i+1}</span>${ta(Z+f,'Algo que agradezco…',2)}</div>`).join('')}</div></div>`;
 const intention=`<div class="card intent"><h2>Intención del día</h2>${ta(Z+'i','¿Cómo quieres vivir este día?',2)}</div>`;
 const rf=closureCard(k);
 const priorityCount=Math.max(1,Math.min(3,S.d[k]?.priorityCount||1,...[501,502].filter(i=>S.d[k]?.k?.[i]?.t?.trim()).map(i=>i===501?2:3)));
 const carrySvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h8a5 5 0 0 1 0 10H7"/><path d="m11 13-4 4 4 4" transform="translate(0 -0.01)"/></svg>';
 const task=i=>{const P=Z+'k.'+i+'.',s=g(P+'s',0),filled=!!String(g(P+'t')).trim(),priority=i===0||i>=501;
  const remove=i===0?`<button class="tiny-action remove-action" data-a="taskclear" title="Borrar prioridad" aria-label="Borrar prioridad">×</button>`:`<button class="tiny-action remove-action" data-a="taskremove" data-i="${i}" title="Eliminar tarea" aria-label="Eliminar tarea">×</button>`;
  const carry=`<button class="tiny-action carry-action" data-a="carrytask" data-i="${i}" title="Mover al día siguiente" aria-label="Mover tarea al día siguiente" ${filled?'':'hidden'}>${carrySvg}</button>`;
  return `<div class="task-line${g(P+'c',false)?' done':''}" ${!priority?`data-task-index="${i}"`:''}><div class="row">${!priority?`<button type="button" class="drag-handle" data-drag-index="${i}" aria-label="Arrastrar tarea para reordenar" title="Arrastrar">⠿</button>`:''}${chk(P+'c')}${inp(P+'t',priority?'¿Qué merece tu atención hoy?':'Tarea secundaria')}<div class="task-actions">${remove}${carry}</div></div><details class="effort"><summary>${s?s+' sesiones registradas':'Registrar sesiones de enfoque'}</summary><div class="dots">${[0,1,2,3,4].map(j=>`<button class="dot${j<s?' on':''}" data-a="dot" data-p="${P}s" data-j="${j}" aria-pressed="${j<s}" aria-label="Registrar ${j+1} sesiones de 30 minutos"></button>`).join('')}<span class="sub">× 30 min</span></div></details></div>`};
 const co=U.co;
 const hrs=[...Array(34)].map((_,i)=>({k:'h'+(6+(i>>1))+(i%2?'b':''),l:(6+(i>>1))+':'+(i%2?'30':'00')}));
 const modules=[['d_int',intention],['d_hab',dailyHabits(k)],['d_gr',gr],['d_pl',`<div class="card"><label class="q">Planes del día</label>${ta(Z+'p','Planes, actividades, compromisos…',6)}</div>`],['d_star',`<div class="card hi"><h2>★ ${priorityCount===1?'Tarea más importante':'Tareas más importantes'}</h2>${[0,501,502].slice(0,priorityCount).map(i=>task(i,true)).join('')}${priorityCount<3?'<button class="task-add" data-a="priorityadd">＋ Añadir prioridad</button>':''}</div>`],['d_oth',`<div class="card"><h2>Tareas secundarias</h2>${Array.from({length:otherTaskCount(k)},(_,i)=>task(i+1)).join('')}<button class="task-add" data-a="taskadd"><span aria-hidden="true">＋</span>Añadir tarea</button></div>`],
  ['d_co',`<div class="card"><button class="sh" data-a="co" aria-expanded="${co}">Agenda por horas (opcional)<span>${co?'−':'+'}</span></button>${co?hrs.map(h=>`<div class="row"><span class="sub hr">${h.l}</span>${inp(Z+'c.'+h.k)}</div>`).join(''):''}</div>`],['d_rf',rf]];
 const ordered=moduleOrder(modules).filter(x=>!['d_int','d_gr','d_rf'].includes(x[0])&&dayVis(x[0],w));
 const morning=modules.filter(x=>['d_int','d_gr'].includes(x[0])&&dayVis(x[0],w));
 const reflection=dayVis('d_rf',w)?`<section class="day-phase"><button class="phase-toggle" data-a="phase" data-k="end" aria-expanded="${U.endOpen}"><span>Al terminar el día</span><span>${U.endOpen?'−':'+'}</span></button>${U.endOpen?rf:''}</section>`:'';
 const quote=`<blockquote class="quote">“${Q[w][0]}”<footer>— ${Q[w][1]}</footer></blockquote>`;
 const beginning=morning.length?`<section class="day-phase"><button class="phase-toggle" data-a="phase" data-k="start" aria-expanded="${U.startOpen}"><span>Al partir el día</span><span>${U.startOpen?'−':'+'}</span></button>${U.startOpen?morning.map(x=>x[1]).join(''):''}</section>`:'';
 const daytime=ordered.length?`<section class="day-work"><h2 class="section-title">Durante el día</h2>${ordered.map(x=>x[1]).join('')}</section>`:'';
 return head+quote+dayContext(k)+(beginning+daytime+reflection||empty());
}

function habitDue(h,date){return (!h.createdOn||date>=h.createdOn)&&(!Array.isArray(h.days)||h.days.includes(wd(pd(date))))}
function dailyHabits(date){const list=S.h.filter(h=>habitDue(h,date));return `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Hábitos del día</h2><button class="link" data-a="go" data-k="h">Ver progreso</button></div>${list.map(h=>{const done=(S.hl[date]||{})[h.id]===1;return `<div class="habit-row" style="--habit-color:${eventColor(h.color??0)}"><button class="chk${done?' on':''}" data-a="dailyhab" data-id="${esc(h.id)}" aria-label="${esc(h.name)}" aria-pressed="${done}">${done?'✓':''}</button><span>${esc(h.name)}</span></div>`}).join('')||'<p class="sub">'+(S.h.length?'Hoy no tienes hábitos previstos.':'Empieza con algo pequeño que te haga bien.')+'</p>'}<button class="task-add" data-a="hadd">＋ Nuevo hábito</button></div>`}
function monthContext(date){const p=Object.values(S.m[date.slice(0,7)]?.p||{}).filter(x=>typeof x==='string'&&x.trim());return p.length?`<div class="context"><b>Tu norte del mes</b><br>${p.map(esc).join(' · ')}</div>`:''}
function dayContext(date){const events=(S.ev[date]||[]).filter(e=>e.t||e.h).slice().sort((a,b)=>(a.h||'99').localeCompare(b.h||'99'));const intention=S.w[iso(mon(pd(date)))]?.i;return (intention?`<div class="context"><b>Esta semana:</b> ${esc(intention)}</div>`:'')+(events.length?`<div class="card"><h2>En tu calendario</h2>${events.map(e=>`<div class="habit-row"><b>${esc(e.h||'Todo el día')}</b><span>${esc(e.t)}</span></div>`).join('')}</div>`:'')}
function closureCard(date){const Z='d.'+date+'.',old=[['hl','Momento que guardaste'],['learn','Lo que aprendiste'],['remember','Lo que quisiste recordar']].filter(([key])=>String(g(Z+key)).trim());return `<div class="card"><label class="q" for="daily-reflection">¿Qué te dejó este día?</label><p class="sub">Una idea que aprendiste, algo que sentiste o un momento que quieras conservar.</p>${ta(Z+'r','Escribe lo que quieras llevar contigo…',3).replace('<textarea','<textarea id="daily-reflection"')}${old.length?`<details class="legacy"><summary>Tus respuestas anteriores (${old.length})</summary>${old.map(([key,label])=>`<label class="q">${label}</label>${ta(Z+key,label,2)}`).join('')}</details>`:''}</div>`;}
function showWelcome(){if(S.cfg.welcomed)return;$('#welcomeDlg').innerHTML=`<div class="modal-head"><h2>Bienvenida</h2><button class="ib" data-a="welcome" aria-label="Configurar más tarde">×</button></div><div class="modal-body"><p class="welcome-lead">Haz espacio para lo que importa.</p><p class="sub">Elige cuánto espacio quieres para planificar y reflexionar. Puedes cambiarlo después desde ⋯.</p>${modeCards('startpreset','balanced')}<button class="link" data-a="welcome">Elegir más tarde</button></div>`;$('#welcomeDlg').showModal();}
const MODULES=['d_int','d_gr','d_star','d_oth','d_hab','d_pl','d_co','d_rf'];
function moduleOrder(list){const order=Array.isArray(S.cfg.order)?S.cfg.order:MODULES;return list.slice().sort((a,b)=>(order.includes(a[0])?order.indexOf(a[0]):99)-(order.includes(b[0])?order.indexOf(b[0]):99))}
function sortPrefs(){return `<details><summary class="link">Ordenar los espacios del día</summary>${moduleOrder(OPT.d[0][1].filter(x=>!['d_int','d_gr','d_rf'].includes(x[0]))).map(([k,l],i,arr)=>`<div class="module-sort"><span>${l}</span><button class="tiny-action" data-a="sort" data-k="${k}" data-n="-1" aria-label="Subir ${l}" ${i===0?'disabled':''}>↑</button><button class="tiny-action" data-a="sort" data-k="${k}" data-n="1" aria-label="Bajar ${l}" ${i===arr.length-1?'disabled':''}>↓</button></div>`).join('')}<p class="sub">La intención y el agradecimiento permanecen al inicio; la reflexión, al final.</p></details>`}
function habitEditor(id){const h=S.h.find(h=>h.id===id);$('#editDlg').innerHTML=`<div class="modal-head"><h2>${h?'Editar':'Nuevo'} hábito</h2><button class="ib" data-a="editclose" aria-label="Cerrar">×</button></div><form id="habitForm" class="modal-body"><label class="q" for="habitName">Algo pequeño que te haga bien</label><input id="habitName" type="text" required maxlength="100" placeholder="Por ejemplo, caminar 10 minutos" value="${esc(h?.name||'')}"><fieldset class="habit-colors"><legend>Categoría</legend><div class="habit-color-list">${CATEGORY_ORDER.map(i=>`<label class="habit-color-choice" title="${categoryName(i)}"><input type="radio" name="habitColor" value="${i}" ${i===(h?.color??0)?'checked':''}><span style="background:${eventColor(i)}"></span><small>${categoryName(i)}</small></label>`).join('')}</div></fieldset><fieldset><legend>¿Qué días quieres hacerlo?</legend><div class="schedule">${D.map((d,i)=>`<label>${d.slice(0,3)}<input type="checkbox" name="days" value="${i}"${!h?.days||h.days.includes(i)?' checked':''}></label>`).join('')}</div></fieldset><button class="btn" type="submit">Guardar hábito</button>${h?'<button class="btn ghost" type="button" data-a="habitdelete" data-id="'+esc(id)+'">Eliminar hábito</button>':''}<p class="sub">Los días libres no cuentan en el progreso. Puedes volver a empezar cuando quieras.</p></form>`;$('#editDlg').showModal();$('#habitForm').onsubmit=e=>{e.preventDefault();const color=Number($('#habitForm input[name=habitColor]:checked')?.value??0),name=$('#habitName').value.trim(),days=[...document.querySelectorAll('#habitForm input[name=days]:checked')].map(x=>+x.value);if(!name||!days.length){toast('Escribe un nombre y elige al menos un día.');return}if(h){h.name=name;h.days=days;h.color=color}else S.h.push({color,id:crypto.randomUUID?crypto.randomUUID():Date.now().toString(36),name,days,createdOn:td()});save();$('#editDlg').close();R();toast('Hábito actualizado; guardado pendiente')};}
function eventEditor(index=null){
 const current=index===null?null:S.ev[U.cd]?.[index];if(index!==null&&!current)return;
 const draft=current?{...current}:{t:'',h:'09:00',c:-1};
 const allDay=!draft.h;
 $('#eventDlg').innerHTML=`<div class="modal-head"><h2>${current?'Editar evento':'Nuevo evento'}</h2><button class="ib" type="button" data-a="eventclose" aria-label="Cerrar">×</button></div><form id="eventForm" class="modal-body"><label class="q" for="eventTitle">Actividad</label><input id="eventTitle" type="text" required maxlength="200" placeholder="¿Qué tienes planeado?" value="${esc(draft.t)}"><div class="event-time"><label class="time-label" for="eventHour">Hora<input id="eventHour" type="time" step="300" value="${esc(draft.h||'09:00')}" ${allDay?'disabled':''}></label><label class="all-day event-all-day"><input id="eventAllDay" type="checkbox" ${allDay?'checked':''}><span>Todo el día</span></label></div><fieldset class="habit-colors event-category-field"><legend>Categoría <span class="optional-hint">(opcional)</span></legend><div class="habit-color-list event-category-list"><label class="habit-color-choice" title="Sin categoría"><input type="radio" name="eventCategory" value="-1" ${current&&draft.c===-1?'checked':''}><span style="background:${eventColor(-1)}"></span><small>Sin categoría</small></label>${CATEGORY_ORDER.map(i=>`<label class="habit-color-choice" title="${categoryName(i)}"><input type="radio" name="eventCategory" value="${i}" ${draft.c===i?'checked':''}><span style="background:${eventColor(i)}"></span><small>${categoryName(i)}</small></label>`).join('')}</div></fieldset><button class="btn" type="submit">${current?'Guardar cambios':'Guardar evento'}</button>${current?'<button class="btn ghost" type="button" data-a="eventdelete">Eliminar evento</button>':''}</form>`;
 $('#eventDlg').showModal();
 $('#eventTitle').focus({preventScroll:true});
 $('#eventAllDay').onchange=e=>{$('#eventHour').disabled=e.target.checked;};
 $('#eventForm').onsubmit=e=>{e.preventDefault();const t=$('#eventTitle').value.trim(),h=$('#eventAllDay').checked?'':$('#eventHour').value,c=Number($('#eventForm input[name=eventCategory]:checked')?.value??-1);if(!t){toast('Escribe una actividad.');return;}const item={t,h,c};const arr=S.ev[U.cd]=S.ev[U.cd]||[];if(index===null)arr.push(item);else arr[index]=item;save();$('#eventDlg').close();R();toast('Evento guardado');};
 $('#eventDlg').querySelector('[data-a=eventdelete]')?.addEventListener('click',()=>{if(!confirm('¿Eliminar este evento?'))return;S.ev[U.cd].splice(index,1);save();$('#eventDlg').close();R();toast('Evento eliminado');});
}
function planTask(r,i){const path='w.'+U.wk+'.'+r+'.'+i;$('#moveDlg').innerHTML=`<div class="modal-head"><h2>Llevar al día</h2><button class="ib" data-a="moveclose" aria-label="Cerrar">×</button></div><form id="moveForm" class="modal-body"><p>${esc(g(path+'.t'))}</p><label class="q" for="moveDate">¿Cuándo quieres darle espacio?</label><input id="moveDate" type="date" required value="${td()}"><p class="sub">Se añade a Tareas secundarias. Se mantiene en tu semana y el estado de completado se comparte.</p><button class="btn">Planificar tarea</button></form>`;$('#moveDlg').showModal();$('#moveForm').onsubmit=e=>{e.preventDefault();const date=$('#moveDate').value;if(!date)return;const day=S.d[date]=S.d[date]||{};const rows=day.k=day.k||{};if(Object.values(rows).some(x=>x?.source===path)){toast('Esta tarea ya está en ese día.');return}let n=1;while(rows[n]?.t)n++;rows[n]={t:g(path+'.t'),c:g(path+'.c',false),s:0,source:path};day.otherCount=Math.max(otherTaskCount(date),n);setDayVisibility('d_oth',wd(pd(date)),true);save();$('#moveDlg').close();U.dd=date;U.dt='p';U.tab='d';R(true);toast('Tarea planificada')};}
function expandTextArea(el){
 if(!(el instanceof HTMLTextAreaElement))return;
 el.style.height='auto';
 el.style.height=Math.max(el.scrollHeight,el.dataset.p&&el.rows===1?43:0)+'px';
}
function expandAllTextAreas(root=document){
 root.querySelectorAll('textarea[data-p]').forEach(expandTextArea);
}
function R(up){
 const y=scrollY,opened=[...document.querySelectorAll('.effort')].map(x=>x.open);
 $('#v').innerHTML=({h:vH,c:vC,w:vW,d:vD})[U.tab]();U.pop=null;
 document.querySelectorAll('.effort').forEach((x,i)=>x.open=!!opened[i]);
 document.querySelectorAll('#nav button').forEach(b=>{b.classList.toggle('on',b.dataset.k===U.tab);b.setAttribute('aria-current',b.dataset.k===U.tab?'page':'false')});
 document.querySelectorAll('#v .card').forEach(card=>{const label=card.querySelector('.q,h2');if(label)card.querySelectorAll('textarea,input').forEach((field,i)=>{if(!field.placeholder)field.setAttribute('aria-label',label.textContent+(i?' '+(i+1):''))})});
 expandAllTextAreas($('#v'));
 const c=$('.chip.on');if(c)c.parentNode.scrollLeft=c.offsetLeft-c.parentNode.clientWidth/2+23;
 scrollTo(0,up?0:y);
}

const I={h:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',c:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',w:'<path d="M4 7h16M4 12h16M4 17h10"/>',d:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'};
$('#nav').innerHTML=[['h','Hábitos'],['c','Calendario'],['w','Semana'],['d','Día']].map(([k,l])=>`<button data-a="go" data-k="${k}"><svg viewBox="0 0 24 24">${I[k]}</svg>${l}</button>`).join('');

// Cerrar desde el fondo sin confundir un arrastre iniciado dentro del panel.
const settingsDialog=$('#dlg');
const outsideDialog=e=>{
 const r=settingsDialog.getBoundingClientRect();
 return e.target===settingsDialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);
};
let startedOutsideDialog=false;
settingsDialog.addEventListener('pointerdown',e=>{startedOutsideDialog=outsideDialog(e)});
settingsDialog.addEventListener('pointercancel',()=>{startedOutsideDialog=false});
settingsDialog.addEventListener('click',e=>{
 if(startedOutsideDialog&&outsideDialog(e))settingsDialog.close();
 startedOutsideDialog=false;
});
document.addEventListener('input',e=>{expandTextArea(e.target);const p=e.target.dataset&&e.target.dataset.p;if(p&&'value' in e.target){const oldText=g(p);setP(p,e.target.value);if(p.endsWith('.t'))detachEditedTask(p,oldText,e.target.value);const row=e.target.closest('.row');
if(U.tab==='d'&&/^d\.[^.]+\.k\.\d+\.t$/.test(p)&&row){const carry=row.querySelector('[data-a=carrytask]');if(carry)carry.hidden=!e.target.value.trim();}
if(U.tab==='w'&&row&&p.endsWith('.t')&&!row.querySelector('[data-a=move]')&&e.target.value.trim()){const parts=p.split('.'),button=document.createElement('button');button.className='tiny-action';button.dataset.a='move';button.dataset.r=parts[2];button.dataset.i=parts[3];button.setAttribute('aria-label','Planificar en un día');button.textContent='↗';row.append(button)}if(U.tab==='w'){const items=['a','b'].flatMap(r=>Object.values(S.w[U.wk]?.[r]||{})).filter(x=>x?.t?.trim()),done=items.filter(x=>x.c).length,ring=$('#weekProgress');if(ring){ring.style.setProperty('--p',items.length?done/items.length*100:0);ring.querySelector('span').textContent=done+'/'+items.length}}}});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-a]');if(!b)return;
 const a=b.dataset.a,d=b.dataset;
 if(a==='close'){$('#dlg').close();return}
 if(a==='editclose'){$('#editDlg').close();return}
 if(a==='moveclose'){$('#moveDlg').close();return}
 if(a==='eventclose'){$('#eventDlg').close();return}
 if(a==='eventedit'){eventEditor(+d.i);return}
 if(a==='eva'){eventEditor();return}
 if(a==='welcome'){S.cfg.welcomed=true;save();$('#welcomeDlg').close();R();return}
 if(a==='startpreset'){applyPreset(d.k,true);S.cfg.welcomed=true;save();$('#welcomeDlg').close();R();toast('Experiencia '+PRESETS[d.k].label.toLowerCase()+' activada');return}
 if(a==='preset'){applyPreset(d.k);refreshPrefs();toast('Categoría '+PRESETS[d.k].label.toLowerCase()+' activada');return}
 if(a==='allreset'){S.cfg.days={};save();refreshPrefs();toast('Todos los días siguen la categoría base');return}
 if(a==='move'){planTask(d.r,+d.i);return}
 if(a==='phase'){U[d.k==='start'?'startOpen':'endOpen']=!U[d.k==='start'?'startOpen':'endOpen'];R();return}
 if(a==='allDay'){const path='ev.'+U.cd+'.'+d.i+'.h';setP(path,g(path)?'':'09:00');R();return}
 if(a==='sort'){const order=moduleOrder(OPT.d[0][1].filter(x=>!['d_int','d_gr','d_rf'].includes(x[0]))).map(x=>x[0]),i=order.indexOf(d.k),j=i+Number(d.n);if(j>=0&&j<order.length){[order[i],order[j]]=[order[j],order[i]];S.cfg.order=order;save();refreshPrefs()}return}
 if(a==='dailyhab'){const o=S.hl[U.dd]=S.hl[U.dd]||{};o[d.id]=o[d.id]===1?0:1;save();R();return}
 if(a==='habitdelete'){const h=S.h.find(x=>x.id===d.id);if(confirm('¿Eliminar '+h.name+' y sus registros? Puedes exportar un respaldo antes.')){S.h=S.h.filter(x=>x.id!==d.id);Object.values(S.hl).forEach(o=>delete o[d.id]);save();$('#editDlg').close();R()}return}
 if(a==='carrytask'){carryToTomorrow(+d.i);return}
 if(a==='undocarry'){undoCarry();return}
 if(a==='taskclear'){const row=S.d[U.dd]?.k?.[0];if(row?.t?.trim()&&!confirm('¿Borrar esta prioridad?'))return;if(S.d[U.dd]?.k)delete S.d[U.dd].k[0];save();R();return}
 if(a==='priorityadd'){const day=S.d[U.dd]=S.d[U.dd]||{};day.priorityCount=Math.min(3,Math.max(1,day.priorityCount||1)+1);save();R();const index=[0,501,502][day.priorityCount-1];document.querySelector(`[data-p="d.${U.dd}.k.${index}.t"]`)?.focus({preventScroll:true});return}
 if(a==='taskremove'&&+d.i>=501){const day=S.d[U.dd]=S.d[U.dd]||{},rows=day.k=day.k||{},n=Math.max(1,Math.min(3,day.priorityCount||1));const keys=[0,501,502];const pos=keys.indexOf(+d.i);if(pos<0||pos>=n)return;if(rows[d.i]?.t?.trim()&&!confirm('¿Eliminar esta prioridad?'))return;for(let j=pos;j<n-1;j++)rows[keys[j]]={...(rows[keys[j+1]]||{})};delete rows[keys[n-1]];day.priorityCount=Math.max(1,n-1);save();R();return}
 if(a==='taskremove'){const day=S.d[U.dd]||{},rows=day.k||{},i=+d.i;if((rows[i]?.t||rows[i]?.s||rows[i]?.c)&&!confirm('¿Eliminar esta tarea del día? La tarea semanal se conserva.'))return;const n=otherTaskCount(U.dd);for(let j=i;j<n;j++)rows[j]=rows[j+1]||{};delete rows[n];day.otherCount=Math.max(2,n-1);save();R();return}
 if(a==='db'){U.pday=wd(pd(U.dd));$('#pers').innerHTML=persHTML();$('#dlg').showModal();return}
 if(a==='taskadd'){
  const n=otherTaskCount(U.dd)+1;if(n>500){toast('Este día ya tiene 500 tareas.');return}
  setP('d.'+U.dd+'.otherCount',n);R();
  const field=$(`textarea[data-p="d.${U.dd}.k.${n}.t"]`);
  if(field){field.focus({preventScroll:true});field.scrollIntoView({block:'nearest',behavior:'smooth'})}
  return;
 }
 if(a==='prefmode'){U.pm=d.k;refreshPrefs(b.id);return}
 if(a==='prefday'){U.pday=+d.i;refreshPrefs(b.id);return}
 if(a==='prefreset'){delete S.cfg.days[U.pday];save();refreshPrefs('pref-day-'+U.pday);return}
 if(a==='dayvis'){setDayVisibility(d.k,U.pday,b.checked);save();refreshPrefs(b.id);return}
 if(a==='groupvis'){setGroupVisibility(d.k,d.group,b.checked);save();refreshPrefs(b.id);return}
 if(a==='exp'){downloadCurrent();return}
 if(a==='go')U.tab=d.k;
 else if(a==='m'){U[d.k]=ym(U[d.k],+d.n);if(d.k==='cm')U.cd=U.cm===td().slice(0,7)?td():U.cm+'-01'}
 else if(a==='hd')U.hd=d.k;
 else if(a==='hab'){const o=S.hl[U.hd]=S.hl[U.hd]||{};o[d.id]=o[d.id]===1?0:1;U.pop=o[d.id]===1?d.id:null;save()}
 else if(a==='hadd'){habitEditor();return}
 else if(a==='hen'){habitEditor(d.id);return}
 else if(a==='cd'){U.cd=d.k;U.ed=-1}
 else if(a==='vis'){S.cfg.hide[d.k]=!b.checked;save()}
 else if(a==='hoy'){U[d.k]=td().slice(0,7);if(d.k==='cm'){U.cd=td();U.ed=-1}else U.hd=td()}
 else if(a==='hoyw')U.wk=iso(mon(new Date()));
 else if(a==='ed')U.ed=+d.i;
 else if(a==='ec')setP('ev.'+U.cd+'.'+d.i+'.c',+d.j);
 else if(a==='theme'){S.cfg.theme=d.k==='soft'?'soft':'modern';save();applyAcc();R();toast('Estilo visual actualizado');return}

 else if(a==='evd'){S.ev[U.cd].splice(+d.i,1);U.ed=-1;save()}
 else if(a==='tog'){const value=!g(d.p,false);setP(d.p,value);syncTask(d.p,value)}
 else if(a==='dot'){const s=g(d.p,0),j=+d.j;setP(d.p,s===j+1?j:j+1)}
 else if(a==='wk')U.wk=iso(add(pd(U.wk),7*d.n));
 else if(a==='wt')U.wt=d.k;
 else if(a==='dt')U.dt=d.k;
 else if(a==='dd')U.dd=iso(add(pd(U.dd),+d.n));
 else if(a==='today')U.dd=td();
 else if(a==='co')U.co=!U.co;
 R(['go','m','wk','wt','dt','dd','today','hoy','hoyw'].includes(a));
});
// Vista flotante durante el arrastre: sigue el dedo o cursor sin modificar datos hasta soltar.
function dragPreview(source,x,y){const rect=source.getBoundingClientRect(),clone=source.cloneNode(true);clone.classList.remove('dragging','habit-dragging','drop-target','habit-drop-target');clone.classList.add('drag-preview');clone.style.width=rect.width+'px';clone.style.left=rect.left+'px';clone.style.top=rect.top+'px';document.body.append(clone);return {clone,dx:x-rect.left,dy:y-rect.top};}
function positionPreview(state,x,y){if(!state?.preview)return;state.preview.clone.style.left=(x-state.preview.dx)+'px';state.preview.clone.style.top=(y-state.preview.dy)+'px';}
function removePreview(state){state?.preview?.clone.remove();}
// Arrastre táctil y con ratón, activado tras una pulsación sostenida.
let taskDrag=null,dragTimer=null;
function moveDailyTask(from,to){
 if(from===to||from<1||to<1)return;
 const date=U.dd,day=S.d[date]=S.d[date]||{},rows=day.k=day.k||{},max=otherTaskCount(date);
 if(from>max||to>max)return;
 const moving={...(rows[from]||{})};
 if(from<to)for(let i=from;i<to;i++)rows[i]={...(rows[i+1]||{})};
 else for(let i=from;i>to;i--)rows[i]={...(rows[i-1]||{})};
 rows[to]=moving;save();R();toast('Orden actualizado');
}
document.addEventListener('pointerdown',e=>{
 const handle=e.target.closest('[data-drag-index]');if(!handle||!ready)return;
 const index=+handle.dataset.dragIndex,kind=e.pointerType;
 taskDrag={index,target:index,pointer:e.pointerId,x:e.clientX,y:e.clientY,active:false};
 clearTimeout(dragTimer);
 dragTimer=setTimeout(()=>{if(!taskDrag||taskDrag.pointer!==e.pointerId)return;taskDrag.active=true;document.body.classList.add('is-dragging');const source=handle.closest('.task-line');if(source){taskDrag.preview=dragPreview(source,taskDrag.x,taskDrag.y);source.classList.add('dragging');}},kind==='mouse'?160:350);
});
document.addEventListener('pointermove',e=>{
 if(!taskDrag||taskDrag.pointer!==e.pointerId)return;
 if(!taskDrag.active){if(Math.hypot(e.clientX-taskDrag.x,e.clientY-taskDrag.y)>12){clearTimeout(dragTimer);taskDrag=null;}return;}
 e.preventDefault();positionPreview(taskDrag,e.clientX,e.clientY);const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-task-index]');
 document.querySelectorAll('.task-line.drop-target').forEach(x=>x.classList.remove('drop-target'));
 if(target){taskDrag.target=+target.dataset.taskIndex;target.classList.add('drop-target');}
 if(e.clientY>innerHeight-110)scrollBy(0,12);else if(e.clientY<90)scrollBy(0,-12);
},{passive:false});
function finishTaskDrag(e){if(!taskDrag||e.pointerId!==taskDrag.pointer)return;clearTimeout(dragTimer);const v=taskDrag;removePreview(v);taskDrag=null;document.body.classList.remove('is-dragging');document.querySelectorAll('.task-line.dragging,.task-line.drop-target').forEach(x=>x.classList.remove('dragging','drop-target'));if(v.active&&e.type==='pointerup'){moveDailyTask(v.index,v.target);}}
document.addEventListener('pointerup',finishTaskDrag);document.addEventListener('pointercancel',finishTaskDrag);

// Orden de hábitos: desplaza el objeto entero, conservando su ID, color, calendario y racha.
function reorderHabit(fromId,toId){
 const from=S.h.findIndex(h=>h.id===fromId),to=S.h.findIndex(h=>h.id===toId);
 if(from<0||to<0||from===to)return false;
 const [habit]=S.h.splice(from,1);S.h.splice(to,0,habit);
 save();R();toast('Orden de hábitos actualizado');return true;
}
let habitDrag=null,habitDragTimer=null;
function clearHabitDrag(){
 clearTimeout(habitDragTimer);
 removePreview(habitDrag);document.body.classList.remove('is-habit-dragging');
 document.querySelectorAll('.habit-card.habit-dragging,.habit-card.habit-drop-target').forEach(el=>el.classList.remove('habit-dragging','habit-drop-target'));
 habitDrag=null;
}
document.addEventListener('pointerdown',e=>{
 const handle=e.target.closest('[data-habit-drag]');
 if(!handle||!ready||U.tab!=='h')return;
 if(e.pointerType==='mouse'&&e.button!==0)return;
 const id=handle.dataset.habitDrag;
 habitDrag={id,target:id,pointer:e.pointerId,x:e.clientX,y:e.clientY,active:false};
 clearTimeout(habitDragTimer);
 habitDragTimer=setTimeout(()=>{
  if(!habitDrag||habitDrag.pointer!==e.pointerId)return;
  habitDrag.active=true;
  document.body.classList.add('is-habit-dragging');
  const source=handle.closest('.habit-card');if(source){habitDrag.preview=dragPreview(source,habitDrag.x,habitDrag.y);source.classList.add('habit-dragging');}
 },e.pointerType==='mouse'?160:320);
});
document.addEventListener('pointermove',e=>{
 if(!habitDrag||e.pointerId!==habitDrag.pointer)return;
 if(!habitDrag.active){
  if(Math.hypot(e.clientX-habitDrag.x,e.clientY-habitDrag.y)>12)clearHabitDrag();
  return;
 }
 e.preventDefault();positionPreview(habitDrag,e.clientX,e.clientY);
 const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.habit-card[data-habit-id]');
 document.querySelectorAll('.habit-card.habit-drop-target').forEach(el=>el.classList.remove('habit-drop-target'));
 if(target){habitDrag.target=target.dataset.habitId;target.classList.add('habit-drop-target');}
 if(e.clientY>window.innerHeight-105)window.scrollBy(0,12);
 else if(e.clientY<80)window.scrollBy(0,-12);
},{passive:false});
function finishHabitDrag(e){
 if(!habitDrag||e.pointerId!==habitDrag.pointer)return;
 const {id,target,active}=habitDrag;
 clearHabitDrag();
 if(active&&e.type==='pointerup')reorderHabit(id,target);
}
document.addEventListener('pointerup',finishHabitDrag);
document.addEventListener('pointercancel',finishHabitDrag);
// Alternativa accesible para quienes usan teclado o no pueden arrastrar.
document.addEventListener('keydown',e=>{
 const handle=e.target.closest('[data-habit-drag]');
 if(!handle||!['ArrowUp','ArrowDown'].includes(e.key)||!ready)return;
 e.preventDefault();
 const from=S.h.findIndex(h=>h.id===handle.dataset.habitDrag),to=from+(e.key==='ArrowUp'?-1:1);
 if(from<0||to<0||to>=S.h.length)return;
 const focusedId=handle.dataset.habitDrag;
 if(reorderHabit(focusedId,S.h[to].id)){
  const next=[...document.querySelectorAll('[data-habit-drag]')].find(el=>el.dataset.habitDrag===focusedId);
  next?.focus({preventScroll:true});
 }
});


function detachEditedTask(path,oldText,newText){
 if(oldText===newText)return;
 const daily=path.match(/^d\.([^.]*)\.k\.(\d+)\.t$/);
 if(daily){const row=S.d[daily[1]]?.k?.[daily[2]];if(row?.source){delete row.source;save();}return;}
 const weekly=path.match(/^w\.([^.]*)\.([ab])\.(\d+)\.t$/);
 if(weekly){const source=path.slice(0,-2);let changed=false;for(const day of Object.values(S.d))for(const row of Object.values(day.k||{}))if(row?.source===source){delete row.source;changed=true;}if(changed)save();}
}
let lastCarryUndo=null;
function carryToTomorrow(index){
 const origin=S.d[U.dd]?.k?.[index];if(!origin?.t?.trim()){toast('Escribe una tarea antes de pasarla.');return;}
 const from=U.dd,target=iso(add(pd(from),1)),previousTomorrow=S.d[target]?structuredClone(S.d[target]):null,day=S.d[target]=S.d[target]||{},rows=day.k=day.k||{};
 let n=1;while(n<=500&&rows[n]?.t?.trim())n++;
 if(n>500){toast('El día siguiente no tiene más espacio para tareas.');return;}
 const snapshot=structuredClone(S.d[from]),futureSnapshot=previousTomorrow;
 // El traslado preserva vínculos con la semana y sesiones registradas.
 rows[n]={...origin,c:false};delete rows[n].carriedFrom;
 day.otherCount=Math.max(otherTaskCount(target),n);
 const sourceDay=S.d[from],sourceRows=sourceDay.k;
 if(index>=501){const keys=[0,501,502],count=Math.max(1,Math.min(3,sourceDay.priorityCount||1)),pos=keys.indexOf(index);for(let j=pos;j<count-1;j++)sourceRows[keys[j]]={...(sourceRows[keys[j+1]]||{})};delete sourceRows[keys[count-1]];sourceDay.priorityCount=Math.max(1,count-1);}
 else if(index===0){delete sourceRows[0];}
 else{const max=otherTaskCount(from);for(let j=index;j<max;j++)sourceRows[j]=sourceRows[j+1]||{};delete sourceRows[max];sourceDay.otherCount=Math.max(2,max-1);}
 setDayVisibility('d_oth',wd(pd(target)),true);
 lastCarryUndo={from,target,snapshot,futureSnapshot,at:Date.now()};save();R();
 const status=$('#status');status.innerHTML='Tarea movida a mañana <button type="button" data-a="undocarry" class="toast-undo">Deshacer</button>';
 status.classList.add('show');clearTimeout(statusTimer);statusTimer=setTimeout(()=>{status.classList.remove('show');lastCarryUndo=null;},6000);
}
function undoCarry(){const x=lastCarryUndo;if(!x)return;S.d[x.from]=x.snapshot;if(x.futureSnapshot)S.d[x.target]=x.futureSnapshot;else delete S.d[x.target];lastCarryUndo=null;save();R();toast('Traslado deshecho');}

function syncTask(path,value){const match=path.match(/^d\.([^.]*)\.k\.(\d+)\.c$/);let source=match?S.d[match[1]]?.k?.[match[2]]?.source:path.slice(0,-2);if(!source||!/^w\./.test(source))return;setP(source+'.c',value);for(const day of Object.values(S.d))for(const row of Object.values(day.k||{}))if(row?.source===source)row.c=value;save()}
function exportSnapshot(data,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#imp').onchange=importBackup;
$('#welcomeDlg').addEventListener('cancel',()=>{S.cfg.welcomed=true;save()});
for(const dialog of [$('#editDlg'),$('#moveDlg'),$('#eventDlg')]){let outside=false;const hit=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)};dialog.addEventListener('pointerdown',e=>outside=hit(e));dialog.addEventListener('click',e=>{if(outside&&hit(e))dialog.close();outside=false});}

// Validación adicional: el formato antiguo aceptaba valores que luego rompían el render.
function checkedState(raw){
 const o=normalize(validateState(structuredClone(raw)));
 const fail=m=>{throw Error(m)};
 const text=(v,k)=>{if(v!==undefined&&typeof v!=='string')fail('Texto incorrecto: '+k)};
 const date=k=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||iso(pd(k))!==k)fail('Fecha incorrecta: '+k)};
 const collection=(v,k)=>{if(v!==undefined&&!plain(v)&&!Array.isArray(v))fail('Lista incorrecta: '+k)};
 const texts=(v,k)=>{collection(v,k);Object.values(v||{}).forEach(x=>{if(x!==null)text(x,k)})};
 const tasks=(v,k,max)=>{
  collection(v,k);
  for(const [i,t] of Object.entries(v||{})){
   if(!/^\d+$/.test(i)||+i>max)fail('Índice de tarea incorrecto: '+k);
   if(t===null)continue;
   if(!plain(t))fail('Tarea incorrecta: '+k);
   text(t.t,k);if(t.c!==undefined&&typeof t.c!=='boolean')fail('Estado de tarea incorrecto.');
   if(t.s!==undefined&&(!Number.isInteger(t.s)||t.s<0||t.s>5))fail('Sesiones incorrectas.');
   if(t.carriedFrom!==undefined&&(typeof t.carriedFrom!=='string'||!/^\d{4}-\d{2}-\d{2}:(?:0|[1-9]\d{0,2})$/.test(t.carriedFrom)))fail('Origen del traslado incorrecto.');
   if(t.source!==undefined){if(typeof t.source!=='string'||!/^w\.\d{4}-\d{2}-\d{2}\.[ab]\.[0-4]$/.test(t.source))fail('Origen de tarea incorrecto.');date(t.source.split('.')[1]);}
  }
 };
 for(const h of o.h){if(!/^[A-Za-z0-9_-]{1,100}$/.test(h.id))fail('Identificador de hábito incompatible.');if(h.createdOn!==undefined)date(h.createdOn);}
 for(const [k,v] of Object.entries(o.hl)){date(k);for(const x of Object.values(v))if(![0,1,2].includes(x))fail('Registro de hábito incorrecto.');}
 for(const [k,v] of Object.entries(o.ev)){date(k);for(const e of v){text(e.t,'evento');if(e.c!==undefined&&(!Number.isInteger(e.c)||e.c< -1||e.c>5))fail('Categoría de evento incorrecta.');if(e.h!==undefined&&(typeof e.h!=='string'||!/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/.test(e.h)))fail('Hora incorrecta.');}}
 for(const [k,v] of Object.entries(o.m)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(k))fail('Mes incorrecto.');texts(v.p,'prioridades');texts(v.h,'highlights');}
 for(const [k,v] of Object.entries(o.w)){date(k);text(v.i,'intención semanal');texts(v.r,'revisión');tasks(v.a,k,4);tasks(v.b,k,4);}
 for(const [k,v] of Object.entries(o.d)){date(k);for(const f of ['n','g','g2','g3','i','p','r','hl','learn','remember'])text(v[f],f);tasks(v.k,k,502);texts(v.c,'agenda');}
 if(!Number.isInteger(o.cfg.acc)||o.cfg.acc<0||o.cfg.acc>=ACC.length)fail('Color anterior incorrecto.');
 if(!['modern','soft'].includes(o.cfg.theme))fail('Estilo incorrecto.');
 for(const habit of o.h)if(habit.color!==undefined&&(!Number.isInteger(habit.color)||habit.color<0||habit.color>5))fail('Color de hábito incorrecto.');
 for(const v of Object.values(o.cfg.hide))if(typeof v!=='boolean')fail('Visibilidad incorrecta.');
 for(const [k,v] of Object.entries(o.cfg.days)){if(!/^[0-6]$/.test(k)||Object.values(v).some(x=>typeof x!=='boolean'))fail('Día personalizado incorrecto.');}
 if(new Blob([JSON.stringify(o)]).size>9*1024*1024)fail('Agenda demasiado grande (máximo práctico 9 MiB).');
 return o;
}
function summary(o){
 const rows=periods=>Object.values(periods).flatMap(v=>Object.values(v.k||{})).filter(Boolean);
 const links=rows(o.d).filter(x=>x.source);
 return {habitos:o.h.length,diasHabitos:Object.keys(o.hl).length,
  marcasHabitos:Object.values(o.hl).reduce((n,x)=>n+Object.keys(x).length,0),
  eventos:Object.values(o.ev).reduce((n,x)=>n+x.length,0),meses:Object.keys(o.m).length,
  semanas:Object.keys(o.w).length,dias:Object.keys(o.d).length,tareasDiarias:rows(o.d).length,
  tareasSemanales:Object.values(o.w).reduce((n,x)=>n+['a','b'].reduce((m,k)=>m+Object.values(x[k]||{}).filter(Boolean).length,0),0),
  vinculos:links.length,origenesAusentes:links.filter(x=>{const [,k,r,i]=x.source.split('.');return !o.w[k]?.[r]?.[i]}).length,
  bytesUTF8:new Blob([JSON.stringify(o)]).size};
}
function envelope(){return {format:'con-intencion',version:2,exportedAt:new Date().toISOString(),ownerId:sessionUser?.id,revision:cloud?.revision,pending:!!cloud?.unsaved,data:S};}
function downloadCurrent(){exportSnapshot(envelope(),'agenda-respaldo-'+td()+'.json');}
function setReady(value){ready=value;$('#planner').inert=!value;}
function closeDialogs(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function setSyncFeedback(kind,message){
 $('#cloud-status').textContent=message;
 $('#sync-indicator').dataset.state=kind;
 $('#dbt').title='Opciones y cuenta · '+message;
 $('#dbt').setAttribute('aria-label','Opciones y cuenta. '+message);
}
function setAccessStage(stage){
 $('#access').dataset.error='false';
 const code=stage==='code',loading=stage==='loading';
 $('#access-title').textContent=loading?'Recuperando tu diario…':code?'Revisa tu correo.':'Tu diario te espera.';
 $('#access-description').textContent=loading?'Un momento, estamos buscando tu espacio.':code?'Introduce el código en esta pantalla. Puedes leer el correo desde otro dispositivo.':'Entra para continuar con tus planes, tus hábitos y tus ideas.';
}
async function updateAccountRole(uid,generation){
 try{
  const {data,error}=await client.from('app_roles').select('role').eq('user_id',uid).maybeSingle();
  if(generation!==authGeneration||sessionUser?.id!==uid)return;
  $('#metrics').hidden=!!error||data?.role!=='admin';
 }catch{if(generation===authGeneration)$('#metrics').hidden=true;}
}
function cloudStatus(kind,error){
 const labels={pending:'Cambios pendientes…',saving:'Guardando…',saved:'Guardado en la nube',error:'No se pudo guardar',conflict:'Hay cambios en otro dispositivo'};
 setSyncFeedback(kind,labels[kind]||kind);
 if(kind==='error'||kind==='conflict'){
  setReady(false);closeDialogs();$('#cloud-error').hidden=false;
  $('#retry-save').hidden=kind==='conflict';
  $('#cloud-error-text').textContent=kind==='conflict'?
   'Tu borrador sigue en esta pestaña. Descárgalo antes de cargar la versión de la nube. No se fusionarán automáticamente.':
   'Tus cambios siguen en esta pestaña. Reintenta o descarga un respaldo antes de salir. Detalle: '+(error?.message||'Error de conexión.');
 }else if(kind==='saved'){$('#cloud-error').hidden=true;setReady(true);}
}
async function importBackup(e){
 const f=e.target.files[0];e.target.value='';if(!f||!ready)return;
 try{
  if(f.size>10*1024*1024)throw Error('El archivo supera 10 MiB.');
  const json=JSON.parse(await f.text());
  if(json?.format==='con-intencion'&&json.version!==2)throw Error('Versión no compatible.');
  const next=checkedState(json?.format==='con-intencion'?json.data:json),info=summary(next);
  if(info.origenesAusentes)throw Error('Hay '+info.origenesAusentes+' tareas cuyo origen semanal falta. Repara el respaldo o conserva el original; no se importó nada.');
  await cloud.flush();
  if(!confirm('Cuenta destino: '+sessionUser.email+'\n'+JSON.stringify(info,null,2)+'\n'+
   (json.ownerId&&json.ownerId!==sessionUser.id?'El respaldo pertenece a otra cuenta. ':'')+
   'REEMPLAZARÁ todo este diario, no mezclará ni añadirá duplicados. Descargaremos primero la versión actual. ¿Continuar?'))return;
  downloadCurrent();S=next;migCfg();unifyClosure();applyAcc();
  save();setReady(false);await cloud.flush();$('#dlg').close();R(true);
  toast('Importación guardada. Comprueba el resumen y el contenido.');
 }catch(error){alert('No se completó la importación: '+error.message);}
}
async function loadUser(user){
 const generation=++authGeneration;
 cloud?.stop();cloud=null;sessionUser=user;setReady(false);closeDialogs();
 S=normalize(blank());$('#v').innerHTML='';$('#pers').innerHTML='';
 $('#planner').hidden=true;$('#cloud-error').hidden=true;$('#metrics-result').textContent='';
 $('#account').hidden=!user;$('#account-email').textContent=user?.email||'';
 $('#access-logout').hidden=!user;$('#metrics').hidden=true;$('#metrics-result').hidden=true;
 $('#otp-email').textContent='';setAccessStage(user?'loading':'email');
 setSyncFeedback('loading','Cargando diario…');applyAcc();
 $('#access').hidden=false;$('#login-form').hidden=true;$('#code-form').hidden=true;
 $('#retry-load').hidden=true;
 if(!user){$('#auth-status').textContent='';$('#login-form').hidden=false;return;}
 $('#auth-status').textContent='Cargando tus datos…';
 const store=new CloudStore(client,user.id,(kind,error)=>{if(cloud===store)cloudStatus(kind,error)});cloud=store;
 try{
  const row=await store.read();if(generation!==authGeneration)return;
  S=row?checkedState(row.data):normalize(blank());store.revision=row?.revision||null;
  const before=JSON.stringify(S);migCfg();unifyClosure();applyAcc();
  $('#access').hidden=true;$('#planner').hidden=false;setReady(true);R(true);
  cloudStatus('saved');
  if(!row||JSON.stringify(S)!==before){save();await store.flush();}
  if(generation!==authGeneration)return;
  showWelcome();void updateAccountRole(user.id,generation);
 }catch(error){
  if(generation!==authGeneration)return;
  setReady(false);$('#access').hidden=false;$('#planner').hidden=true;
  $('#access').dataset.error='true';
  $('#auth-status').textContent='No se pudo cargar: '+error.message+' No se reemplazaron los datos de la nube.';
  $('#retry-load').hidden=false;
 }
}
async function poll(){
 if(!cloud||!ready||cloud.unsaved||polling||document.hidden)return;
 if(document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 polling=true;const store=cloud,generation=authGeneration;
 try{
  const meta=await store.read(true);
  if(store!==cloud||generation!==authGeneration||store.unsaved||!ready)return;
  if((meta?.revision||null)!==store.revision){
   const row=await store.read();
   if(store!==cloud||generation!==authGeneration||store.unsaved||!ready)return;
   if(document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   if(!row)throw Error('El diario ya no existe. Vuelve a iniciar sesión.');
   S=checkedState(row.data);store.revision=row.revision;migCfg();unifyClosure();applyAcc();R();
   setSyncFeedback('saved','Actualizado desde otro dispositivo');
  }
 }catch(error){setSyncFeedback('warning','No se pudo comprobar la sincronización. Reintenta con conexión.');}
 finally{polling=false;}
}
$('#save-now').onclick=async()=>{closeDialogs();try{await cloud?.flush();await poll()}catch{}};
$('#retry-save').onclick=async()=>{try{await cloud.retry();R()}catch{}};
$('#rescue').onclick=downloadCurrent;
$('#load-cloud').onclick=async()=>{
 if(cloud?.unsaved&&!confirm('¿Ya descargaste tus cambios? Cargar la nube descartará el borrador de esta pestaña.'))return;
 await loadUser(sessionUser);
};
$('#retry-load').onclick=()=>loadUser(sessionUser);
$('#logout').onclick=async()=>{
 setReady(false);closeDialogs();
 if(cloud?.unsaved){try{await cloud.flush()}catch{if(!confirm('Hay cambios sin guardar. Descárgalos primero si quieres conservarlos. ¿Cerrar sesión y descartarlos?'))return;}}
 setReady(false);
 try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await loadUser(null);$('#code').value='';$('#email').value='';}
 catch(error){if(cloud&&!cloud.error)setReady(true);alert('No se pudo cerrar sesión: '+error.message);}
};
$('#access-logout').onclick=()=>$('#logout').onclick();
$('#metrics').onclick=async()=>{
 $('#metrics-result').hidden=false;$('#metrics-result').textContent='Consultando…';
 try{const {data,error}=await client.rpc('operational_metrics');if(error)throw error;$('#metrics-result').textContent='Agendas creadas: '+data.cuentas_con_agenda+' · Actualizadas en los últimos 7 días: '+data.agendas_actualizadas_7_dias;}
 catch{$('#metrics-result').textContent='No disponible: necesitas el rol de administrador o revisar tu conexión.';}
};
let lastSent=0,otpEmail='';
async function sendCode(){
 if(Date.now()-lastSent<60000)throw Error('Espera 60 segundos antes de solicitar otro código.');
 otpEmail=$('#email').value.trim().toLowerCase();
 const {error}=await client.auth.signInWithOtp({email:otpEmail,options:{shouldCreateUser:true}});
 if(error)throw error;
 lastSent=Date.now();$('#login-form').hidden=true;$('#code-form').hidden=false;
 $('#code').value='';setAccessStage('code');$('#otp-email').textContent=otpEmail;
 $('#auth-status').textContent='Si no lo ves, revisa también la carpeta de spam.';$('#code').focus();
}
async function authAction(form,action){
 $('#access').dataset.error='false';form.setAttribute('aria-busy','true');
 const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{await action()}catch(error){$('#access').dataset.error='true';$('#auth-status').textContent='No pudimos continuar: '+error.message;}
 finally{form.setAttribute('aria-busy','false');buttons.forEach(b=>b.disabled=false);}
}
$('#login-form').onsubmit=e=>{e.preventDefault();authAction(e.target,sendCode)};
$('#code-form').onsubmit=e=>{
 e.preventDefault();authAction(e.target,async()=>{
  const {data,error}=await client.auth.verifyOtp({email:otpEmail,token:$('#code').value.trim(),type:'email'});
  if(error)throw error;
  $('#code').value='';if(sessionUser?.id!==data.user.id)await loadUser(data.user);
 });
};
$('#resend').onclick=()=>authAction($('#code-form'),sendCode);
$('#change-email').onclick=()=>{$('#code-form').hidden=true;$('#login-form').hidden=false;$('#code').value='';$('#auth-status').textContent='';setAccessStage('email');$('#email').focus();};
window.addEventListener('beforeunload',e=>{if(cloud?.unsaved){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',poll);
window.addEventListener('focus',poll);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});
setInterval(poll,60000);
// No hay llamadas Auth esperadas dentro del callback: se difieren fuera del lock del SDK.
async function boot(){
 try{
  client=makeClient();
  client.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
   setTimeout(()=>{if((session?.user?.id||null)!==(sessionUser?.id||null))loadUser(session?.user||null)},0);
  });
  const {data,error}=await client.auth.getSession();if(error)throw error;
  await loadUser(data.session?.user||null);
 }catch(error){$('#auth-status').textContent='No se pudo iniciar: '+error.message;$('#retry-load').hidden=false;$('#retry-load').onclick=boot;}
}
// boot.js muestra recuperación si no se pueden cargar los módulos o el CDN.
boot();
