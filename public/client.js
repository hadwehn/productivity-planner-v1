// Sin framework ni build. El CDN distribuye la biblioteca oficial de Supabase.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
export function makeClient() {
  if (SUPABASE_URL.includes('TU-PROYECTO') || SUPABASE_KEY.startsWith('TU-')) {
    throw Error('Completa public/config.js con la URL y la clave pública de tu proyecto.');
  }
  if (SUPABASE_KEY.startsWith('sb_secret_')) throw Error('Usa una clave pública publishable.');
  if (SUPABASE_KEY.startsWith('eyJ')) {
    let role;
    try { role=JSON.parse(atob(SUPABASE_KEY.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role; }
    catch { throw Error('Clave pública heredada no válida.'); }
    if (role !== 'anon') throw Error('La clave heredada del navegador debe tener rol anon.');
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: (url, options = {}) => fetch(url, {
      ...options, signal: options.signal || AbortSignal.timeout(20000)
    }) }
  });
}
