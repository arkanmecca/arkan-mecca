'use strict';
function exportSheet(record){
  if(record.kind==='quote'){
    const totals=record.totals||[{currency:record.currency||'LYD',total:record.total}];
    return {headers:['الشركة','العميل','العرض','البند','العملة','العدد','الليالي','متوسط بيع الوحدة','إجمالي البند'],rows:record.lines.map(l=>[record.company,record.customer,l.offerName,l.label,l.currency||'LYD',l.quantity,l.nights,l.sellUnit,l.total]).concat(totals.map(t=>[record.company,record.customer,'الإجمالي','',t.currency,'','','',t.total]))};
  }
  const units={person:'للشخص',roomNight:'للغرفة / الليلة',item:'للخدمة كاملة'};
  return {headers:['العرض','الجهة','الغرفة / الخدمة','الوحدة','العملة','السعر الأساسي','العمولة','الصافي','الصلاحية','الشروط'],rows:record.lines.map(l=>[record.name,record.company||'',l.label,units[l.unit]||l.unit,l.currency||'LYD',l.basePrice,l.commission??'',l.netPrice??l.basePrice,record.validUntil,record.description])};
}
module.exports={exportSheet};
