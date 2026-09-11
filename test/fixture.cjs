'use strict';
const nodeCrypto=require('node:crypto'),bcrypt=require('bcryptjs');
const {MemoryStore}=require('../src/store.cjs');
const {createApp}=require('../src/app.cjs');
function fixture({seed=true,cost=4}={}) {
  let clock=Date.parse('2026-09-11T08:00:00Z');
  const crypto={id:()=>nodeCrypto.randomUUID(),token:()=>nodeCrypto.randomBytes(32).toString('hex'),digest:s=>nodeCrypto.createHash('sha256').update(s).digest('hex'),hash:s=>bcrypt.hashSync(s,cost),verify:(s,h)=>bcrypt.compareSync(s,h),dummyHash:bcrypt.hashSync('dummy-value-for-checks',cost)};
  const store=new MemoryStore({now:()=>clock,id:crypto.id}),app=createApp({store,crypto,now:()=>clock});
  const result=app.initialize('admin','Admin-Only-Test-2026');
  function request(token,action,payload={},requestId=crypto.id()){return app.handle({token,action,payload,requestId});}
  function ok(token,action,payload={},requestId){const r=request(token,action,payload,requestId);if(!r.ok)throw Object.assign(Error(action+': '+r.error.message),{code:r.error.code});return r.data;}
  const admin=ok('','login',{username:'admin',password:'Admin-Only-Test-2026'}).token;
  const env={store,app,crypto,admin,ok,request,setTime:t=>clock=t};
  if(!seed)return env;
  const companies=['شركة الأفق','شركة المدار'].map(name=>ok(admin,'company.save',{name,active:true}));
  const users=['alpha','bravo'].map((username,i)=>ok(admin,'user.save',{username,name:companies[i].name,role:'company',companyId:companies[i].id,password:'Company-First-2026',active:true}));
  const tokens=users.map(u=>{let token=ok('','login',{username:u.username,password:'Company-First-2026'}).token;ok(token,'account.password',{oldPassword:'Company-First-2026',password:'Company-Private-2026'});return ok('','login',{username:u.username,password:'Company-Private-2026'}).token;});
  const pricing=ok(admin,'pricing.save',{name:'برنامج العمرة — إقامة اقتصادية',kind:'program',roomIds:['single','double','triple','quad'],input:{makkahNights:10,makkahRate:0,otherLyd:2000,profitType:'percent',profitValue:50,rounding:0,sarPerUsd:3.72,usdToLyd:4.85}});
  let offer=ok(admin,'offer.save',{name:'عمرة سبتمبر · 10 ليالٍ',description:'برنامج الإقامة والخدمات المعتمدة. أسعار الغرف للشخص، والعمولة خاصة بالشركة المستفيدة.',pricingId:pricing.id,pricingVersion:pricing.version,validUntil:'2026-12-31'});
  offer=ok(admin,'offer.approve',{id:offer.id,version:offer.version});
  const pub={offerId:offer.id,offerVersion:offer.version,companies:companies.map((c,i)=>({companyId:c.id,commission:i===0?200:300,active:true,special:i===1}))};
  const preview=ok(admin,'publish.preview',pub),published=ok(admin,'publish.commit',{...pub,previewHash:preview.previewHash});
  Object.assign(env,{companies,users,tokens,pricing,offer,assignments:published.assignments});return env;
}
module.exports={fixture};
