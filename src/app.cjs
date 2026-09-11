'use strict';
const {AppError,fail,number,integer,text,money,currency,totalsByCurrency,calculateProgram,calculateService,quoteLine}=require('./pricing.cjs');
const {TABLES,clone}=require('./store.cjs');
const PERMISSIONS=['viewCost','editDefinitions','editPricing','approve','publish','manageCompanies','manageUsers','export'];
const MUTATIONS=new Set(['definition.save','definition.import','company.save','user.save','pricing.save','offer.save','offer.approve','offer.archive','publish.commit','quote.save','quote.archive','settings.save','account.password']);
const safeUser=u=>({id:u.id,name:u.name,username:u.username,role:u.role,companyId:u.companyId || '',permissions:u.permissions || [],active:u.active,mustChange:!!u.mustChange,version:u.version});
const permission=(u,p)=>u.role==='admin'||(u.role==='employee'&&(u.permissions || []).includes(p));
function requirePermission(u,p) { if(!permission(u,p)) fail('FORBIDDEN','لا تملك صلاحية تنفيذ هذه العملية'); }
function version(old,expected) { if(old && old.version!==Number(expected)) fail('CONFLICT','تغير السجل منذ فتحه. أعد تحميله وراجع التعديل قبل الحفظ.'); }
function date(value) { const s=text(value,'التاريخ',10); if(s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)) || new Date(s).toISOString().slice(0,10)!==s)) fail('VALIDATION','التاريخ غير صحيح'); return s; }
function idValue(value) { return text(value,'المعرف',150,true); }
function requireRow(tx,table,id) { const r=tx.get(table,idValue(id)); if(!r) fail('NOT_FOUND','السجل غير متاح'); return r; }
function publicLines(lines) { return lines.map(l=>({key:l.key,label:l.label,unit:l.unit,currency:l.currency || 'LYD',count:l.count || null,basePrice:money(l.basePrice)})); }
function publicOffer(o,withCost=false) {
  const out={id:o.id,version:o.version,name:o.name,kind:o.kind,description:o.description,validUntil:o.validUntil,status:o.status,archived:!!o.archived,lines:publicLines(o.lines),updatedAt:o.updatedAt,pricingId:o.pricingId};
  if(withCost) out.lines=clone(o.lines);
  return out;
}
function validatePassword(password) {
  const value=String(password || '');
  if(!value.length || unescape(encodeURIComponent(value)).length>72) fail('VALIDATION','أدخل كلمة مرور صحيحة، بحد أقصى 72 بايت.');
  return value;
}
function createApp({store,crypto,now=Date.now}) {
  const today=()=>new Date(now()).toISOString().slice(0,10);
  const digest=x=>crypto.digest(JSON.stringify(x));
  function authenticate(tx,token) {
    if(typeof token!=='string'||token.length<32||token.length>512) fail('AUTH','سجل الدخول للمتابعة');
    const s=tx.get('sessions',crypto.digest(token));
    if(!s||s.expiresAt<=now()) fail('AUTH','انتهت الجلسة. سجل الدخول من جديد.');
    const u=tx.get('users',s.userId);
    if(!u||!u.active||u.authVersion!==s.authVersion) fail('AUTH','الحساب أو الجلسة غير متاح');
    if(u.role==='company'&&!tx.get('companies',u.companyId)?.active) fail('AUTH','حساب الشركة موقوف');
    return u;
  }
  function audit(tx,u,action,entityId) { tx.put('audit',{id:crypto.id(),actorId:u.id,actorName:u.name,companyId:u.companyId||'',action,entityId:entityId||'',at:new Date(now()).toISOString()}); }
  function login(p) {
    const username=text(p.username,'اسم المستخدم',80).toLowerCase();
    const password=String(p.password || '');
    if(password.length>200) fail('AUTH','بيانات الدخول غير صحيحة');
    const window=Math.floor(now()/(15*60*1000));
    const attemptId=crypto.digest('login:'+username+':'+window);
    const candidate=store.transaction(tx=>{
      const local=tx.get('attempts',attemptId)||{id:attemptId,count:0,expiresAt:now()+24*3600000};
      const globalId='global:'+Math.floor(now()/(5*60*1000));
      const global=tx.get('attempts',globalId)||{id:globalId,count:0,expiresAt:now()+24*3600000};
      if(local.count>=5||global.count>=100) fail('RATE_LIMIT','محاولات دخول كثيرة. حاول لاحقاً أو تواصل مع المسؤول.');
      tx.put('attempts',{...local,count:local.count+1}); tx.put('attempts',{...global,count:global.count+1});
      return tx.all('users').find(u=>u.username===username)||null;
    });
    // Constant work for unknown accounts, no account-existence disclosure.
    const valid=crypto.verify(password,candidate?.passwordHash || crypto.dummyHash);
    if(!candidate||!valid) fail('AUTH','بيانات الدخول غير صحيحة');
    const token=crypto.token();
    return store.transaction(tx=>{
      const u=tx.get('users',candidate.id);
      if(!u||!u.active||u.passwordHash!==candidate.passwordHash||(u.role==='company'&&!tx.get('companies',u.companyId)?.active)) fail('AUTH','بيانات الدخول غير صحيحة');
      tx.put('attempts',{id:attemptId,count:0,expiresAt:now()+24*3600000});
      tx.put('sessions',{id:crypto.digest(token),userId:u.id,authVersion:u.authVersion,expiresAt:now()+8*3600000});
      return {token,user:safeUser(u)};
    });
  }
  function ownedAssignment(tx,u,id,allowExpired=false) {
    const a=tx.get('assignments',id);
    if(!a||a.companyId!==u.companyId||!a.active||tx.get('offers',a.offerId)?.archived) fail('NOT_FOUND','العرض غير متاح لشركتك');
    if(!allowExpired&&a.validUntil&&a.validUntil<today()) fail('EXPIRED','انتهت صلاحية العرض. تواصل مع المسؤول لتحديثه.');
    return a;
  }
  function ownedQuote(tx,u,id) {
    if(u.role!=='company') fail('FORBIDDEN','التسعيرات الخاصة متاحة لحسابات الشركة فقط');
    const q=tx.get('quotes',id);
    if(!q||q.companyId!==u.companyId) fail('NOT_FOUND','التسعيرة غير متاحة'); return q;
  }
  function definitionValue(p) {
    const type=p.type;
    if(!['room','city','hotel','service'].includes(type)) fail('VALIDATION','نوع تعريف غير صحيح');
    const r={type,name:text(p.name,'الاسم',200,true),active:p.active!==false};
    if(type==='room') { r.occupancy=integer(p.occupancy,'عدد الأشخاص',1,20); r.extraBeds=p.extraBeds===''||p.extraBeds==null?null:integer(p.extraBeds,'الأسرّة الإضافية',0,20); }
    if(type==='hotel') { r.cityId=text(p.cityId,'المدينة',150); r.rate=number(p.rate,'سعر الغرفة بالريال'); }
    if(type==='service') { r.cost=number(p.cost,'تكلفة الخدمة'); r.currency=currency(p.currency||'LYD');r.saleCurrency=currency(p.saleCurrency||'LYD'); r.unit=p.unit==='roomNight'?'roomNight':'item'; }
    return r;
  }
  function calculate(tx,p,previous) {
    if(!previous&&p.sourcePricingId){previous=requireRow(tx,'pricings',p.sourcePricingId);version(previous,p.sourcePricingVersion);}
    const defs=tx.all('definitions');
    const input=clone(p.input || {});
    if(JSON.stringify(input).length>14000) fail('VALIDATION','تفاصيل التسعير أكبر من الحد المسموح');
    const selected=[...new Set(p.roomIds || [])];
    const baseDefs=previous&&!p.refreshDefinitions?[...(previous.definitionsSnapshot || []),...defs]:defs;
    const rooms=selected.map(id=>baseDefs.find(d=>d.id===id&&d.type==='room'&&d.active));
    if(rooms.some(r=>!r)) fail('VALIDATION','نوع غرفة غير متاح');
    const services=[...new Map(baseDefs.filter(d=>d.type==='service').reverse().map(d=>[d.id,d])).values()];
    const kind=p.kind==='service'?'service':'program';
    const service=services.find(s=>s.id===p.serviceId);
    const result=kind==='program'?calculateProgram(input,rooms,services):calculateService(input,service);
    return {kind,input,roomIds:selected,serviceId:kind==='service'?p.serviceId:'',definitionsSnapshot:kind==='service'?[service]:[...rooms,...services.filter(s=>(input.serviceIds||[]).includes(s.id))],result};
  }
  function publication(tx,u,p) {
    requirePermission(u,'publish');
    const offer=requireRow(tx,'offers',p.offerId); version(offer,p.offerVersion);
    if(offer.status!=='approved'||offer.archived) fail('VALIDATION','يجب اعتماد العرض قبل نشره');
    if(offer.validUntil&&offer.validUntil<today()) fail('EXPIRED','لا يمكن نشر عرض منتهي الصلاحية');
    const selections=p.companies || [];
    if(!selections.length||selections.length>100||new Set(selections.map(s=>s.companyId)).size!==selections.length) fail('VALIDATION','اختر شركات دون تكرار وبحد أقصى 100 شركة');
    const assignments=selections.map(sel=>{
      const company=requireRow(tx,'companies',sel.companyId);
      if(!company.active) fail('VALIDATION','إحدى الشركات موقوفة');
      const id=offer.id+':'+company.id,old=tx.get('assignments',id);
      version(old,sel.version || 0);
      const defaultCommission=number(sel.commission,'العمولة');
      const lines=publicLines(offer.lines).map(l=>{
        const commission=money(number(sel.lineCommissions?.[l.key]??defaultCommission,'عمولة البند'));
        if(commission>l.basePrice) fail('VALIDATION','العمولة تتجاوز السعر الأساسي: '+company.name+' — '+l.label);
        return {...l,commission,netPrice:money(l.basePrice-commission)};
      });
      return {id,oldVersion:old?.version||0,companyId:company.id,companyName:company.name,companyVersion:company.version,offerId:offer.id,offerVersion:offer.version,name:offer.name,kind:offer.kind,description:offer.description,validUntil:offer.validUntil,lines,commission:defaultCommission,special:!!sel.special,active:sel.active!==false};
    });
    const currencyChanges=assignments.filter(a=>{const old=tx.get('assignments',a.id);return old&&a.lines.some(l=>old.lines.find(x=>x.key===l.key)?.currency!==l.currency);}).map(a=>a.companyName);
    return {assignments,currencyChanges,previewHash:digest(assignments)};
  }
  function quotePreview(tx,u,p) {
    if(u.role!=='company') fail('FORBIDDEN','هذه العملية خاصة بحساب الشركة');
    const old=p.id?ownedQuote(tx,u,p.id):null; version(old,p.version);
    const inputs=p.lines || [];
    if(!inputs.length||inputs.length>60) fail('VALIDATION','أضف من بند واحد إلى 60 بنداً');
    const seen=new Set();
    const lines=inputs.map((input,index)=>{
      const prior=old?.lines.find(l=>l.id===input.id);
      let source;
      if(prior&&!p.refreshSources&&prior.assignmentId===input.assignmentId&&prior.key===input.key) source=prior.source;
      else {
        const a=ownedAssignment(tx,u,input.assignmentId);
        const line=a.lines.find(l=>l.key===input.key); if(!line) fail('NOT_FOUND','بند العرض غير متاح');
        source={...line,assignmentId:a.id,assignmentVersion:a.version,offerName:a.name,validUntil:a.validUntil};
        if(prior&&prior.source.currency!==source.currency)fail('CURRENCY_CHANGED','تغيرت عملة هذا البند. أضفه من العرض الجديد وراجع تكاليفه وربحه بدلاً من تحديث العملة تلقائياً.');
      }
      const lineId=prior?.id||('line-'+index);
      if(seen.has(lineId)) fail('VALIDATION','بند مكرر'); seen.add(lineId);
      return {...quoteLine(source,input),id:lineId,assignmentId:source.assignmentId,key:source.key,source:clone(source)};
    });
    const quote={id:old?.id||'',version:old?.version||0,companyId:u.companyId,name:text(p.name,'اسم التسعيرة',200,true),customer:text(p.customer,'العميل',200),notes:text(p.notes,'الملاحظات',5000),validUntil:date(p.validUntil),lines,archived:old?.archived||false};
    quote.totals=totalsByCurrency(lines);const single=quote.totals.length===1?quote.totals[0]:null;
    quote.currency=single?.currency||'MULTI';quote.total=single?.total??null;quote.cost=single?.cost??null;quote.profit=single?.profit??null;
    const previousTotals=old?(old.totals||[{currency:old.currency||'LYD',total:old.total,cost:old.cost,profit:old.profit}]):[];
    return {quote,previousTotals,previousTotal:old?.total??null,previewHash:digest(quote)};
  }
  function bootstrap(tx,u) {
    const settings=tx.get('settings','main')||{};
    if(u.mustChange) return {user:safeUser(u),settings:{name:settings.name},mustChange:true};
    if(u.role==='company') {
      const company=tx.get('companies',u.companyId);
      const assignments=tx.all('assignments').filter(a=>a.companyId===u.companyId&&a.active&&!tx.get('offers',a.offerId)?.archived).map(a=>({...a,expired:!!a.validUntil&&a.validUntil<today()}));
      const quotes=tx.all('quotes').filter(q=>q.companyId===u.companyId).map(q=>({...q,hasUpdate:q.lines.some(l=>{const a=tx.get('assignments',l.assignmentId);return !a||!a.active||a.version!==l.source.assignmentVersion||tx.get('offers',a.offerId)?.archived;} )}));
      return {user:safeUser(u),company:{id:company.id,name:company.name,contact:company.contact},settings:{name:settings.name},assignments,quotes};
    }
    const viewCost=permission(u,'viewCost');
    const result={user:safeUser(u),settings:{id:settings.id,name:settings.name,version:settings.version},offers:tx.all('offers').map(o=>publicOffer(o,viewCost))};
    if(viewCost) { result.definitions=tx.all('definitions'); result.pricings=tx.all('pricings'); result.settings= settings; }
    if(permission(u,'manageCompanies')||permission(u,'publish')||permission(u,'manageUsers')) result.companies=tx.all('companies');
    if(permission(u,'publish')) result.assignments=tx.all('assignments');
    if(permission(u,'manageUsers')) result.users=tx.all('users').filter(x=>u.role==='admin'||x.role==='company').map(safeUser);
    if(u.role==='admin') result.audit=tx.all('audit').filter(x=>!x.companyId).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,150);
    return result;
  }
  function run(tx,u,action,p,preparedHash) {
    switch(action) {
      case 'bootstrap': return bootstrap(tx,u);
      case 'backup.create': if(u.role!=='admin') fail('FORBIDDEN','النسخ الاحتياطي يخص المسؤول'); return {authorized:true};
      case 'logout': tx.remove('sessions',crypto.digest(p.token)); return {ok:true};
      case 'account.password': {
        const updated=tx.put('users',{...u,passwordHash:preparedHash,mustChange:false,authVersion:u.authVersion+1});
        audit(tx,u,action,u.id); return {loggedOut:true,user:safeUser(updated)};
      }
      case 'definition.save': {
        requirePermission(u,'editDefinitions'); requirePermission(u,'viewCost');
        const old=p.id?requireRow(tx,'definitions',p.id):null; version(old,p.version);
        const val=definitionValue(p); if(old&&old.type!==val.type) fail('VALIDATION','لا يمكن تغيير نوع التعريف');
        if(tx.all('definitions').some(d=>d.type===val.type&&d.name===val.name&&d.id!==old?.id)) fail('VALIDATION','يوجد تعريف بهذا الاسم والنوع');
        if(val.type==='hotel'&&val.cityId&&tx.get('definitions',val.cityId)?.type!=='city') fail('VALIDATION','المدينة غير صحيحة');
        return tx.put('definitions',{...val,id:old?.id||crypto.id()});
      }
      case 'definition.import': {
        requirePermission(u,'editDefinitions'); requirePermission(u,'viewCost');
        if(!Array.isArray(p.rows)||!p.rows.length||p.rows.length>200) fail('VALIDATION','الاستيراد من 1 إلى 200 صف');
        const rows=p.rows.map(definitionValue),seen=new Set(tx.all('definitions').map(d=>d.type+':'+d.name));
        for(const r of rows) {const key=r.type+':'+r.name;if(seen.has(key)) fail('VALIDATION','اسم مكرر: '+r.name);seen.add(key);if(r.type==='hotel'&&r.cityId&&tx.get('definitions',r.cityId)?.type!=='city') fail('VALIDATION','معرف المدينة غير صحيح');}
        return {count:rows.map(r=>tx.put('definitions',{...r,id:crypto.id()})).length};
      }
      case 'company.save': {
        requirePermission(u,'manageCompanies'); const old=p.id?requireRow(tx,'companies',p.id):null; version(old,p.version);
        return tx.put('companies',{id:old?.id||crypto.id(),name:text(p.name,'اسم الشركة',200,true),contact:text(p.contact,'التواصل',300),active:p.active!==false});
      }
      case 'user.save': {
        requirePermission(u,'manageUsers'); const old=p.id?requireRow(tx,'users',p.id):null; version(old,p.version);
        const role=p.role; if(!['admin','employee','company'].includes(role)) fail('VALIDATION','نوع الحساب غير صحيح');
        if(u.role!=='admin'&&(role!=='company'||old&&old.role!=='company')) fail('FORBIDDEN','إدارة الموظفين والمسؤول تخص المسؤول الرئيسي');
        if(role==='admin'&&old?.id!==u.id) fail('FORBIDDEN','لا يمكن إنشاء مسؤول إضافي من هذه الشاشة');
        if(old?.role==='admin'&&(role!=='admin'||p.active===false)) fail('VALIDATION','لا يمكن تعطيل حساب المسؤول الرئيسي أو تغيير نوعه');
        const username=text(p.username,'اسم المستخدم',80,true).toLowerCase();
        if(!/^[a-z0-9._-]{3,80}$/.test(username)) fail('VALIDATION','اسم المستخدم: حروف إنجليزية وأرقام ونقطة وشرطة، من 3 أحرف');
        if(tx.all('users').some(x=>x.username===username&&x.id!==old?.id)) fail('VALIDATION','اسم المستخدم مستخدم');
        const companyId=role==='company'?idValue(p.companyId):'';
        if(companyId&&!tx.get('companies',companyId)) fail('VALIDATION','اختر الشركة');
        const permissions=role==='employee'?[...new Set((p.permissions||[]).filter(x=>PERMISSIONS.includes(x)))]:[];
        if((permissions.includes('editPricing')||permissions.includes('editDefinitions'))&&!permissions.includes('viewCost')) fail('VALIDATION','تعديل التعريفات المالية أو التسعير يتطلب صلاحية رؤية التكلفة');
        if(!old&&!preparedHash) fail('VALIDATION','أدخل كلمة مرور أولية');
        const saved=tx.put('users',{id:old?.id||crypto.id(),username,name:text(p.name,'الاسم',200,true),role,companyId,permissions,active:p.active!==false,passwordHash:preparedHash||old.passwordHash,mustChange:preparedHash?true:old.mustChange,authVersion:(old?.authVersion||0)+1});
        return safeUser(saved);
      }
      case 'pricing.calculate': {
        requirePermission(u,'editPricing'); requirePermission(u,'viewCost');
        return calculate(tx,p,p.id?requireRow(tx,'pricings',p.id):null);
      }
      case 'pricing.save': {
        requirePermission(u,'editPricing'); requirePermission(u,'viewCost');
        const old=p.id?requireRow(tx,'pricings',p.id):null; version(old,p.version);
        return tx.put('pricings',{id:old?.id||crypto.id(),name:text(p.name,'اسم التسعير',200,true),notes:text(p.notes,'الملاحظات',5000),isTemplate:!!p.isTemplate,...calculate(tx,p,old)});
      }
      case 'offer.save': {
        requirePermission(u,'editPricing'); requirePermission(u,'viewCost');
        const old=p.id?requireRow(tx,'offers',p.id):null; version(old,p.version);
        const pricing=requireRow(tx,'pricings',p.pricingId); version(pricing,p.pricingVersion);
        return tx.put('offers',{id:old?.id||crypto.id(),name:text(p.name,'اسم العرض',200,true),description:text(p.description,'التفاصيل',6000),validUntil:date(p.validUntil),kind:pricing.kind,pricingId:pricing.id,pricingVersion:pricing.version,lines:clone(pricing.result.results),status:'draft',archived:false});
      }
      case 'offer.approve': {
        requirePermission(u,'approve'); const o=requireRow(tx,'offers',p.id);version(o,p.version);
        if(o.archived) fail('VALIDATION','العرض مؤرشف');return publicOffer(tx.put('offers',{...o,status:'approved',approvedBy:u.id}),permission(u,'viewCost'));
      }
      case 'offer.archive': {
        requirePermission(u,'publish');const o=requireRow(tx,'offers',p.id);version(o,p.version);
        return publicOffer(tx.put('offers',{...o,archived:p.archived!==false}),permission(u,'viewCost'));
      }
      case 'publish.preview': return publication(tx,u,p);
      case 'publish.commit': {
        const result=publication(tx,u,p);
        if(result.previewHash!==p.previewHash) fail('CONFLICT','تغيرت بيانات النشر. أعد المراجعة قبل الحفظ.');
        return {assignments:result.assignments.map(a=>{const {oldVersion,companyVersion,...record}=a;const old=tx.get('assignments',record.id);const saved=old&&Object.keys(record).every(k=>JSON.stringify(record[k])===JSON.stringify(old[k]))?old:tx.put('assignments',record);return {id:saved.id,version:saved.version,companyId:saved.companyId};})};
      }
      case 'quote.preview': return quotePreview(tx,u,p);
      case 'quote.save': {
        const result=quotePreview(tx,u,p);
        if(result.previewHash!==p.previewHash) fail('CONFLICT','تغيرت التسعيرة. أعد مراجعة الحساب قبل الحفظ.');
        return tx.put('quotes',{...result.quote,id:result.quote.id||crypto.id()});
      }
      case 'quote.archive': {
        const q=ownedQuote(tx,u,p.id);version(q,p.version);return tx.put('quotes',{...q,archived:p.archived!==false});
      }
      case 'export.offer': {
        if(u.role==='company') return {kind:'offer',company:tx.get('companies',u.companyId).name,...ownedAssignment(tx,u,p.id,true)};
        requirePermission(u,'export'); return {kind:'offer',...publicOffer(requireRow(tx,'offers',p.id))};
      }
      case 'export.quote': {
        const q=ownedQuote(tx,u,p.id);return {id:q.id,name:q.name,customer:q.customer,notes:q.notes,validUntil:q.validUntil,company:tx.get('companies',u.companyId).name,currency:q.currency,total:q.total,totals:(q.totals||[{currency:q.currency||'LYD',total:q.total}]).map(t=>({currency:t.currency,total:t.total})),kind:'quote',lines:q.lines.map(l=>({label:l.label,offerName:l.source.offerName,unit:l.unit,currency:l.currency||'LYD',quantity:l.quantity,nights:l.nights,units:l.units,sellUnit:l.sellUnit,total:l.total}))};
      }
      case 'settings.save': {
        if(u.role!=='admin') fail('FORBIDDEN','الإعدادات تخص المسؤول');
        const old=tx.get('settings','main');version(old,p.version);
        return tx.put('settings',{...old,name:text(p.name,'اسم المنشأة',200,true),sarPerUsd:number(p.sarPerUsd,'الدولار بالريال',.0001),usdToLyd:number(p.usdToLyd,'الدولار بالدينار',.0001)});
      }
      default: fail('NOT_FOUND','العملية غير متاحة');
    }
  }
  function handle(request) {
    try {
      if(!request||JSON.stringify(request).length>300000) fail('VALIDATION','الطلب أكبر من الحد المسموح');
      const action=String(request.action||''),p=request.payload || {};
      if(action==='login') return {ok:true,data:login(p)};
      let preparedHash;
      // Perform password work only after authorization and outside the write lock.
      if(action==='account.password'||action==='user.save'&&p.password) {
        const u=store.transaction(tx=>authenticate(tx,request.token));
        if(action==='user.save') {requirePermission(u,'manageUsers');if(u.mustChange) fail('AUTH','غيّر كلمة مرورك أولاً');}
        else if(!crypto.verify(String(p.oldPassword||''),u.passwordHash)) fail('VALIDATION','كلمة المرور الحالية غير صحيحة');
        preparedHash=crypto.hash(validatePassword(p.password));
      }
      // logout removes a session row and every listed MUTATIONS action writes data, so both
      // need the locked path; anything else (opening a screen, listing records) only reads,
      // and runs on the lock-free path so concurrent users don't queue behind each other.
      const needsWrite=action==='logout'||MUTATIONS.has(action);
      const data=(needsWrite?store.transaction:store.read).call(store,tx=>{
        const u=authenticate(tx,request.token);
        if(u.mustChange&&!['bootstrap','account.password','logout'].includes(action)) fail('PASSWORD_CHANGE','غيّر كلمة المرور الأولية للمتابعة');
        if(action==='logout') return run(tx,u,action,{token:request.token});
        if(!MUTATIONS.has(action)) return run(tx,u,action,p);
        const requestId=text(request.requestId,'معرف العملية',100,true);
        if(!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) fail('VALIDATION','معرف العملية غير صحيح');
        const key=u.id+':'+u.authVersion+':'+requestId,hash=digest({action,p}),prior=tx.get('requests',key);
        if(prior) {if(prior.hash!==hash) fail('CONFLICT','معرف العملية مستخدم لطلب مختلف');return prior.result;}
        const result=run(tx,u,action,p,preparedHash);
        tx.put('requests',{id:key,hash,result,expiresAt:now()+72*3600000});
        if(action!=='account.password') audit(tx,u,action,result?.id||p.id||p.offerId||'');
        return result;
      });
      return {ok:true,data};
    } catch(e) {
      if(e instanceof AppError) return {ok:false,error:{code:e.code,message:e.message}};
      if(e.message==='RECORD_SIZE') return {ok:false,error:{code:'VALIDATION',message:'السجل كبير جداً. قلل عدد البنود أو طول الملاحظات.'}};
      return {ok:false,error:{code:'SERVER',message:'تعذر إتمام العملية. أعد المحاولة بنفس الطلب؛ وإذا استمر الخطأ راجع المسؤول.'}};
    }
  }
  function initialize(username,password,name='رحلة | تسعير البرامج') {
    const passwordHash=crypto.hash(validatePassword(password));
    return store.transaction(tx=>{
      if(tx.all('users').length) fail('VALIDATION','تم إعداد المنظومة مسبقاً');
      if(!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) fail('VALIDATION','اسم المسؤول غير صحيح');
      tx.put('settings',{id:'main',name,sarPerUsd:3.72,usdToLyd:4.85,schemaVersion:1});
      for(const [key,label,count] of [['single','فردية',1],['double','زوجية',2],['triple','ثلاثية',3],['quad','رباعية',4],['quint','خماسية',5]]) tx.put('definitions',{id:key,type:'room',name:label,occupancy:count,extraBeds:null,active:true});
      const u=tx.put('users',{id:crypto.id(),username:username.toLowerCase(),name:'المسؤول الرئيسي',role:'admin',companyId:'',permissions:[],active:true,passwordHash,mustChange:false,authVersion:1});
      return safeUser(u);
    });
  }
  function cleanup() {return store.transaction(tx=>{let count=0;for(const table of ['attempts','sessions','requests']) for(const r of tx.all(table)) if(r.expiresAt<now()){tx.remove(table,r.id);count++;}return count;});}
  return {handle,initialize,cleanup};
}
module.exports={createApp,PERMISSIONS,validatePassword};
