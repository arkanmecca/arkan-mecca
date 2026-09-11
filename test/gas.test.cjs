'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {UnitOfWork,TABLES}=require('../src/store.cjs');
function gasFixture(){
  let data=Object.fromEntries(TABLES.map(t=>[t,[]])),failBatch=false,calls=0,metaCalls=0,locked=false;
  const cacheData=new Map();
  const Sheets={Spreadsheets:{get:()=>{metaCalls++;return {sheets:TABLES.map((t,i)=>({properties:{sheetId:i+1,title:t,gridProperties:{rowCount:1000}}}))};},Values:{batchGet:()=>({valueRanges:TABLES.map(t=>({values:data[t]}))})},batchUpdate:({requests})=>{
    calls++;if(failBatch)throw Error('simulated Sheets failure');const copy=structuredClone(data);
    for(const r of requests){if(r.appendDimension)continue;const update=r.updateCells,table=TABLES[update.start.sheetId-1];copy[table][update.start.rowIndex-1]=update.rows[0].values.map(v=>v.userEnteredValue.stringValue);}
    data=copy;
  }}};
  const CacheService={getScriptCache:()=>({get:k=>cacheData.has(k)?cacheData.get(k):null,put:(k,v)=>cacheData.set(k,v),remove:k=>cacheData.delete(k)})};
  const context={Rihla:{UnitOfWork,TABLES},Sheets,CacheService,Date,Utilities:{getUuid:()=>crypto.randomUUID()},LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(locked,false);locked=true;},releaseLock:()=>{locked=false;}})}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('gas/Store.gs','utf8'),context);const store=new context.SheetsStore_('test-database');
  return {store,setFailure:value=>failBatch=value,data:()=>data,calls:()=>calls,metaCalls:()=>metaCalls,locked:()=>locked};
}
test('Google adapter commits related records in one atomic Sheets request',()=>{
  const e=gasFixture();e.store.transaction(tx=>{tx.put('companies',{id:'one',name:'الشركة'});tx.put('audit',{id:'event',action:'company.save'});tx.put('requests',{id:'receipt',result:{id:'one'}});});
  assert.equal(e.calls(),1);assert.equal(e.locked(),false);assert.equal(e.store.transaction(tx=>tx.get('companies','one').name),'الشركة');
});
test('Google adapter rolls back callback errors and releases lock',()=>{
  const e=gasFixture();assert.throws(()=>e.store.transaction(tx=>{tx.put('companies',{id:'one',name:'lost'});throw Error('validation');}));assert.equal(e.calls(),0);assert.equal(e.locked(),false);assert.equal(e.data().companies.length,0);
});
test('failed Google batch does not partially persist data or idempotency receipt',()=>{
  const e=gasFixture();e.setFailure(true);assert.throws(()=>e.store.transaction(tx=>{tx.put('companies',{id:'one',name:'lost'});tx.put('requests',{id:'receipt'});}));assert.equal(e.locked(),false);assert.equal(e.data().companies.length,0);assert.equal(e.data().requests.length,0);
});
test('read() does not take the script lock and rejects writes',()=>{
  const e=gasFixture();e.store.transaction(tx=>tx.put('companies',{id:'one',name:'الشركة'}));
  assert.equal(e.store.read(tx=>tx.get('companies','one').name),'الشركة');
  assert.equal(e.locked(),false);
  assert.throws(()=>e.store.read(tx=>tx.put('companies',{id:'two',name:'x'})));
});
test('sheet structure is cached across reads and refreshed after a sheet grows',()=>{
  const e=gasFixture();
  e.store.read(tx=>tx.all('companies'));e.store.read(tx=>tx.all('companies'));
  assert.equal(e.metaCalls(),1,'second read should reuse the cached structure');
  for(let i=0;i<1000;i++) e.store.transaction(tx=>tx.put('companies',{id:'c'+i,name:'شركة'}));
  e.store.read(tx=>tx.all('companies'));
  assert.equal(e.metaCalls(),2,'a write that grows a sheet must refresh the cached structure');
});
test('Google adapter writes user text as strings, and handles update/delete',()=>{
  const e=gasFixture();e.store.transaction(tx=>tx.put('companies',{id:'one',name:'=IMPORTXML("untrusted")'}));e.store.transaction(tx=>{const r=tx.get('companies','one');assert.equal(r.version,1);tx.put('companies',{...r,active:false});});assert.equal(e.store.transaction(tx=>tx.get('companies','one').version),2);e.store.transaction(tx=>tx.remove('companies','one'));assert.equal(e.store.transaction(tx=>tx.get('companies','one')),null);
});
test('built Apps Script bundle hashes and verifies without Node crypto or browser globals',()=>{
  const context={console};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/gas/Server.gs','utf8'),context);
  const c=context.Rihla.configureCrypto(n=>[...crypto.randomBytes(n)],s=>crypto.createHash('sha256').update(s).digest('hex'),()=>crypto.randomUUID());
  const hash=c.hash('Production-Work-Factor-2026');assert.ok(hash.startsWith('$2b$12$'));assert.equal(c.verify('Production-Work-Factor-2026',hash),true);assert.equal(c.verify('incorrect',hash),false);
});
test('deployed package exposes only doGet and authenticated api as public functions',()=>{
  const source=['gas/Code.gs','gas/Store.gs'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
  const publicFunctions=[...source.matchAll(/^function\s+(\w+)\s*\(/gm)].map(m=>m[1]).filter(n=>!n.endsWith('_'));
  assert.deepEqual(publicFunctions,['doGet','api']);assert.ok(!fs.readFileSync('dist/gas/Index.html','utf8').includes('Admin-Only-Test-2026'));
});
