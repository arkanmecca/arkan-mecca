'use strict';
const {quoteLine,totalsByCurrency}=require('./pricing.cjs');
const ExcelJS=require('exceljs');
const {exportSheet}=require('./export.cjs');
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(Number(v)||0);
const currencyOptions=[['LYD','دينار ليبي (LYD)'],['USD','دولار (USD)'],['SAR','ريال سعودي (SAR)']];
const currencyLabel=c=>({LYD:'د.ل',USD:'USD',SAR:'SAR'}[c]||c||'د.ل');
const amount=(v,c='LYD')=>'<span class="num">'+fmt(v)+'</span> <small>'+esc(currencyLabel(c))+'</small>';
const quoteTotals=q=>q.totals||[{currency:q.currency||'LYD',total:q.total,cost:q.cost,profit:q.profit}];
const totalsHtml=(q,key='total')=>quoteTotals(q).map(t=>'<div>'+amount(t[key],t.currency)+'</div>').join('');
const unitLabel=u=>({person:'للشخص',roomNight:'للغرفة / الليلة',item:'للخدمة كاملة'}[u]||u);
const labels={viewCost:'رؤية التكلفة والربح',editDefinitions:'تعديل التعريفات المالية',editPricing:'إعداد وتعديل التسعير',approve:'اعتماد العروض',publish:'النشر والعمولات والأرشفة',manageCompanies:'إدارة الشركات',manageUsers:'إدارة حسابات الشركات',export:'الطباعة والتصدير'};
const state={token:sessionStorage.getItem('rihla_session')||'',boot:null,tab:'offers',filter:'',kind:'all',editor:null,pending:null};
const pendingRequests=new Map();
function requestId(){return [...crypto.getRandomValues(new Uint8Array(24))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const isCompany=()=>state.boot?.user.role==='company';
const can=p=>state.boot?.user.role==='admin'||state.boot?.user.permissions?.includes(p);
const btn=(label,action,id='',style='')=>`<button type="button" class="btn ${style}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
const field=(label,name,value='',type='text',attrs='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const num=(label,name,value=0,attrs='')=>field(label,name,value,'number',(attrs.includes('min=')?'':'min="0" ')+(attrs.includes('step=')?'':'step="0.001" ')+attrs);
const select=(label,name,options,value)=>`<label>${label}<select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
const textarea=(label,name,value='')=>`<label class="full">${label}<textarea name="${name}" maxlength="6000">${esc(value)}</textarea></label>`;
const check=(label,name,on,value='on')=>`<label class="check"><input type="checkbox" name="${name}" value="${esc(value)}" ${on?'checked':''}>${esc(label)}</label>`;
const badge=(label,type='')=>`<span class="badge ${type}">${esc(label)}</span>`;
function table(headers,rows){headers=headers.map(h=>h==='بيع الوحدة'?'متوسط بيع الوحدة':h);return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>{let col=0;return row.replace(/<td>/g,()=>'<td data-label="'+esc(headers[col++])+'">');}).join('')}</tbody></table></div>`;}
const tr=cells=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
const actions=html=>'<div class="actions">'+html+'</div>';
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',6000);}
function setToken(token){state.token=token;if(token)sessionStorage.setItem('rihla_session',token);else sessionStorage.removeItem('rihla_session');}
async function call(action,payload={},explicitId){
  const fingerprint=JSON.stringify([state.token,action,payload]);
  const mutation=/\.(save|commit|import|approve|archive|password)$/.test(action);
  const id=explicitId||(mutation&&pendingRequests.get(fingerprint))||requestId();
  if(mutation)pendingRequests.set(fingerprint,id);
  const request={action,payload,token:state.token,requestId:id};
  let result;
  const send=()=>window.google?.script?.run?new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).api(request)):fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)}).then(r=>{if(!r.ok)throw Error('تعذر الاتصال');return r.json();});
  try{result=await send();}catch(e){try{result=await send();}catch(err){throw Error('تعذر الاتصال. تحقق من الإنترنت وحاول من جديد.');}}
  if(!result.ok){if(result.error.code!=='SERVER')pendingRequests.delete(fingerprint);if(result.error.code==='AUTH'&&action!=='login'){setToken('');closeDialog();$('#print-root').innerHTML='';renderLogin();}throw Error(result.error.message);}
  pendingRequests.delete(fingerprint);
  return result.data;
}
async function reload(){state.boot=await call('bootstrap');if(state.boot.mustChange){renderPasswordPage();return;}render();}
function dialog(title,body,editor=null){state.editor=editor;state.pending=null;$('#dialog').innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2>${btn('إغلاق','dialog.close')}</div><div class="dialog-body">${body}<div id="dialog-error" class="form-error" role="alert"></div></div>`;if(!$('#dialog').open)$('#dialog').showModal();}
function closeDialog(){$('#dialog').close();state.editor=null;state.pending=null;}
function footer(label='حفظ'){return `<div class="form-actions">${btn('إلغاء','dialog.close')}<button class="btn primary" type="submit">${label}</button></div>`;}
function renderLogin(){state.boot=null;$('#app').innerHTML=`<div class="login-page"><aside class="login-aside"><div class="brand"><span class="brand-mark">ر</span><div><strong>رحلة</strong><small>التسعير والعروض</small></div></div><div><h1>كل رحلة تبدأ<br>بسعر واضح.</h1><p>عروض البرامج والخدمات، وأسعار الغرف والعمولات المعتمدة لشركتك، في مكان واحد.</p></div><div class="login-foot">مساحة عمل خاصة لكل شركة</div></aside><main class="login-main"><form id="login" class="login-form"><h2>تسجيل الدخول</h2><p>استخدم بيانات الحساب التي منحك إياها المسؤول.</p>${field('اسم المستخدم','username','','text','required autocomplete="username" dir="ltr"')}${field('كلمة المرور','password','','password','required autocomplete="current-password"')}<button class="btn primary" type="submit">دخول إلى المنظومة</button><div id="login-error" class="form-error" role="alert"></div><p style="margin-top:24px;font-size:.875rem">نسيت كلمة المرور؟ تواصل مع المسؤول لإعادة تعيينها.</p></form></main></div>`;}
function passwordFields(){return field('كلمة المرور الحالية','oldPassword','','password','required autocomplete="current-password"')+field('كلمة المرور الجديدة','password','','password','required autocomplete="new-password"')+field('تأكيد كلمة المرور الجديدة','confirmPassword','','password','required autocomplete="new-password"');}
function renderPasswordPage(){$('#app').innerHTML=`<main class="login-main" style="min-height:100vh"><form id="password" class="login-form"><h2>تغيير كلمة المرور الأولية</h2><p>اختر كلمة مرور جديدة. ستسجل الدخول بعدها بكلمتك الجديدة.</p>${passwordFields()}<button type="submit" class="btn primary">حفظ كلمة المرور</button>${btn('تسجيل الخروج','logout')}<div id="login-error" class="form-error" role="alert"></div></form></main>`;}
function icon(name){const paths={offers:'M4 4h16v16H4z M8 8h8M8 12h8M8 16h4',pricing:'M4 3h16v18H4z M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2',definitions:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',companies:'M4 21V7l8-4 8 4v14M9 21v-6h6v6M8 8h1M15 8h1M8 11h1M15 11h1',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',quotes:'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.offers}"></path></svg>`;}
function render(){
  const b=state.boot,u=b.user;let nav=[['offers',isCompany()?'عروض وخدمات شركتي':'العروض والخدمات']];
  if(isCompany())nav.push(['quotes','تسعيرات شركتي']);
  else {if(can('viewCost'))nav.push(['pricing','أداة التسعير والقوالب']);if(can('viewCost'))nav.push(['definitions','التعريفات']);if(can('manageCompanies'))nav.push(['companies','الشركات']);if(can('manageUsers'))nav.push(['users','المستخدمون والصلاحيات']);if(u.role==='admin')nav.push(['settings','الإعدادات والنسخ']);}
  if(!nav.some(n=>n[0]===state.tab))state.tab='offers';
  $('#app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">ر</span><div><strong>رحلة</strong><small>التسعير والعروض</small></div></div><nav class="nav" aria-label="القائمة الرئيسية">${nav.map(([key,label])=>`<button type="button" data-action="navigate" data-id="${key}" class="${state.tab===key?'active':''}" ${state.tab===key?'aria-current="page"':''}>${icon(key)}${label}</button>`).join('')}</nav><div class="sidebar-bottom"><strong>${esc(isCompany()?b.company.name:u.role==='admin'?'المسؤول الرئيسي':'حساب موظف')}</strong><p><small>${isCompany()?'عروضك وتسعيراتك الخاصة':'إدارة الأسعار والشركات'}</small></p>${btn('تغيير كلمة المرور','account.open','','ghost')}${btn('تسجيل الخروج','logout','','ghost')}</div></aside><div class="workspace"><header class="topbar"><div class="inline">${btn('☰','menu','','mobile-menu')}<span class="organization">${esc(b.settings.name||'رحلة')}</span></div><div class="user-chip"><span class="avatar">${esc(u.name.slice(0,1))}</span>${esc(u.name)}${btn('تحديث','refresh','','small')}</div></header><main class="main" id="content"></main></div></div>`;
  renderPage();
}
function pageHead(title,desc,buttons=''){return `<div class="page-head"><div><div class="eyebrow">${isCompany()?'مساحة الشركة':'إدارة التسعير'}</div><h1>${title}</h1><p>${desc}</p></div><div class="inline">${buttons}</div></div>`;}
function stats(items){return '<div class="stats">'+items.map(([label,n])=>`<div class="stat"><span>${label}</span><strong class="num">${fmt(n)}</strong></div>`).join('')+'</div>';}
function searchBar(kinds=false){return `<div class="toolbar"><input type="search" id="search" aria-label="البحث" placeholder="ابحث بالاسم…" value="${esc(state.filter)}">${kinds?`<select id="kind-filter" aria-label="تصفية النوع"><option value="all">كل الأنواع</option><option value="program" ${state.kind==='program'?'selected':''}>البرامج</option><option value="service" ${state.kind==='service'?'selected':''}>الخدمات</option></select>`:''}<small id="result-count"></small></div><div id="list-results"></div>`;}
function renderPage(){
  const b=state.boot;
  if(state.tab==='offers'){
    const rows=isCompany()?b.assignments:b.offers;
    $('#content').innerHTML=pageHead(isCompany()?'عروض شركتك':'العروض والخدمات',isCompany()?'أسعارك المعتمدة وعمولاتك، جاهزة لبناء تسعيرة عميلك.':'اعتمد أسعارك وحدد العرض والعمولة لكل شركة.',!isCompany()&&can('editPricing')?btn('＋ إنشاء عرض','offer.new','','primary'):'')+stats([['العروض والخدمات',rows.length],['البرامج',rows.filter(x=>x.kind==='program').length],['الخدمات',rows.filter(x=>x.kind==='service').length]])+'<div class="panel">'+searchBar(true)+'</div>';
  }else if(state.tab==='pricing')$('#content').innerHTML=pageHead('أداة التسعير والقوالب','تكلفة واضحة لكل نوع غرفة، مع الحفاظ على معادلات البرنامج.',can('editPricing')?btn('＋ تسعير جديد','pricing.new','','primary'):'')+'<div class="panel">'+searchBar(true)+'</div>';
  else if(state.tab==='quotes')$('#content').innerHTML=pageHead('تسعيرات شركتك','تكاليفك الإضافية وأرباحك محفوظة في مساحة شركتك.')+stats([['التسعيرات المحفوظة',b.quotes.length],['النشطة',b.quotes.filter(q=>!q.archived).length],['لها تحديث في المصدر',b.quotes.filter(q=>q.hasUpdate).length]])+'<div class="panel">'+searchBar()+'</div>';
  else if(state.tab==='definitions')$('#content').innerHTML=pageHead('التعريفات','أنواع الغرف والفنادق والمدن والخدمات.',can('editDefinitions')?btn('قالب Excel','import.template')+btn('استيراد Excel','import.open')+btn('＋ تعريف جديد','definition.new','','primary'):'')+'<div class="panel">'+searchBar()+'</div>';
  else if(state.tab==='companies')$('#content').innerHTML=pageHead('الشركات','حسابات مستقلة وعروض مخصصة لكل جهة.',btn('＋ إضافة شركة','company.new','','primary'))+'<div class="panel">'+searchBar()+'</div>';
  else if(state.tab==='users')$('#content').innerHTML=pageHead('المستخدمون والصلاحيات','حدد وصول كل موظف، واربط كل مستخدم بشركته.',btn('＋ إضافة مستخدم','user.new','','primary'))+'<div class="panel">'+searchBar()+'</div>';
  else if(state.tab==='settings'){renderSettings();return;}
  if($('.toolbar'))$('.toolbar').insertAdjacentHTML('beforeend',`<select id="sort-order" aria-label="ترتيب النتائج"><option value="newest">الأحدث أولاً</option><option value="name" ${state.sort==='name'?'selected':''}>الاسم أبجدياً</option></select>`);
  renderRows();
}
function filtered(rows){return rows.filter(r=>String(r.name||r.username).toLowerCase().includes(state.filter.toLowerCase())&&(state.kind==='all'||!r.kind||r.kind===state.kind)).sort((a,b)=>state.sort==='name'?String(a.name).localeCompare(String(b.name),'ar'):String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));}
function renderRows(){
  const b=state.boot;let rows=[],headers=[],cells;
  if(state.tab==='offers'){
    rows=filtered(isCompany()?b.assignments:b.offers);headers=['العرض','النوع',isCompany()?'صافي السعر يبدأ من':'سعر البيع يبدأ من','الصلاحية','الحالة','الإجراءات'];
    cells=r=>[ `<span class="table-title">${esc(r.name)}</span><small>${r.lines.length} ${r.kind==='program'?'أنواع غرف':'بند'}</small>`,badge(r.kind==='program'?'برنامج':'خدمة'),`<span class="money">${amount(Math.min(...r.lines.map(l=>isCompany()?l.netPrice:l.basePrice)),r.lines[0]?.currency)}</span>`,esc(r.validUntil||'غير محددة'),r.archived?badge('مؤرشف'):isCompany()?badge(r.expired?'منتهي':'متاح',r.expired?'danger':'ok'):badge(r.status==='approved'?'معتمد':'مسودة',r.status==='approved'?'ok':''),actions(btn('عرض','offer.view',r.id,'small')+(isCompany()?(!r.expired?btn('تسعير لعميل','quote.new',r.id,'small primary'):''):(can('editPricing')?btn('تعديل','offer.edit',r.id,'small'):'')+(can('approve')&&r.status!=='approved'&&!r.archived?btn('اعتماد','offer.approve',r.id,'small'):'')+(can('publish')&&r.status==='approved'&&!r.archived?btn('نشر / عمولة','publish.open',r.id,'small primary'):'')+(can('publish')?btn(r.archived?'استعادة':'أرشفة','offer.archive',r.id,'small'):'')))];
  }else if(state.tab==='pricing'){
    rows=filtered(b.pricings||[]);headers=['الاسم','النوع','الاستخدام','عدد البنود','الإجراءات'];cells=r=>[ `<b>${esc(r.name)}</b>`,r.kind==='program'?'برنامج':'خدمة',badge(r.isTemplate?'قالب تسعير':'تسعيرة'),r.result.results.length,actions(btn('عرض','pricing.view',r.id,'small')+(can('editPricing')?btn('تعديل','pricing.edit',r.id,'small')+btn('نسخ','pricing.copy',r.id,'small')+btn('إنشاء عرض','offer.fromPricing',r.id,'small primary'):''))];
  }else if(state.tab==='quotes'){
    rows=filtered(b.quotes);headers=['التسعيرة والعميل','الإجمالي','ربح الشركة','الحالة','الإجراءات'];cells=r=>[ `<b>${esc(r.name)}</b><br><small>${esc(r.customer)}</small>`,totalsHtml(r),totalsHtml(r,'profit'),badge(r.archived?'مؤرشفة':'محفوظة',r.archived?'':'ok')+(r.hasUpdate?' '+badge('المصدر تغير','gold'):''),actions(btn('تعديل','quote.edit',r.id,'small')+btn('نسخة العميل','quote.print',r.id,'small')+btn('Excel','quote.export',r.id,'small')+btn(r.archived?'استعادة':'أرشفة','quote.archive',r.id,'small'))];
  }else if(state.tab==='definitions'){
    rows=filtered(b.definitions||[]);headers=['الاسم','النوع','التفاصيل','الحالة','الإجراءات'];cells=r=>[ `<b>${esc(r.name)}</b>`,({room:'غرفة',city:'مدينة',hotel:'فندق',service:'خدمة'})[r.type],r.type==='room'?r.occupancy+' أشخاص'+(r.extraBeds!=null?' · '+r.extraBeds+' أسرّة إضافية':''):r.type==='service'?fmt(r.cost)+' '+esc(r.currency)+' · '+unitLabel(r.unit):r.type==='hotel'?fmt(r.rate)+' SAR / ليلة':'—',badge(r.active?'فعال':'موقوف',r.active?'ok':''),can('editDefinitions')?actions(btn('تعديل','definition.edit',r.id,'small')):'—'];
  }else if(state.tab==='companies'){
    rows=filtered(b.companies||[]);headers=['الشركة','التواصل','الحالة','الإجراءات'];cells=r=>[ `<b>${esc(r.name)}</b>`,esc(r.contact||'—'),badge(r.active?'فعالة':'موقوفة',r.active?'ok':''),actions(btn('تعديل','company.edit',r.id,'small'))];
  }else if(state.tab==='users'){
    rows=filtered(b.users||[]);headers=['الاسم والحساب','نوع الحساب','الشركة / الصلاحيات','الحالة','الإجراءات'];cells=r=>[ `<b>${esc(r.name)}</b><br><span class="num">${esc(r.username)}</span>`,({admin:'مسؤول',employee:'موظف',company:'شركة'})[r.role],esc(r.role==='company'?(b.companies||[]).find(c=>c.id===r.companyId)?.name||'—':r.role==='admin'?'كل صلاحيات الإدارة':(r.permissions||[]).map(p=>labels[p]).join('، ')||'عرض الأسعار فقط'),badge(r.active?'فعال':'موقوف',r.active?'ok':''),actions(btn('تعديل / كلمة المرور','user.edit',r.id,'small'))];
  }
  if($('#result-count'))$('#result-count').textContent=rows.length+' نتيجة';
  $('#list-results').innerHTML=rows.length?table(headers,rows.map(r=>tr(cells(r)))):'<div class="empty"><strong>لا توجد بيانات مطابقة</strong>ابدأ بإضافة البيانات أو غيّر البحث.</div>';
}
function openDefinition(row={type:'room',active:true,occupancy:1}){
  const body=`<form id="definition-form"><div class="grid">${select('نوع التعريف','type',[['room','نوع غرفة'],['city','مدينة'],['hotel','فندق'],['service','خدمة']],row.type)}${field('الاسم','name',row.name||'','text','required maxlength="200"')}<div id="definition-fields" class="full"></div>${check('فعال','active',row.active!==false)}</div>${footer()}</form>`;
  dialog(row.id?'تعديل التعريف':'تعريف جديد',body,{type:'definition',row});definitionFields(row);
  if(row.id)$('[name=type]').disabled=true;
}
function definitionFields(row={}){
  const type=$('[name=type]').value;
  $('#definition-fields').innerHTML='<div class="grid">'+(type==='room'?num('عدد الأشخاص لتسعير البرنامج','occupancy',row.occupancy||1,'min="1" max="20" step="1" required')+num('الأسرّة الإضافية (فارغ = القاعدة الحالية)','extraBeds',row.extraBeds??'','max="20" step="1"'):type==='service'?num('تكلفة وحدة الخدمة','cost',row.cost||0)+select('عملة التكلفة','currency',currencyOptions,row.currency||'LYD')+select('عملة البيع الافتراضية','saleCurrency',currencyOptions,row.saleCurrency||'LYD')+select('وحدة بيع الخدمة','unit',[['item','الخدمة كاملة'],['roomNight','الغرفة / الليلة']],row.unit||'item'):type==='hotel'?select('المدينة','cityId',[['','بدون تحديد'],...state.boot.definitions.filter(d=>d.type==='city').map(d=>[d.id,d.name])],row.cityId)+num('تكلفة الغرفة / الليلة بالريال','rate',row.rate||0):'')+'</div>';
}
function openCompany(row={active:true}){dialog(row.id?'تعديل الشركة':'إضافة شركة',`<form id="company-form"><div class="grid">${field('اسم الشركة','name',row.name||'','text','required maxlength="200"')}${field('بيانات التواصل','contact',row.contact||'')}${check('الشركة فعالة','active',row.active!==false)}</div><div class="hint section">إيقاف الشركة يمنع دخول جميع حساباتها، مع الاحتفاظ بعروضها وتسعيراتها.</div>${footer()}</form>`,{type:'company',row});}
function openUser(row={role:'company',active:true,permissions:[]}){
  const admin=state.boot.user.role==='admin',roles=admin?[['company','مستخدم شركة'],['employee','موظف']]:[['company','مستخدم شركة']];if(row.role==='admin')roles.push(['admin','المسؤول الرئيسي']);
  dialog(row.id?'تعديل الحساب':'إضافة حساب',`<form id="user-form"><div class="grid">${field('الاسم','name',row.name||'','text','required')}${field('اسم المستخدم','username',row.username||'','text','required dir="ltr" pattern="[a-zA-Z0-9._-]{3,80}" autocomplete="off"')}${select('نوع الحساب','role',roles,row.role)}${select('الشركة','companyId',[['','اختر الشركة'],...(state.boot.companies||[]).map(c=>[c.id,c.name])],row.companyId)}${field(row.id?'كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)':'كلمة المرور الأولية','password','','password',(row.id?'':'required ')+'autocomplete="new-password"')}${check('الحساب فعال','active',row.active!==false)}<div class="full" id="employee-permissions"><h3>صلاحيات الموظف</h3><div class="check-group">${Object.entries(labels).map(([p,l])=>check(l,'permission',row.permissions?.includes(p),p)).join('')}</div><small>إعداد التسعير والتعريفات المالية يحتاج رؤية التكلفة. إدارة الحسابات للموظف تخص مستخدمي الشركات فقط.</small></div></div><div class="hint section">إنشاء كلمة مرور أو إعادة تعيينها يطلب من المستخدم تغييرها عند دخوله. تعديل الحساب ينهي جلساته السابقة.</div>${footer()}</form>`,{type:'user',row});userFields();
}
function userFields(){const role=$('[name=role]').value;$('#employee-permissions').hidden=role!=='employee';$('[name=companyId]').disabled=role!=='company';$('[name=companyId]').required=role==='company';}
const pricingDefaults=()=>({kind:'program',input:{makkahNights:10,makkahRate:0,madinahNights:3,madinahRate:0,includeMadinah:false,extraBed:0,visaUsd:0,ticketLyd:0,transportLyd:0,otherLyd:0,profitType:'percent',profitValue:15,rounding:5,sarPerUsd:state.boot.settings.sarPerUsd||3.72,usdToLyd:state.boot.settings.usdToLyd||4.85},roomIds:state.boot.definitions.filter(d=>d.type==='room'&&d.active).map(d=>d.id)});
function openPricing(row){
  row=row||pricingDefaults();const p=row.input||{},defs=[...new Map([...state.boot.definitions,...(row.definitionsSnapshot||[])].map(d=>[d.id,d])).values()],rooms=defs.filter(d=>d.type==='room'&&d.active),services=defs.filter(d=>d.type==='service'&&d.active),hotels=[['','اختر الفندق'],...defs.filter(d=>d.type==='hotel'&&d.active).map(d=>[d.id,d.name])];
  dialog(row.id?'تعديل التسعير':'تسعير جديد',`<form id="pricing-form"><div class="grid">${field('اسم التسعير','name',row.name||'','text','required maxlength="200"')}${select('نوع التسعير','kind',[['program','برنامج — سعر للفرد حسب الغرفة'],['service','خدمة مستقلة — سعر الوحدة كاملة']],row.kind)}</div><div id="program-inputs" class="section"><div class="grid four">${select('فندق مكة','makkahHotelId',hotels,p.makkahHotelId)}${num('الغرفة / الليلة — مكة (SAR)','makkahRate',p.makkahRate)}${num('ليالي مكة','makkahNights',p.makkahNights,'step="1" max="365"')}${num('السرير الإضافي / الليلة (SAR)','extraBed',p.extraBed)}</div><div class="check-group">${check('إضافة الإقامة في المدينة','includeMadinah',p.includeMadinah)}</div><div class="grid three" id="madinah-inputs">${select('فندق المدينة','madinahHotelId',hotels,p.madinahHotelId)}${num('الغرفة / الليلة — المدينة (SAR)','madinahRate',p.madinahRate)}${num('ليالي المدينة','madinahNights',p.madinahNights,'step="1" max="365"')}</div><div class="divider"></div><div class="grid four">${num('التأشيرة للفرد (USD)','visaUsd',p.visaUsd)}${num('التذكرة للفرد (LYD)','ticketLyd',p.ticketLyd)}${num('النقل للفرد (LYD)','transportLyd',p.transportLyd)}${num('تكاليف أخرى للفرد (LYD)','otherLyd',p.otherLyd)}</div><div class="section"><h3>خدمات داخلة في تكلفة الفرد بالبرنامج</h3><div class="check-group">${services.map(s=>check(s.name,'serviceIds',p.serviceIds?.includes(s.id),s.id)).join('')||'<small>يمكن تعريف الخدمات من تبويب التعريفات.</small>'}</div></div><div class="section"><h3>أنواع الغرف والأسعار الخاصة</h3><small>اترك السعر فارغاً لاستخدام التكلفة العامة أو سعر البيع المحسوب. أسعار البرنامج بالدينار للفرد. الخدمات المستقلة لها عملة بيع تختارها.</small>${table(['استخدام','الغرفة','مكة SAR / ليلة','المدينة SAR / ليلة','بيع خاص للفرد LYD'],rooms.map(r=>tr([check('', 'roomIds',(row.roomIds||[]).includes(r.id),r.id),esc(r.name)+' · '+r.occupancy,`<input aria-label="تكلفة مكة ${esc(r.name)}" data-room="${esc(r.id)}" data-field="makkahRate" type="number" min="0" step="0.001" value="${esc(p.roomOverrides?.[r.id]?.makkahRate??'')}">`,`<input aria-label="تكلفة المدينة ${esc(r.name)}" data-room="${esc(r.id)}" data-field="madinahRate" type="number" min="0" step="0.001" value="${esc(p.roomOverrides?.[r.id]?.madinahRate??'')}">`,`<input aria-label="بيع ${esc(r.name)}" data-room="${esc(r.id)}" data-field="sell" type="number" min="0" step="0.001" value="${esc(p.roomOverrides?.[r.id]?.sell??'')}">`])) )}</div></div><div id="service-inputs" class="section"><div class="grid">${select('الخدمة','serviceId',[['','اختر الخدمة'],...services.map(s=>[s.id,s.name+' — '+unitLabel(s.unit)+' · تكلفة '+s.currency])],row.serviceId)}${num('تكلفة الوحدة بعملة تعريف الخدمة (فارغ = التعريف)','cost',p.cost??'')}${select('عملة بيع الخدمة','saleCurrency',currencyOptions,p.saleCurrency||services.find(s=>s.id===row.serviceId)?.saleCurrency||'LYD')}${num('بيع خاص للوحدة بعملة البيع (اختياري)','sell',p.sell??'')}</div><div class="hint section">الغرفة / الليلة تباع كوحدة كاملة. إجماليها في تسعيرة الشركة = السعر × الغرف × الليالي، دون قسمة على الأشخاص.</div></div><div class="divider"></div><div class="grid four">${num('الدولار الواحد بالريال','sarPerUsd',p.sarPerUsd,'min="0.0001" step="0.0001" required')}${num('الدولار الواحد بالدينار','usdToLyd',p.usdToLyd,'min="0.0001" step="0.0001" required')}${select('طريقة الربح','profitType',[['percent','نسبة من التكلفة %'],['fixed','مبلغ ثابت للوحدة']],p.profitType)}${num('قيمة الربح','profitValue',p.profitValue)}${select('التقريب لأعلى','rounding',[[0,'دون تقريب'],[1,'1 من عملة البيع'],[5,'5 من عملة البيع'],[10,'10 من عملة البيع'],[50,'50 من عملة البيع']],p.rounding)}</div><div class="check-group">${check('حفظ كقالب قابل لإعادة الاستخدام','isTemplate',row.isTemplate)}${row.id?check('تحديث التعريفات إلى أحدث أسعارها عند الحفظ','refreshDefinitions',false):''}</div>${textarea('ملاحظات داخلية','notes',row.notes)}<div class="section inline">${btn('احسب الأسعار','pricing.calculate','','primary')}<small><span id="sale-currency-hint">أسعار البرنامج بالدينار الليبي</span></small></div><div id="pricing-result" class="result"></div>${footer('حفظ التسعير')}</form>`,{type:'pricing',row});pricingFields();if(row.result)showPricingResult(row.result);
}
function pricingFields(){const program=$('[name=kind]').value==='program';$('#program-inputs').hidden=!program;$('#service-inputs').hidden=program;$('#madinah-inputs').hidden=!$('[name=includeMadinah]').checked;$('#sale-currency-hint').textContent=program?'أسعار البرنامج بالدينار الليبي':'عملة بيع الخدمة والربح الثابت: '+currencyLabel($('[name=saleCurrency]').value);}
function collectPricing(){
  const f=$('#pricing-form'),v=Object.fromEntries(new FormData(f)),row=state.editor.row,input={};
  for(const k of ['makkahRate','makkahNights','madinahRate','madinahNights','extraBed','visaUsd','ticketLyd','transportLyd','otherLyd','sarPerUsd','usdToLyd','profitValue','rounding'])input[k]=Number(v[k]);
  Object.assign(input,{includeMadinah:!!v.includeMadinah,profitType:v.profitType,makkahHotelId:v.makkahHotelId,madinahHotelId:v.madinahHotelId,cost:v.cost,sell:v.sell,saleCurrency:v.saleCurrency,serviceIds:new FormData(f).getAll('serviceIds'),roomOverrides:{}});
  $$('[data-room]').forEach(el=>{input.roomOverrides[el.dataset.room]||={};input.roomOverrides[el.dataset.room][el.dataset.field]=el.value;});
  return {id:row.id,version:row.version,sourcePricingId:row.sourcePricingId,sourcePricingVersion:row.sourcePricingVersion,name:v.name,kind:v.kind,input,roomIds:new FormData(f).getAll('roomIds'),serviceId:v.serviceId,isTemplate:!!v.isTemplate,notes:v.notes,refreshDefinitions:!!v.refreshDefinitions};
}
function showPricingResult(result){$('#pricing-result').innerHTML=table(['الغرفة / الخدمة','تكلفة الوحدة','الربح الفعلي','سعر البيع'],result.results.map(l=>tr([esc(l.label)+'<br><small>'+unitLabel(l.unit)+'</small>',amount(l.baseCost,l.currency),amount(l.profit,l.currency),'<span class="money">'+amount(l.sell,l.currency)+'</span>'])));}
function openOffer(row={},pricingId){
  const pricings=state.boot.pricings||[];
  dialog(row.id?'تعديل العرض':'إنشاء عرض',`<form id="offer-form"><div class="grid">${field('اسم العرض','name',row.name||'','text','required maxlength="200"')}${select('مصدر الأسعار المحفوظ','pricingId',[['','اختر التسعير'],...pricings.map(p=>[p.id,p.name])],pricingId||row.pricingId)}${field('صالح حتى (اختياري)','validUntil',row.validUntil||'','date')}${textarea('تفاصيل العرض وشروطه للشركة','description',row.description)}</div><div class="hint section">يحفظ العرض نسخة من أسعار المصدر. التعديل يعيده إلى مسودة للاعتماد، وتظل النسخة المنشورة سابقاً للشركات كما هي حتى تعيد النشر.</div>${footer('حفظ المسودة')}</form>`,{type:'offer',row});
}
function offerView(id){
  const r=(isCompany()?state.boot.assignments:state.boot.offers).find(x=>x.id===id);
  dialog(r.name,`<div class="preview"><p>${esc(r.description)}</p><p class="muted">الصلاحية: ${esc(r.validUntil||'غير محددة')}</p>${table(isCompany()?['الغرفة / الخدمة','الأساسي','العمولة الممنوحة','الصافي لشركتكم']:['الغرفة / الخدمة','سعر البيع'],r.lines.map(l=>tr([esc(l.label)+'<br><small>'+unitLabel(l.unit)+'</small>',amount(l.basePrice,l.currency),...(isCompany()?[amount(l.commission,l.currency),'<span class="money">'+amount(l.netPrice,l.currency)+'</span>']:[])])))}${isCompany()?'<div class="hint section">العمولة ظاهرة ومخصومة مرة واحدة. صافي السعر هو أساس تسعيرتك لعميلك.</div>':''}<div class="form-actions">${isCompany()||can('export')?btn('طباعة / حفظ PDF','offer.print',id)+btn('تصدير Excel','offer.export',id):''}${isCompany()&&!r.expired?btn('إنشاء تسعيرة لعميل','quote.new',id,'primary'):''}</div></div>`);
}
function openPublish(id){
  const offer=state.boot.offers.find(o=>o.id===id),companies=(state.boot.companies||[]).filter(c=>c.active);
  dialog('نشر العرض وتخصيص العمولة',`<form id="publish-form"><h3>${esc(offer.name)} — ${esc(currencyLabel(offer.lines[0]?.currency))}</h3><div class="hint section">حدد الشركات المستفيدة. العمولة هنا لكل شخص في البرنامج، أو لكل وحدة للخدمة. يمكنك تعديل عمولة كل بند للشركة.</div><div class="toolbar section">${num('عمولة موحدة','bulkCommission',0)}${btn('تطبيق على المحدد','publish.bulk')}${check('يشمل الاستثناءات الخاصة','replaceSpecial',false)}</div><div class="check-group">${check('تحديد جميع الشركات','selectAll',false)}</div>${table(['اختيار','الشركة','العمولة العامة','استثناء خاص','عمولات البنود'],companies.map(c=>{const a=(state.boot.assignments||[]).find(x=>x.offerId===id&&x.companyId===c.id);return tr([check('', 'companySelected',!!a?.active,c.id),'<b>'+esc(c.name)+'</b>',`<input type="number" min="0" step="0.001" aria-label="عمولة ${esc(c.name)}" data-commission="${esc(c.id)}" value="${a?.commission||0}">`,check('خاص','special',a?.special,c.id),`<details><summary>تفصيل ${offer.lines.length} بنود</summary>${offer.lines.map(l=>num(esc(l.label)+' — '+unitLabel(l.unit),'lineCommission',a?.lines.find(x=>x.key===l.key)?.commission??'','data-company="'+esc(c.id)+'" data-line="'+esc(l.key)+'"')).join('')}</details>`]);}))}<div class="hint section">إزالة اختيار شركة منشور لها العرض ستوقف ظهوره لها بعد مراجعة النشر. لن تُحذف تسعيراتها السابقة.</div><div id="publish-review" class="section"></div>${footer('مراجعة قبل النشر')}</form>`,{type:'publish',row:offer});
}
function collectPublish(){const o=state.editor.row;return {offerId:o.id,offerVersion:o.version,companies:(state.boot.companies||[]).filter(c=>c.active).flatMap(c=>{
  const a=(state.boot.assignments||[]).find(x=>x.offerId===o.id&&x.companyId===c.id),selected=$$('input[name=companySelected]:checked').some(e=>e.value===c.id);if(!a&&!selected)return [];
  const lineCommissions={};$$('[data-company]').filter(e=>e.dataset.company===c.id).forEach(e=>{if(e.value!=='')lineCommissions[e.dataset.line]=Number(e.value);});
  return [{companyId:c.id,version:a?.version||0,active:selected,commission:Number($$('[data-commission]').find(e=>e.dataset.commission===c.id).value),special:$$('input[name=special]:checked').some(e=>e.value===c.id),lineCommissions}];})};}
function applyBulk(){const value=$('[name=bulkCommission]').value,replace=$('[name=replaceSpecial]').checked;$$('input[name=companySelected]:checked').forEach(el=>{const special=$$('input[name=special]:checked').some(x=>x.value===el.value);if(special&&!replace)return;$$('[data-commission]').find(x=>x.dataset.commission===el.value).value=value;$$('[data-company]').filter(x=>x.dataset.company===el.value).forEach(x=>x.value='');});invalidateReview();toast('تم تطبيق العمولة على الشركات المحددة مع مراعاة الاستثناءات.');}
function newQuoteLine(assignment,key){const l=assignment.lines.find(l=>l.key===key)||assignment.lines[0];return {id:'',assignmentId:assignment.id,key:l.key,source:{...l,assignmentId:assignment.id,assignmentVersion:assignment.version,offerName:assignment.name,validUntil:assignment.validUntil},quantity:1,nights:1,extras:[],mode:'margin',marginType:'fixed',marginValue:0,sellUnit:l.netPrice};}
function openQuote(row,assignmentId){
  const assignments=state.boot.assignments.filter(a=>!a.expired),initial=assignmentId?state.boot.assignments.find(a=>a.id===assignmentId):null;
  const lines=row?structuredClone(row.lines):initial?[newQuoteLine(initial)]:[];
  dialog(row?'تعديل تسعيرة الشركة':'تسعيرة لعميلك',`<form id="quote-form"><div class="grid">${field('اسم التسعيرة','name',row?.name||initial?.name||'','text','required maxlength="200"')}${field('اسم العميل','customer',row?.customer||'')}${field('صلاحية التسعيرة (اختياري)','validUntil',row?.validUntil||'','date')}</div><div class="hint section">إضافاتك وهامش ربحك خاصة بشركتك. نسخة العميل تعرض أسعار البيع النهائية.</div><div id="quote-lines" class="section"></div><div class="toolbar">${select('إضافة غرفة أو خدمة من عروضك','newSource',[['','اختر البند'],...assignments.flatMap(a=>a.lines.map(l=>[a.id+'|'+l.key,a.name+' — '+l.label+' · '+fmt(l.netPrice)+' '+currencyLabel(l.currency)]))],'')}${btn('إضافة البند','quote.add')}</div><div class="check-group">${row?check('تحديث أسعار المصدر إلى أحدث عرض مع مراجعة الفرق','refreshSources',false):''}</div>${textarea('ملاحظات تظهر للعميل','notes',row?.notes||'')}<div id="quote-total" class="section"></div><div id="quote-review" class="section"></div>${footer('مراجعة وحساب التسعيرة')}</form>`,{type:'quote',row:row||{},lines});renderQuoteLines();
}
function renderQuoteLines(){
  $('#quote-lines').innerHTML=state.editor.lines.map((l,i)=>`<section class="line-editor" data-index="${i}"><div class="split"><div><h3>${esc(l.source.offerName)} — ${esc(l.source.label)}</h3><div class="source-price">صافي الشراء ${amount(l.source.netPrice,l.source.currency)} ${unitLabel(l.source.unit)}</div></div>${btn('حذف البند','quote.remove',String(i),'small danger')}</div><div class="grid four">${num(l.source.unit==='person'?'عدد الأشخاص':l.source.unit==='roomNight'?'عدد الغرف':'عدد الخدمات','quantity',l.quantity,'min="1" max="10000" step="1" required')}${l.source.unit==='roomNight'?num('عدد الليالي','nights',l.nights,'min="1" max="365" step="1" required'):''}${select('طريقة سعر البيع','mode',[['margin','حساب التكلفة مع الربح'],['manual','إدخال سعر البيع النهائي']],l.mode)}${select('طريقة الربح','marginType',[['fixed','مبلغ ربح لكل وحدة'],['percent','نسبة من التكلفة %']],l.marginType)}${num('قيمة الربح','marginValue',l.marginValue)}${num('سعر البيع النهائي للوحدة','sellUnit',l.sellUnit,'required')}</div><div class="section"><div class="section-title"><h3>تكاليف إضافية لإجمالي هذا البند (${esc(currencyLabel(l.source.currency))})</h3>${btn('＋ تكلفة','quote.extra',String(i),'small')}</div><div class="extras">${l.extras.map((e,j)=>extraFields(e,j,l,i)).join('')}</div></div><div class="line-summary section"></div></section>`).join('');updateQuoteTotals();
}
function readQuoteLines(){return $$('.line-editor').map(el=>{const prior=state.editor.lines[Number(el.dataset.index)],v=name=>el.querySelector('[name="'+name+'"]')?.value;return {...prior,quantity:Number(v('quantity')),nights:Number(v('nights')||1),mode:v('mode'),marginType:v('marginType'),marginValue:Number(v('marginValue')),sellUnit:Number(v('sellUnit')),extras:[...el.querySelectorAll('.extra-row')].map(r=>({label:r.querySelector('[data-extra=label]').value,amount:Number(r.querySelector('[data-extra=amount]').value),currency:r.querySelector('[data-extra=currency]').value,rate:Number(r.querySelector('[data-extra=rate]').value)}))};});}
function updateQuoteTotals(){
  if(!$('#quote-form'))return;
  const lines=readQuoteLines(),calculated=[];
  lines.forEach((l,i)=>{const el=$$('.line-editor')[i];el.querySelector('[name=sellUnit]').disabled=l.mode!=='manual';el.querySelector('[name=marginValue]').disabled=l.mode==='manual';el.querySelector('[name=marginType]').disabled=l.mode==='manual';try{const value=quoteLine(l.source,l);calculated.push(value);el.querySelector('.line-summary').innerHTML=`<div class="split"><small>الشراء ${amount(value.purchase,value.currency)} · الإضافات ${amount(value.extraTotal,value.currency)} · الربح ${amount(value.profit,value.currency)}</small><strong>${amount(value.total,value.currency)}</strong></div>${value.belowCost?'<div class="hint warn section">سعر البيع أقل من التكلفة لهذا البند.</div>':''}`;}catch(e){el.querySelector('.line-summary').textContent=e.message;}});
  $('#quote-total').innerHTML=totalsByCurrency(calculated).map(t=>`<div class="total-card"><div><small>إجمالي ${esc(currencyLabel(t.currency))}</small><p>الربح المتوقع ${amount(t.profit,t.currency)}</p></div><strong>${amount(t.total,t.currency)}</strong></div>`).join('');
}
function collectQuote(){const v=Object.fromEntries(new FormData($('#quote-form')));return {id:state.editor.row.id,version:state.editor.row.version,name:v.name,customer:v.customer,validUntil:v.validUntil,notes:v.notes,refreshSources:!!v.refreshSources,lines:readQuoteLines()};}
function invalidateReview(){state.pending=null;if($('#publish-review'))$('#publish-review').innerHTML='';if($('#quote-review'))$('#quote-review').innerHTML='';}
function renderSettings(){const s=state.boot.settings;$('#content').innerHTML=pageHead('الإعدادات والنسخ الاحتياطية','بيانات المنشأة وأسعار الصرف الافتراضية وسجل الإدارة.')+`<div class="panel panel-pad"><form id="settings-form"><div class="grid three">${field('اسم المنشأة','name',s.name,'text','required')}${num('الدولار الواحد بالريال','sarPerUsd',s.sarPerUsd,'min="0.0001" step="0.0001" required')}${num('الدولار الواحد بالدينار','usdToLyd',s.usdToLyd,'min="0.0001" step="0.0001" required')}</div><div class="form-actions"><button type="submit" class="btn primary">حفظ الإعدادات</button></div></form></div><div class="panel panel-pad section"><div class="split"><div><h2>نسخة احتياطية خاصة</h2><p class="muted">نسخة يومية بعد الإعداد، ويمكنك إنشاء نسخة إضافية الآن.</p></div>${btn('إنشاء نسخة الآن','backup.create','','primary')}</div><div class="hint section">النسخ محفوظة في مجلدك الخاص على Drive. الاستعادة تُنشئ نسخة منفصلة للفحص قبل تبديل قاعدة العمل؛ الخطوات في دليل الإعداد.</div><div id="backup-result" class="section"></div></div><div class="panel section"><div class="toolbar"><h3>آخر إجراءات الإدارة</h3></div>${table(['التاريخ','المستخدم','الإجراء'],(state.boot.audit||[]).map(a=>tr([esc(a.at.replace('T',' ').slice(0,19)),esc(a.actorName),esc(actionLabel(a.action))])))}</div>`;}
function actionLabel(a){return ({'definition.save':'حفظ تعريف','definition.import':'استيراد تعريفات','company.save':'تعديل شركة','user.save':'تعديل حساب','pricing.save':'حفظ تسعير','offer.save':'حفظ عرض','offer.approve':'اعتماد عرض','offer.archive':'أرشفة عرض','publish.commit':'نشر أسعار وعمولات','settings.save':'تعديل الإعدادات','account.password':'تغيير كلمة المرور'})[a]||a;}
function exportMarkup(r){
  const quote=r.kind==='quote';
  return `<h1>${esc(r.company||state.boot.settings.name)}</h1><h2>${esc(r.name)}</h2><div class="print-meta"><p>${quote?'العميل: '+esc(r.customer||'—'):''}</p><p>الصلاحية: ${esc(r.validUntil||'غير محددة')}</p><p class="break-text">${esc(r.description||'')}</p></div>${table(quote?['البند','العدد','الليالي','بيع الوحدة','الإجمالي']:['الغرفة / الخدمة','الوحدة','السعر الأساسي',...(r.lines.some(l=>l.netPrice!=null)?['العمولة الممنوحة','الصافي لشركتكم']:[])],r.lines.map(l=>tr(quote?[esc(l.offerName)+' — '+esc(l.label),l.quantity,l.nights,amount(l.sellUnit,l.currency),amount(l.total,l.currency)]:[esc(l.label),unitLabel(l.unit),amount(l.basePrice,l.currency),...(l.netPrice!=null?[amount(l.commission,l.currency),amount(l.netPrice,l.currency)]:[])])))}${quote?'<div class="print-total">إجمالي عرض السعر: '+totalsHtml(r)+'</div>':''}<p class="break-text section">${esc(r.notes||'')}</p>`;
}
async function printRecord(kind,id){const r=await call('export.'+kind,{id});$('#print-root').innerHTML=exportMarkup(r);dialog('معاينة نسخة '+(kind==='quote'?'العميل':'العرض'),'<div class="preview">'+exportMarkup(r)+'</div><div class="form-actions">'+btn('طباعة / حفظ PDF','print.current','','primary')+'</div>');}
async function downloadWorkbook(name,headers,rows,sheetName='البيانات'){
  const wb=new ExcelJS.Workbook();wb.creator='RIHLA';const sheet=wb.addWorksheet(sheetName,{views:[{rightToLeft:true}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9}});
  sheet.addRow(headers);rows.forEach(r=>sheet.addRow(r));sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF142A43'}};sheet.getRow(1).height=30;
  sheet.columns.forEach(c=>c.width=25);sheet.eachRow(row=>{row.alignment={vertical:'middle',wrapText:true,readingOrder:'rtl'};row.eachCell(cell=>{cell.border={bottom:{style:'thin',color:{argb:'FFDCE4EB'}}};if(typeof cell.value==='number')cell.numFmt='#,##0.000';});});sheet.pageSetup.printTitlesRow='1:1';
  const blob=new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),filename=name.replace(/[<>:"/\\|?*]/g,'_')+'.xlsx';
  if(downloadWorkbook.previousUrl)URL.revokeObjectURL(downloadWorkbook.previousUrl);downloadWorkbook.previousUrl=url;
  dialog('ملف Excel جاهز',`<p>${esc(filename)}</p><div class="form-actions"><a class="btn primary" id="excel-download" href="${url}" download="${esc(filename)}">تنزيل ملف Excel</a></div>`);
}
async function exportRecord(kind,id){const r=await call('export.'+kind,{id}),sheet=exportSheet(r);await downloadWorkbook(r.name,sheet.headers,sheet.rows);}
const importHeaders=['type','name','occupancy','extraBeds','cityId','rate','cost','currency','saleCurrency','unit','active'];
async function importTemplate(){await downloadWorkbook('RIHLA_Definitions_Template',importHeaders,[],'Definitions');toast('القيم المتاحة للنوع: room أو city أو hotel أو service. راجع دليل الاستيراد قبل التعبئة.');}
function openImport(){dialog('استيراد التعريفات من Excel',`<form id="import-form"><div class="hint">استخدم القالب المحدد دون تغيير أسماء الأعمدة. الاستيراد يضيف تعريفات جديدة، ويمنع تكرار النوع والاسم. الحد 200 صف في الدفعة.</div><label class="section">ملف Excel<input name="file" type="file" accept=".xlsx" required></label><div id="import-review" class="section"></div>${footer('قراءة ومراجعة الملف')}</form>`,{type:'import'});}
async function readImport(file){
  if(file.size>2*1024*1024)throw Error('الملف أكبر من 2 ميجابايت');const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());const sheet=wb.getWorksheet('Definitions');if(!sheet)throw Error('ورقة Definitions غير موجودة');
  if(importHeaders.some((h,i)=>sheet.getRow(1).getCell(i+1).value!==h))throw Error('أسماء الأعمدة لا تطابق القالب');if(sheet.rowCount>201)throw Error('الحد 200 صف');
  const rows=[];sheet.eachRow((r,index)=>{if(index===1)return;const row={};importHeaders.forEach((h,i)=>{const value=r.getCell(i+1).value;if(value&&typeof value==='object')throw Error('الملف يجب أن يحتوي قيماً مباشرة دون صيغ أو روابط');row[h]=value??'';});if(!row.name&&!row.type)return;row.active=![false,0,'false','0'].includes(row.active);rows.push(row);});
  if(!rows.length)throw Error('الملف لا يحتوي بيانات');return rows;
}
async function onAction(action,id,element){
  const b=state.boot;
  switch(action){
    case 'dialog.close':closeDialog();break;
    case 'menu':$('.sidebar').classList.toggle('open');break;
    case 'navigate':state.tab=id;state.filter='';state.kind='all';render();break;
    case 'refresh':await reload();toast('تم تحديث البيانات');break;
    case 'logout':await call('logout');setToken('');closeDialog();$('#print-root').innerHTML='';renderLogin();break;
    case 'account.open':dialog('تغيير كلمة المرور',`<form id="password"><div class="grid">${passwordFields()}</div>${footer('تغيير كلمة المرور')}</form>`);break;
    case 'definition.new':openDefinition();break;
    case 'definition.edit':openDefinition(b.definitions.find(x=>x.id===id));break;
    case 'company.new':openCompany();break;
    case 'company.edit':openCompany(b.companies.find(x=>x.id===id));break;
    case 'user.new':openUser();break;
    case 'user.edit':openUser(b.users.find(x=>x.id===id));break;
    case 'pricing.new':openPricing();break;
    case 'pricing.edit':openPricing(b.pricings.find(x=>x.id===id));break;
    case 'pricing.copy':{const row=structuredClone(b.pricings.find(x=>x.id===id));row.sourcePricingId=row.id;row.sourcePricingVersion=row.version;delete row.id;delete row.version;row.name+=' — نسخة';openPricing(row);break;}
    case 'pricing.view':{const row=b.pricings.find(x=>x.id===id);dialog(row.name,'<div id="pricing-result"></div><p class="break-text section">'+esc(row.notes)+'</p>');showPricingResult(row.result);break;}
    case 'pricing.calculate':{const result=await call('pricing.calculate',collectPricing());showPricingResult(result.result);break;}
    case 'offer.new':openOffer();break;
    case 'offer.fromPricing':openOffer({},id);break;
    case 'offer.edit':openOffer(b.offers.find(x=>x.id===id));break;
    case 'offer.view':offerView(id);break;
    case 'offer.approve':{const r=b.offers.find(x=>x.id===id);dialog('اعتماد أسعار العرض',`<p>اعتماد «${esc(r.name)}» بأسعار البيع التالية:</p>${table(['البند','سعر البيع'],r.lines.map(l=>tr([esc(l.label),amount(l.basePrice,l.currency)])))}<div class="form-actions">${btn('اعتماد الأسعار','offer.approveConfirm',id,'primary')}</div>`,{type:'approve',row:r});break;}
    case 'offer.approveConfirm':await call('offer.approve',{id,version:state.editor.row.version});await saved('تم اعتماد العرض');break;
    case 'offer.archive':{const r=b.offers.find(x=>x.id===id);dialog(r.archived?'استعادة العرض':'أرشفة العرض',`<p>${r.archived?'سيعود العرض للظهور حسب تخصيصاته السابقة.':'سيتوقف ظهور العرض للشركات، وتبقى التسعيرات السابقة محفوظة.'}</p><div class="form-actions">${btn('تأكيد','offer.archiveConfirm',id,'primary')}</div>`,{type:'archive',row:r});break;}
    case 'offer.archiveConfirm':await call('offer.archive',{id,version:state.editor.row.version,archived:!state.editor.row.archived});await saved('تم تحديث حالة العرض');break;
    case 'publish.open':openPublish(id);break;
    case 'publish.bulk':applyBulk();break;
    case 'publish.commit':if(!state.pending)throw Error('راجع النشر أولاً');await call('publish.commit',state.pending);await saved('تم نشر الأسعار والعمولات للشركات المحددة');break;
    case 'quote.new':openQuote(null,id);break;
    case 'quote.edit':openQuote(b.quotes.find(x=>x.id===id));break;
    case 'quote.add':{const [assignmentId,key]=$('[name=newSource]').value.split('|');if(!assignmentId)throw Error('اختر البند');state.editor.lines=readQuoteLines();state.editor.lines.push(newQuoteLine(b.assignments.find(a=>a.id===assignmentId),key));renderQuoteLines();invalidateReview();break;}
    case 'quote.remove':state.editor.lines=readQuoteLines();state.editor.lines.splice(Number(id),1);renderQuoteLines();invalidateReview();break;
    case 'quote.extra':state.editor.lines=readQuoteLines();state.editor.lines[Number(id)].extras.push({label:'',amount:0});renderQuoteLines();invalidateReview();break;
    case 'quote.extraRemove':{const [i,j]=id.split(':').map(Number);state.editor.lines=readQuoteLines();state.editor.lines[i].extras.splice(j,1);renderQuoteLines();invalidateReview();break;}
    case 'quote.commit':if(!state.pending)throw Error('راجع التسعيرة أولاً');await call('quote.save',state.pending);await saved('تم حفظ التسعيرة الخاصة بشركتك');break;
    case 'quote.archive':{const r=b.quotes.find(x=>x.id===id);await call('quote.archive',{id,version:r.version,archived:!r.archived});await reload();toast('تم تحديث حالة التسعيرة');break;}
    case 'offer.print':await printRecord('offer',id);break;
    case 'quote.print':await printRecord('quote',id);break;
    case 'offer.export':await exportRecord('offer',id);break;
    case 'quote.export':await exportRecord('quote',id);break;
    case 'print.current':window.print();break;
    case 'import.template':await importTemplate();break;
    case 'import.open':openImport();break;
    case 'import.commit':if(!state.pending)throw Error('راجع الملف أولاً');await call('definition.import',{rows:state.pending});await saved('تم استيراد التعريفات');break;
    case 'backup.create':{const result=await call('backup.create');$('#backup-result').textContent='تم إنشاء النسخة: '+result.name;break;}
  }
}
async function saved(message){closeDialog();await reload();toast(message);}
async function onSubmit(form){
  const data=new FormData(form),v=Object.fromEntries(data),row=state.editor?.row||{};
  switch(form.id){
    case 'login':{const result=await call('login',v);setToken(result.token);await reload();break;}
    case 'password':if(v.password!==v.confirmPassword)throw Error('كلمتا المرور غير متطابقتين');await call('account.password',{oldPassword:v.oldPassword,password:v.password});setToken('');closeDialog();$('#print-root').innerHTML='';renderLogin();toast('تم تغيير كلمة المرور. سجل الدخول بكلمتك الجديدة.');break;
    case 'definition-form':await call('definition.save',{...v,type:row.id?row.type:v.type,id:row.id,version:row.version,active:!!v.active});await saved('تم حفظ التعريف');break;
    case 'company-form':await call('company.save',{...v,id:row.id,version:row.version,active:!!v.active});await saved('تم حفظ الشركة');break;
    case 'user-form':await call('user.save',{...v,id:row.id,version:row.version,active:!!v.active,permissions:data.getAll('permission')});await saved('تم حفظ الحساب');break;
    case 'pricing-form':await call('pricing.save',collectPricing());await saved('تم حفظ التسعير');break;
    case 'offer-form':{const p=state.boot.pricings.find(x=>x.id===v.pricingId);if(!p)throw Error('اختر مصدر الأسعار');await call('offer.save',{...v,id:row.id,version:row.version,pricingVersion:p.version});await saved('تم حفظ العرض كمسودة');break;}
    case 'publish-form':{const payload=collectPublish(),result=await call('publish.preview',payload);state.pending={...payload,previewHash:result.previewHash};$('#publish-review').innerHTML=`<h3>مراجعة النشر لكل شركة</h3>${result.currencyChanges?.length?'<div class="hint warn">تغيرت عملة بنود منشورة سابقاً للشركات التالية: '+result.currencyChanges.map(esc).join('، ')+'. راجع مبالغ العمولات بعملة البيع الجديدة قبل التأكيد؛ لا يجري تحويلها تلقائياً.</div>':''}${table(['الشركة','البند','الأساسي','العمولة','الصافي','الإجراء'],result.assignments.flatMap(a=>a.lines.map(l=>tr([esc(a.companyName),esc(l.label),amount(l.basePrice,l.currency),amount(l.commission,l.currency),amount(l.netPrice,l.currency),badge(a.active?'نشر':'إيقاف',a.active?'ok':'danger')]))))}<div class="form-actions">${btn('تأكيد النشر','publish.commit','','primary')}</div>`;$('#publish-review').scrollIntoView({behavior:'smooth',block:'start'});break;}
    case 'quote-form':{const payload=collectQuote(),result=await call('quote.preview',payload);state.pending={...payload,previewHash:result.previewHash};$('#quote-review').innerHTML=`<h3>مراجعة قبل الحفظ</h3>${table(['البند','الشراء','الإضافات','الربح الفعلي','البيع النهائي'],result.quote.lines.map(l=>tr([esc(l.label),amount(l.purchase,l.currency),amount(l.extraTotal,l.currency),amount(l.profit,l.currency),amount(l.total,l.currency)])))}<div class="hint section">${result.previousTotals?.length?'الإجماليات السابقة: '+totalsHtml({totals:result.previousTotals})+' · ':''}الإجماليات الجديدة بحسب العملة: <strong>${totalsHtml(result.quote)}</strong>${payload.refreshSources?'<br>سيتم اعتماد أسعار المصدر الجديدة عند التأكيد.':''}</div><div class="form-actions">${btn('تأكيد حفظ التسعيرة','quote.commit','','primary')}</div>`;$('#quote-review').scrollIntoView({behavior:'smooth',block:'start'});break;}
    case 'settings-form':await call('settings.save',{...v,version:state.boot.settings.version});await reload();toast('تم حفظ الإعدادات');break;
    case 'import-form':{const rows=await readImport(data.get('file'));state.pending=rows;$('#import-review').innerHTML=table(['النوع','الاسم','العدد / التكلفة'],rows.map(r=>tr([esc(r.type),esc(r.name),esc(r.type==='room'?r.occupancy:r.cost)])))+'<div class="form-actions">'+btn('تأكيد استيراد '+rows.length+' صفاً','import.commit','','primary')+'</div>';break;}
  }
}
function showError(error){const el=$('#dialog').open?$('#dialog-error'):$('#login-error');if(el)el.innerHTML='<div class="hint error">'+esc(error.message||error)+'</div>';else toast(error.message||String(error));}
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el||el.disabled)return;el.disabled=true;try{if($('#dialog-error'))$('#dialog-error').innerHTML='';await onAction(el.dataset.action,el.dataset.id,el);}catch(err){showError(err);}finally{el.disabled=false;}});
document.addEventListener('submit',async e=>{e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');if(button?.disabled)return;if(button)button.disabled=true;try{if($('#dialog-error'))$('#dialog-error').innerHTML='';if($('#login-error'))$('#login-error').innerHTML='';await onSubmit(form);}catch(err){showError(err);}finally{if(button)button.disabled=false;}});
document.addEventListener('input',e=>{
  if(e.target.id==='search'){state.filter=e.target.value;renderRows();return;}
  if(e.target.closest('#publish-form')||e.target.closest('#quote-form'))invalidateReview();
  if(e.target.dataset.commission)$$('[data-company]').filter(el=>el.dataset.company===e.target.dataset.commission).forEach(el=>el.value='');
  if(e.target.closest('#quote-form'))updateQuoteTotals();
});
document.addEventListener('change',e=>{
  if(e.target.name==='saleCurrency'&&$('#pricing-form'))pricingFields();
  if(e.target.name==='serviceId'&&$('#pricing-form')){const service=state.boot.definitions.find(d=>d.id===e.target.value);if(service)$('[name=saleCurrency]').value=service.saleCurrency||'LYD';pricingFields();}
  if(e.target.dataset.extra==='currency'){
    const row=e.target.closest('.extra-row'),line=e.target.closest('.line-editor'),code=state.editor.lines[Number(line.dataset.index)].source.currency||'LYD',rate=row.querySelector('[data-extra=rate]');
    rate.value=e.target.value===code?'1':'';rate.disabled=e.target.value===code;
  }
  if(e.target.id==='sort-order'){state.sort=e.target.value;renderRows();}
  if(e.target.id==='kind-filter'){state.kind=e.target.value;renderRows();}
  if(e.target.name==='type'&&$('#definition-form'))definitionFields();
  if(e.target.name==='role')userFields();
  if(e.target.name==='kind'||e.target.name==='includeMadinah')pricingFields();
  if(e.target.name==='selectAll')$$('[name=companySelected]').forEach(el=>el.checked=e.target.checked);
  if(e.target.name==='makkahHotelId'||e.target.name==='madinahHotelId'){const h=state.boot.definitions.find(d=>d.id===e.target.value);if(h)$('[name='+e.target.name.replace('HotelId','Rate')+']').value=h.rate;}
  if(e.target.closest('#publish-form')||e.target.closest('#quote-form'))invalidateReview();
  if(e.target.closest('#quote-form'))updateQuoteTotals();
});
$('#dialog').addEventListener('cancel',()=>{state.editor=null;state.pending=null;});
window.addEventListener('offline',()=>toast('الاتصال بالإنترنت منقطع. تبقى المدخلات في الشاشة حتى يعود الاتصال.'));
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  Promise.resolve(document.modelContext.registerTool({name:'search_my_company_offers',title:'البحث في عروض شركتي',description:'Read published offers assigned to the currently signed-in company. Returns its own approved selling prices and commissions only.',inputSchema:{type:'object',properties:{query:{type:'string',maxLength:200}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},async execute(input){
    if(!input||typeof input!=='object'||Object.keys(input).some(k=>k!=='query')||input.query!=null&&typeof input.query!=='string'||String(input.query||'').length>200)throw Error('استعلام غير صحيح');
    const b=await call('bootstrap');if(b.user.role!=='company')throw Error('هذه الأداة متاحة لحساب شركة');
    return b.assignments.filter(a=>a.name.includes(input.query||'')).map(a=>({id:a.id,name:a.name,expired:a.expired,lines:a.lines.map(l=>({label:l.label,unit:l.unit,currency:l.currency,basePrice:l.basePrice,commission:l.commission,netPrice:l.netPrice}))}));
  }},{signal:lifecycle.signal})).catch(()=>{});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
if(state.token)reload().catch(err=>{renderLogin();showError(err);});else renderLogin();
