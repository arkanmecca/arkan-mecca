'use strict';
const TABLES = ['settings','definitions','companies','users','pricings','offers','assignments','quotes','sessions','attempts','requests','audit'];
const clone = value => JSON.parse(JSON.stringify(value));
class UnitOfWork {
  constructor(data, now, id) { this.data=data; this.now=now; this.id=id; this.changes=new Map(); }
  all(table) { if (!TABLES.includes(table)) throw Error('Unknown table'); return Object.values(this.data[table] || {}).map(clone); }
  get(table, id) { const r = this.data[table]?.[id]; return r ? clone(r) : null; }
  put(table, value) {
    const old = this.data[table]?.[value.id];
    const row = {...clone(value), id:value.id || this.id(), version:(old?.version || 0)+1, updatedAt:new Date(this.now()).toISOString()};
    if (JSON.stringify(row).length > 44000) throw Error('RECORD_SIZE');
    this.data[table] ||= {}; this.data[table][row.id]=row;
    this.changes.set(`${table}/${row.id}`, {table,row}); return clone(row);
  }
  remove(table,id) { delete this.data[table][id]; this.changes.set(`${table}/${id}`,{table,id,remove:true}); }
}
class MemoryStore {
  constructor({now=Date.now,id=()=>globalThis.crypto.randomUUID(), data}={}) {
    this.now=now; this.id=id; this.data=data || Object.fromEntries(TABLES.map(t=>[t,{}]));
  }
  transaction(fn) { const uow = new UnitOfWork(clone(this.data),this.now,this.id); const result=fn(uow); this.data=uow.data; return result; }
  read(fn) { const uow = new UnitOfWork(clone(this.data),this.now,this.id); const result=fn(uow); if (uow.changes.size) throw Error('read() must not write data; use transaction() instead'); return result; }
}
module.exports={TABLES,UnitOfWork,MemoryStore,clone};
