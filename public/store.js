// Guardado en la nube con control de conflictos (revisión). Sin conexión no es un error: lo pendiente
// se conserva y se reintenta solo (cada 30 s y al volver la conexión, ver app.js). La copia en el
// dispositivo, para abrir sin conexión, la lleva app.js (readLocal/writeLocal).

/** ¿El error es por falta de conexión (y no un rechazo de la nube)? */
export const isOffline = error => (typeof navigator !== 'undefined' && navigator.onLine === false)
  || /failed to fetch|networkerror|load failed|network request failed|timed? ?out|timeout|abort|offline/i.test(`${error?.name || ''} ${error?.message || ''}`);

export class CloudStore {
  constructor(client, uid, changed) {
    this.client=client; this.uid=uid; this.changed=changed;
    this.revision=null; this.dirty=false; this.pending=null;
    this.busy=null; this.error=null; this.stopped=false; this.offline=false;
  }
  async read(meta=false) {
    const {data,error}=await this.client.from('planner_states')
      .select(meta?'revision':'data,revision').eq('user_id',this.uid).maybeSingle();
    if(error)throw error;
    return data;
  }
  schedule(getState) {
    if(this.stopped||this.error)return false;
    this.getState=getState; this.dirty=true;
    this.changed('pending'); clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.flush().catch(()=>{}),800);
    return true;
  }
  flush() {
    clearTimeout(this.timer);
    if(this.busy)return this.busy;
    if(this.stopped)return Promise.reject(Error('Sesión cerrada.'));
    this.busy=this.run().finally(()=>{this.busy=null;});
    return this.busy;
  }
  async run() {
    if(this.error)throw this.error;
    try {
      while(this.pending||this.dirty) {
        if(!this.pending) {
          this.pending={p_data:structuredClone(this.getState()),
            p_expected:this.revision,p_revision:crypto.randomUUID()};
          this.dirty=false;
        }
        const op=this.pending;
        this.changed('saving');
        const {data,error}=await this.client.rpc('save_planner',op);
        if(error)throw error;
        if(this.stopped)return;
        this.revision=data.revision; this.pending=null;
      }
      this.offline=false;
      this.changed('saved');
    } catch(error) {
      if(this.stopped)return;
      if(isOffline(error)) {
        // Sin conexión: lo pendiente queda igual (el reintento usa la misma revisión) y se vuelve a
        // intentar solo. La pantalla sigue disponible.
        this.offline=true; this.changed('offline',error);
        clearTimeout(this.retryTimer);
        this.retryTimer=setTimeout(()=>this.flush().catch(()=>{}),30000);
        this.retryTimer?.unref?.();
        throw error;
      }
      this.error=error; this.changed(/STATE_CONFLICT/.test(error.message)?'conflict':'error',error);
      throw error;
    }
  }
  async retry() {this.error=null; return this.flush();}
  get unsaved(){return !!(this.dirty||this.pending||this.busy||this.error);}
  stop(){this.stopped=true;clearTimeout(this.timer);clearTimeout(this.retryTimer);this.pending=null;this.getState=null;}
}
