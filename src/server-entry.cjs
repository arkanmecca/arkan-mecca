'use strict';
const bcrypt=require('bcryptjs');
const {createApp}=require('./app.cjs');
const {UnitOfWork,TABLES}=require('./store.cjs');
function configureCrypto(randomBytes,digest,id) {
  bcrypt.setRandomFallback(randomBytes);
  return {id,token:()=>id().replace(/-/g,'')+id().replace(/-/g,''),digest,
    hash:password=>bcrypt.hashSync(password,12),verify:(password,hash)=>bcrypt.compareSync(password,hash),
    dummyHash:'$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxL5/C.qPa.lHFPCMj71Ri.uB2C'};
}
function validateSnapshot(data) {
  for(const t of TABLES) if(!data[t]||typeof data[t]!=='object'||Array.isArray(data[t])) throw Error('جدول مفقود: '+t);
  if(data.settings.main?.schemaVersion!==1) throw Error('إصدار النسخة غير مدعوم');
  if(!Object.values(data.users).some(u=>u.role==='admin'&&u.active)) throw Error('النسخة لا تحتوي مسؤولاً فعالاً');
  for(const t of TABLES) for(const [id,r] of Object.entries(data[t])) if(r.id!==id||!Number.isInteger(r.version)||r.version<1) throw Error('سجل غير صحيح في '+t);
  for(const u of Object.values(data.users)) if(u.role==='company'&&!data.companies[u.companyId]) throw Error('شركة الحساب غير موجودة');
  for(const a of Object.values(data.assignments)) if(!data.companies[a.companyId]||!data.offers[a.offerId]) throw Error('ربط العرض غير صحيح');
  for(const q of Object.values(data.quotes)) if(!data.companies[q.companyId]||!Array.isArray(q.lines)||q.lines.some(l=>!l.source||!Number.isFinite(l.total))) throw Error('تسعيرة غير صحيحة');
  return true;
}
module.exports={createApp,UnitOfWork,TABLES,configureCrypto,validateSnapshot};
