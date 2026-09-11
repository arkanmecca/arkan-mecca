'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const {calculateService,quoteLine,convertCurrency}=require('../src/pricing.cjs');
const {exportSheet}=require('../src/export.cjs');
function serviceOffer(e,code,cost,commission){
  const s=e.ok(e.admin,'definition.save',{type:'service',name:'خدمة '+code,cost,currency:code,saleCurrency:code,unit:'roomNight',active:true});
  const pricing=e.ok(e.admin,'pricing.save',{name:s.name,kind:'service',serviceId:s.id,input:{saleCurrency:code,profitType:'fixed',profitValue:20}});
  let offer=e.ok(e.admin,'offer.save',{name:s.name,pricingId:pricing.id,pricingVersion:pricing.version});
  offer=e.ok(e.admin,'offer.approve',{id:offer.id,version:offer.version});
  const p={offerId:offer.id,offerVersion:offer.version,companies:[{companyId:e.companies[0].id,commission,active:true}]};
  const review=e.ok(e.admin,'publish.preview',p);e.ok(e.admin,'publish.commit',{...p,previewHash:review.previewHash});
  return {s,pricing,offer,assignment:review.assignments[0]};
}
test('service cost and sale currencies convert explicitly, same currency needs no rate',()=>{
  const s={id:'s',name:'غرفة',cost:375,currency:'SAR',saleCurrency:'USD',unit:'roomNight'};
  const r=calculateService({sarPerUsd:3.75,usdToLyd:5,profitType:'fixed',profitValue:20},s).results[0];
  assert.equal(r.baseCost,100);assert.equal(r.sell,120);assert.equal(r.currency,'USD');
  assert.equal(calculateService({saleCurrency:'SAR'},s).results[0].sell,375);
  assert.throws(()=>convertCurrency(100,'USD','LYD',{}),{code:'VALIDATION'});
  assert.throws(()=>calculateService({saleCurrency:'BAD'},s),{code:'VALIDATION'});
});
test('cross-currency extras require explicit rate and preserve original amounts',()=>{
  const source={netPrice:100,currency:'USD',unit:'roomNight'};
  const input={quantity:2,nights:3,marginType:'fixed',marginValue:10,extras:[{label:'نقل',amount:100,currency:'LYD',rate:.2}]};
  const r=quoteLine(source,input);assert.equal(r.purchase,600);assert.equal(r.extraTotal,20);assert.equal(r.total,680);
  assert.deepEqual(r.extras[0],{label:'نقل',amount:100,currency:'LYD',rate:.2,convertedAmount:20});
  delete input.extras[0].rate;assert.throws(()=>quoteLine(source,input),{code:'VALIDATION'});
  input.extras[0].currency='USD';assert.equal(quoteLine(source,input).extraTotal,100);
});
test('mixed-currency quote saves separate totals, commissions, private export and backup',()=>{
  const e=fixture(),usd=serviceOffer(e,'USD',100,10),sar=serviceOffer(e,'SAR',200,20);
  assert.equal(usd.assignment.lines[0].netPrice,110);assert.equal(sar.assignment.lines[0].netPrice,200);
  const p={name:'تسعيرة ثلاث عملات',lines:[{assignmentId:e.assignments[0].id,key:'single',quantity:1},...[usd,sar].map(x=>({assignmentId:x.assignment.id,key:x.s.id,quantity:2,nights:3}))]};
  const review=e.ok(e.tokens[0],'quote.preview',p),q=e.ok(e.tokens[0],'quote.save',{...p,previewHash:review.previewHash});
  assert.equal(q.total,null);assert.equal(q.currency,'MULTI');
  assert.deepEqual(q.totals.map(t=>[t.currency,t.total]),[['LYD',2800],['USD',660],['SAR',1200]]);
  assert.deepEqual(e.ok(e.tokens[0],'quote.preview',q).quote.totals,q.totals);
  const out=e.ok(e.tokens[0],'export.quote',{id:q.id}),sheet=exportSheet(out);
  assert.deepEqual(sheet.rows.slice(-3).map(r=>[r[4],r[8]]),[['LYD',2800],['USD',660],['SAR',1200]]);
  assert.ok(!/netPrice|profit|extras|cost/.test(JSON.stringify(out)));
  assert.equal(e.request(e.tokens[1],'export.quote',{id:q.id}).error.code,'NOT_FOUND');
  assert.deepEqual(JSON.parse(JSON.stringify(e.store.data)).quotes[q.id].totals,q.totals);
});
test('source currency change cannot silently relabel a saved company quote',()=>{
  const e=fixture(),x=serviceOffer(e,'USD',100,10),p={name:'محفوظ',lines:[{assignmentId:x.assignment.id,key:x.s.id,quantity:1,nights:1}]};
  const review=e.ok(e.tokens[0],'quote.preview',p),q=e.ok(e.tokens[0],'quote.save',{...p,previewHash:review.previewHash});
  e.store.transaction(tx=>{const a=tx.get('assignments',x.assignment.id);tx.put('assignments',{...a,lines:a.lines.map(l=>({...l,currency:'SAR'}))});});
  assert.equal(e.ok(e.tokens[0],'quote.preview',q).quote.currency,'USD');
  assert.equal(e.request(e.tokens[0],'quote.preview',{...q,refreshSources:true}).error.code,'CURRENCY_CHANGED');
});
test('twenty company bulk publication uses compact idempotent receipts',()=>{
  const e=fixture(),companies=[...e.companies];
  for(let i=2;i<20;i++)companies.push(e.ok(e.admin,'company.save',{name:'شركة '+i,active:true}));
  const p={offerId:e.offer.id,offerVersion:e.offer.version,companies:companies.map((c,i)=>({companyId:c.id,version:e.assignments[i]?.version||0,commission:200,active:true}))};
  const review=e.ok(e.admin,'publish.preview',p),id=e.crypto.id(),payload={...p,previewHash:review.previewHash};
  const first=e.ok(e.admin,'publish.commit',payload,id),retry=e.ok(e.admin,'publish.commit',payload,id);
  assert.deepEqual(first,retry);assert.equal(first.assignments.length,20);assert.equal(Object.keys(e.store.data.assignments).length,20);
  assert.ok(JSON.stringify(first).length<44000);
});
