import {readFileSync} from 'node:fs';
const files=process.argv.slice(2);
if(files.length!==2){console.error('Usage: node tests/compare-backups.mjs before.json after.json');process.exit(2)}
function load(file){
 const j=JSON.parse(readFileSync(file,'utf8'));
 if(j.format==='con-intencion'&&j.version!==2)throw Error('Versión no compatible');
 const s=structuredClone(j.format==='con-intencion'?j.data:j);
 if(!s||!Array.isArray(s.h))throw Error('Falta h');
 for(const k of ['hl','m','ev','w','d','cfg'])s[k]??={};
 for(const [k,events] of Object.entries(s.ev))s.ev[k]=events.map(e=>typeof e==='string'?{t:e,c:0,h:''}:{...e,c:Number.isInteger(e.c)&&e.c>=0&&e.c<4?e.c:0});
 // Estas listas admiten objetos numéricos o arreglos dispersos en el original.
 const numeric=v=>v==null?v:Object.fromEntries(Object.entries(v).filter(([,x])=>x!==null));
 for(const v of Object.values(s.m))for(const k of ['p','h'])if(v[k]!==undefined)v[k]=numeric(v[k]);
 for(const v of Object.values(s.w))for(const k of ['a','b','r'])if(v[k]!==undefined)v[k]=numeric(v[k]);
 for(const v of Object.values(s.d))if(v.k!==undefined)v.k=numeric(v.k);
 return s;
}
function diff(a,b,path='',out=[]){
 if(a===b)return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],path?path+'.'+k:k,out);
 }else out.push(path);
 return out;
}
function counts(s){return {habitos:s.h.length,fechasHabitos:Object.keys(s.hl).length,
 eventos:Object.values(s.ev).reduce((n,x)=>n+x.length,0),meses:Object.keys(s.m).length,
 semanas:Object.keys(s.w).length,dias:Object.keys(s.d).length,
 tareasDiarias:Object.values(s.d).reduce((n,x)=>n+Object.values(x.k||{}).filter(Boolean).length,0),
 tareasSemanales:Object.values(s.w).reduce((n,x)=>n+['a','b'].reduce((m,k)=>m+Object.values(x[k]||{}).filter(Boolean).length,0),0)};}
try{
 const [a,b]=files.map(load),changes=diff(a,b),content=changes.filter(p=>p!=='cfg'&&!p.startsWith('cfg.'));
 console.log('Antes:',counts(a));console.log('Después:',counts(b));
 console.log('Rutas distintas (sin mostrar textos):',changes.slice(0,100));
 if(content.length){console.error('REVISAR: hay cambios de contenido fuera de cfg.');process.exitCode=1;}
 else console.log(changes.length?'Contenido preservado. Revisa las diferencias de cfg debidas a migraciones.':'Contenido idéntico.');
}catch(error){console.error('No se pudo comparar:',error.message);process.exitCode=2;}
