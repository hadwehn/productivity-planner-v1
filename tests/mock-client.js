// Supabase simulado para probar la interfaz en local. Guarda el diario en localStorage del navegador.
// Lo sirve tests/dev-server.py en lugar de public/client.js. Nunca llega a producción.
const KEY = 'planner-dev-db';
const OUT = 'planner-dev-signed-out';
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'prueba@local.test' };
const load = () => JSON.parse(localStorage.getItem(KEY) || '{}');
// Sin conexión (p. ej., context.setOffline en Playwright) responde como el cliente real.
const offline = () => navigator.onLine === false ? { error: Error('TypeError: Failed to fetch') } : null;

export function makeClient() {
  const listeners = [];
  return {
    auth: {
      getSession: async () => ({ data: { session: localStorage.getItem(OUT) ? null : { user } } }),
      onAuthStateChange: cb => listeners.push(cb),
      signInWithOtp: async () => ({}),
      verifyOtp: async () => { localStorage.removeItem(OUT); return { data: { user } }; },
      signOut: async () => { localStorage.setItem(OUT, '1'); return {}; },
    },
    from: table => ({
      select: cols => ({
        eq: () => ({
          maybeSingle: async () => {
            if (offline()) return offline();
            if (table === 'app_roles') return { data: null };
            const row = load().row;
            if (!row) return { data: null };
            return { data: cols === 'revision' ? { revision: row.revision } : structuredClone(row) };
          },
        }),
      }),
    }),
    rpc: async (name, p) => {
      if (offline()) return offline();
      if (name !== 'save_planner') return { error: Error('No disponible en local.') };
      const db = load();
      if (db.row?.revision === p.p_revision) return { data: { revision: p.p_revision } };
      if ((db.row?.revision || null) !== p.p_expected) return { error: Error('STATE_CONFLICT') };
      db.row = { data: p.p_data, revision: p.p_revision };
      localStorage.setItem(KEY, JSON.stringify(db));
      return { data: { revision: p.p_revision } };
    },
  };
}
