// Sin acceso a localStorage: el borrador solo vive en memoria.
export class CloudStore {
  constructor(client, uid, changed) {
    this.client=client; this.uid=uid; this.changed=changed;
    this.revision=null; this.dirty=false; this.pending=null;
    this.busy=null; this.error=null; this.stopped=false;
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
      this.changed('saved');
    } catch(error) {
      if(this.stopped)return;
      this.error=error; this.changed(/STATE_CONFLICT/.test(error.message)?'conflict':'error',error);
      throw error;
    }
  }
  async retry() {this.error=null; return this.flush();}
  get unsaved(){return !!(this.dirty||this.pending||this.busy||this.error);}
  stop(){this.stopped=true;clearTimeout(this.timer);this.pending=null;this.getState=null;}
}
