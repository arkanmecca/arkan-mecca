'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./fixture.cjs');
const {calculateProgram,calculateService}=require('../src/pricing.cjs');
const {validateSnapshot}=require('../src/server-entry.cjs');
function quotePayload(e){return {name:'عائلة أربعة أفراد',customer:'عميل الشركة',lines:[{assignmentId:e.assignments[0].id,key:'double',quantity:4,marginType:'fixed',marginValue:250,extras:[{label:'تكاليف إضافية للعائلة',amount:400}]}]};}
function saveQuote(e,p=quotePayload(e)){const preview=e.ok(e.tokens[0],'quote.preview',p);return e.ok(e.tokens[0],'quote.save',{...p,previewHash:preview.previewHash});}
test('legacy formula matches independently extracted ARKAN formula for all legacy rooms',()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'reference-arkan.js'),'utf8');
  const original=source.match(/function computePricing\(p\)\{.*?\n/)[0];
  const ctx={PR_ROOM_COUNTS:{double:2,triple:3,quad:4,quint:5},pricingServiceCost:()=>71.3,roundUpPrice:(v,s)=>s>0?Math.ceil(v/s)*s:v};vm.createContext(ctx);vm.runInContext(original,ctx);
  const rooms=Object.entries(ctx.PR_ROOM_COUNTS).map(([id,occupancy])=>({id,name:id,occupancy}));
  for(const includeMadinah of [false,true])for(const profitType of ['fixed','percent'])for(const rounding of [0,5,50]){
    const p={makkahRate:235.4,makkahNights:9,madinahRate:211.1,madinahNights:3,includeMadinah,extraBed:25.5,visaUsd:131.2,ticketLyd:1200.5,transportLyd:130.2,otherLyd:77.5,sarPerUsd:3.72,usdToLyd:4.85,profitType,profitValue:13.3,rounding,serviceIds:['svc']};
    const legacy=ctx.computePricing(p),actual=calculateProgram(p,rooms,[{id:'svc',cost:71.3,currency:'LYD'}]);
    for(const r of actual.results)for(const key of ['totalRoomSAR','extraSAR','perPersonSAR','accommodationUSD','accommodationLYD','visaLYD','baseCost','plannedProfit','profit','sell','margin'])assert.ok(Math.abs(r[key]-legacy.results[r.key][key])<1e-8,key+' '+r.key);
  }
});
test('single and custom rooms divide accommodation correctly; standalone service is whole',()=>{
  const p={makkahRate:100,makkahNights:2,sarPerUsd:1,usdToLyd:1,profitValue:0};
  const result=calculateProgram(p,[{id:'single',name:'فردية',occupancy:1},{id:'six',name:'ستة',occupancy:6,extraBeds:0}]);
  assert.equal(result.results[0].baseCost,200);assert.equal(result.results[1].baseCost,200/6);
  const service=calculateService({profitType:'fixed',profitValue:100},{id:'s',name:'غرفة',cost:300,unit:'roomNight',currency:'LYD'});
  assert.equal(service.results[0].basePrice,400);assert.equal(service.results[0].unit,'roomNight');
});
test('custom room cost and manual sell do not mutate defaults',()=>{
  const p={makkahRate:100,makkahNights:2,sarPerUsd:1,usdToLyd:1,roomOverrides:{single:{makkahRate:150,sell:400}}};
  const result=calculateProgram(p,[{id:'single',name:'فردية',occupancy:1}]);assert.equal(result.results[0].baseCost,300);assert.equal(result.results[0].sell,400);assert.equal(p.makkahRate,100);
});
test('company bootstrap and exports do not disclose other companies or admin cost',()=>{
  const e=fixture(),b=e.ok(e.tokens[0],'bootstrap');assert.equal(b.assignments.length,1);assert.equal(b.assignments[0].lines[0].netPrice,2800);
  const json=JSON.stringify(b);assert.ok(!json.includes(e.companies[1].id));assert.ok(!json.includes('baseCost'));assert.ok(!json.includes('passwordHash'));assert.ok(!json.includes('permissions":["'));
  assert.equal(e.request(e.tokens[0],'export.offer',{id:e.assignments[1].id}).error.code,'NOT_FOUND');
  assert.equal(e.request(e.tokens[0],'company.save',{name:'forged'}).error.code,'FORBIDDEN');
});
test('quote totals use company net once and keep private company profit',()=>{
  const e=fixture(),q=saveQuote(e);assert.equal(q.cost,11600);assert.equal(q.total,12600);assert.equal(q.profit,1000);
  assert.equal(e.ok(e.tokens[1],'bootstrap').quotes.length,0);
  assert.equal(e.request(e.tokens[1],'export.quote',{id:q.id}).error.code,'NOT_FOUND');
  assert.equal(e.request(e.admin,'export.quote',{id:q.id}).error.code,'FORBIDDEN');
  const out=e.ok(e.tokens[0],'export.quote',{id:q.id});assert.equal(out.total,12600);assert.ok(!JSON.stringify(out).includes('netPrice'));assert.ok(!JSON.stringify(out).includes('profit'));assert.ok(!JSON.stringify(out).includes('extras'));
});
test('manual resale changes actual profit without adding margin a second time',()=>{
  const e=fixture(),p=quotePayload(e);p.lines[0].mode='manual';p.lines[0].sellUnit=3150;p.lines[0].marginValue=99999;
  assert.equal(e.ok(e.tokens[0],'quote.preview',p).quote.total,12600);
});
test('duplicate request creates one quote and rejects payload reuse',()=>{
  const e=fixture(),p=quotePayload(e),preview=e.ok(e.tokens[0],'quote.preview',p),payload={...p,previewHash:preview.previewHash},id=e.crypto.id();
  const first=e.ok(e.tokens[0],'quote.save',payload,id),second=e.ok(e.tokens[0],'quote.save',payload,id);
  assert.equal(first.id,second.id);assert.equal(Object.keys(e.store.data.quotes).length,1);
  assert.equal(e.request(e.tokens[0],'quote.save',{...payload,name:'different'},id).error.code,'CONFLICT');
});
test('publication preview verifies versions and prevents over-commission',()=>{
  const e=fixture(),a=e.assignments[0],p={offerId:e.offer.id,offerVersion:e.offer.version,companies:[{companyId:e.companies[0].id,version:a.version,commission:3001}]};
  assert.equal(e.request(e.admin,'publish.preview',p).error.code,'VALIDATION');p.companies[0].commission=200;
  const prev=e.ok(e.admin,'publish.preview',p);assert.equal(e.request(e.admin,'publish.commit',{...p,previewHash:'forged'}).error.code,'CONFLICT');
  e.ok(e.admin,'company.save',{...e.companies[0],contact:'changed'});
  assert.equal(e.request(e.admin,'publish.commit',{...p,previewHash:prev.previewHash}).error.code,'CONFLICT');
});
test('bulk publish stores one effective commission; subgroup does not alter other company',()=>{
  const e=fixture(),p={offerId:e.offer.id,offerVersion:e.offer.version,companies:[{companyId:e.companies[0].id,version:e.assignments[0].version,commission:250}]};
  const prev=e.ok(e.admin,'publish.preview',p);e.ok(e.admin,'publish.commit',{...p,previewHash:prev.previewHash});
  assert.equal(e.ok(e.tokens[0],'bootstrap').assignments[0].lines[0].netPrice,2750);assert.equal(e.ok(e.tokens[1],'bootstrap').assignments[0].lines[0].netPrice,2700);
});
test('saved quotes retain prices, opt-in refresh requires review and updates source',()=>{
  const e=fixture(),q=saveQuote(e),a=e.assignments[0],p={offerId:e.offer.id,offerVersion:e.offer.version,companies:[{companyId:e.companies[0].id,version:a.version,commission:500}]};
  const prev=e.ok(e.admin,'publish.preview',p);e.ok(e.admin,'publish.commit',{...p,previewHash:prev.previewHash});
  assert.equal(e.ok(e.tokens[0],'bootstrap').quotes[0].total,q.total);
  const same=e.ok(e.tokens[0],'quote.preview',q);assert.equal(same.quote.total,q.total);
  const refreshed=e.ok(e.tokens[0],'quote.preview',{...q,refreshSources:true});assert.equal(refreshed.quote.total,11400);assert.equal(refreshed.previousTotal,12600);
});
test('forged client purchase price and company id cannot replace server source',()=>{
  const e=fixture(),p=quotePayload(e);p.companyId=e.companies[1].id;p.lines[0].netPrice=1;p.lines[0].source={netPrice:1};
  const q=saveQuote(e,p);assert.equal(q.companyId,e.companies[0].id);assert.equal(q.lines[0].purchase,11200);
});
test('stale quote revision cannot overwrite a concurrent update',()=>{
  const e=fixture(),q=saveQuote(e),p={...q,name:'تعديل أول'},preview=e.ok(e.tokens[0],'quote.preview',p);
  e.ok(e.tokens[0],'quote.save',{...p,previewHash:preview.previewHash});assert.equal(e.request(e.tokens[0],'quote.preview',{...q,name:'تعديل ثان'}).error.code,'CONFLICT');
});
test('expired offers block new quotes but preserve prior saved quotes',()=>{
  const e=fixture(),q=saveQuote(e);e.setTime(Date.parse('2027-01-01T09:00:00Z'));const token=e.ok('','login',{username:'alpha',password:'Company-Private-2026'}).token;
  assert.equal(e.request(token,'quote.preview',quotePayload(e)).error.code,'EXPIRED');assert.equal(e.ok(token,'quote.preview',q).quote.total,q.total);
});
test('disabling company immediately invalidates an existing session',()=>{
  const e=fixture();e.ok(e.admin,'company.save',{...e.companies[0],active:false});assert.equal(e.request(e.tokens[0],'bootstrap').error.code,'AUTH');
});
test('employee cannot escalate role or read financial definitions without permission',()=>{
  const e=fixture();e.ok(e.admin,'user.save',{name:'موظف',username:'employee',role:'employee',permissions:['manageUsers'],password:'Employee-First-2026'});
  let token=e.ok('','login',{username:'employee',password:'Employee-First-2026'}).token;assert.equal(e.request(token,'user.save',{role:'admin'}).error.code,'PASSWORD_CHANGE');
  e.ok(token,'account.password',{oldPassword:'Employee-First-2026',password:'Employee-Second-2026'});token=e.ok('','login',{username:'employee',password:'Employee-Second-2026'}).token;
  const boot=e.ok(token,'bootstrap');assert.equal(boot.definitions,undefined);assert.equal(boot.pricings,undefined);assert.ok(!JSON.stringify(boot).includes('baseCost'));
  assert.equal(e.request(token,'user.save',{role:'employee',name:'x',username:'other',password:'Another-Pass-2026'}).error.code,'FORBIDDEN');
});
test('login throttling, password storage and expiry are enforced',()=>{
  const e=fixture({seed:false});for(let i=0;i<5;i++)assert.equal(e.request('','login',{username:'missing',password:'incorrect'}).error.code,'AUTH');assert.equal(e.request('','login',{username:'missing',password:'incorrect'}).error.code,'RATE_LIMIT');
  const user=Object.values(e.store.data.users)[0];assert.ok(user.passwordHash.startsWith('$2'));assert.ok(!JSON.stringify(e.store.data).includes('Admin-Only-Test-2026'));
  e.setTime(Date.parse('2026-09-12T09:00:00Z'));assert.equal(e.request(e.admin,'bootstrap').error.code,'AUTH');
});
test('backup roundtrip retains relationships and rejects broken data',()=>{
  const e=fixture();saveQuote(e);const copy=JSON.parse(JSON.stringify(e.store.data));assert.equal(validateSnapshot(copy),true);assert.equal(copy.quotes[Object.keys(copy.quotes)[0]].total,12600);
  delete copy.companies[e.companies[0].id];assert.throws(()=>validateSnapshot(copy));
});
test('invalid numbers and empty sources fail without writing a quote',()=>{
  const e=fixture(),p=quotePayload(e);p.lines[0].quantity=-1;assert.equal(e.request(e.tokens[0],'quote.preview',p).error.code,'VALIDATION');assert.equal(Object.keys(e.store.data.quotes).length,0);
});
test('unchanged company assignment keeps its version during a bulk publish',()=>{
  const e=fixture(),p={offerId:e.offer.id,offerVersion:e.offer.version,companies:e.companies.map((c,i)=>({companyId:c.id,version:e.assignments[i].version,commission:i===0?250:300,special:i===1,active:true}))};
  const prev=e.ok(e.admin,'publish.preview',p),out=e.ok(e.admin,'publish.commit',{...p,previewHash:prev.previewHash});assert.equal(out.assignments[1].version,e.assignments[1].version);assert.equal(out.assignments[0].version,e.assignments[0].version+1);
});
test('copying saved pricing preserves its room-definition snapshot after master edits',()=>{
  const e=fixture(),room=e.store.data.definitions.double;e.ok(e.admin,'definition.save',{...room,occupancy:7});
  const copied=e.ok(e.admin,'pricing.save',{...e.pricing,id:undefined,version:undefined,sourcePricingId:e.pricing.id,sourcePricingVersion:e.pricing.version,name:'نسخة'});
  assert.equal(copied.result.results.find(r=>r.key==='double').count,2);assert.equal(e.store.data.definitions.double.occupancy,7);
});
