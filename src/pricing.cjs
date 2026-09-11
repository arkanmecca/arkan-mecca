'use strict';

class AppError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function fail(code, message) { throw new AppError(code, message); }
function number(value, label = 'القيمة', min = 0, max = 1e9) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < min || n > max) fail('VALIDATION', `${label}: أدخل رقماً بين ${min} و${max}`);
  return n;
}
function integer(value, label, min = 0, max = 1000) {
  const n = number(value, label, min, max);
  if (!Number.isInteger(n)) fail('VALIDATION', `${label}: يجب أن يكون عدداً صحيحاً`);
  return n;
}
function text(value, label = 'الاسم', max = 300, required = false) {
  const s = String(value ?? '').trim();
  if (s.length > max || (required && !s)) fail('VALIDATION', `${label}: القيمة مطلوبة وبحد أقصى ${max} حرف`);
  return s;
}
function money(n) { if(!Number.isFinite(n)||Math.abs(n)>1e12)fail('VALIDATION','المبلغ المحسوب يتجاوز الحد المسموح');return Math.round((n + Number.EPSILON) * 1000) / 1000; }
function roundUp(n, step) { return step > 0 ? Math.ceil(n / step) * step : n; }
const CURRENCIES=['LYD','USD','SAR'];
function currency(value='LYD') { if(!CURRENCIES.includes(value))fail('VALIDATION','العملة غير مدعومة');return value; }
function convertCurrency(n,from,to,p) {
  currency(from);currency(to);if(from===to)return n;
  const usdToLyd=number(p.usdToLyd,'الدولار بالدينار',.0001);
  const sarPerUsd=from==='SAR'||to==='SAR'?number(p.sarPerUsd,'الدولار بالريال',.0001):1;
  const rates={LYD:1,USD:usdToLyd,SAR:usdToLyd/sarPerUsd};return n*rates[from]/rates[to];
}
function totalsByCurrency(lines) {
  const totals={};for(const l of lines){const code=currency(l.currency||'LYD');totals[code]||={currency:code,total:0,cost:0,profit:0};totals[code].total+=l.total;totals[code].cost+=l.cost;}
  return Object.values(totals).map(t=>({...t,total:money(t.total),cost:money(t.cost),profit:money(t.total-t.cost)}));
}
function currencyToLyd(n, currency, p) {
  if (currency === 'LYD') return n;
  if (currency === 'USD') return n * number(p.usdToLyd, 'الدولار بالدينار', .0001);
  if (currency === 'SAR') return n / number(p.sarPerUsd, 'الدولار بالريال', .0001) * number(p.usdToLyd, 'الدولار بالدينار', .0001);
  fail('VALIDATION', 'عملة غير معتمدة');
}
function calculateProgram(input, rooms, services = []) {
  const p = {};
  for (const key of ['makkahRate','madinahRate','extraBed','visaUsd','ticketLyd','transportLyd','otherLyd','profitValue','rounding']) p[key] = number(input[key], key);
  p.makkahNights = integer(input.makkahNights, 'ليالي مكة', 0, 365);
  p.madinahNights = integer(input.madinahNights, 'ليالي المدينة', 0, 365);
  p.includeMadinah = input.includeMadinah === true;
  p.sarPerUsd = number(input.sarPerUsd ?? 3.72, 'الدولار بالريال', .0001);
  p.usdToLyd = number(input.usdToLyd ?? 4.85, 'الدولار بالدينار', .0001);
  p.profitType = input.profitType === 'fixed' ? 'fixed' : 'percent';
  p.serviceIds = [...new Set(input.serviceIds || [])];
  const serviceCostLYD = p.serviceIds.reduce((sum, id) => {
    const svc = services.find(s => s.id === id && s.active !== false);
    if (!svc) fail('VALIDATION', 'إحدى خدمات البرنامج غير متاحة');
    return sum + currencyToLyd(number(svc.cost), svc.currency || 'LYD', p);
  }, 0);
  if (!rooms.length) fail('VALIDATION', 'اختر نوع غرفة واحداً على الأقل');
  const totalNights = p.makkahNights + (p.includeMadinah ? p.madinahNights : 0);
  const baseRoomSAR = p.makkahRate * p.makkahNights + (p.includeMadinah ? p.madinahRate * p.madinahNights : 0);
  const overrides = input.roomOverrides || {};
  const results = rooms.map(room => {
    const count = integer(room.occupancy, 'عدد الأشخاص', 1, 20);
    const override = overrides[room.id] || {};
    const makkahRate = override.makkahRate === '' || override.makkahRate == null ? p.makkahRate : number(override.makkahRate);
    const madinahRate = override.madinahRate === '' || override.madinahRate == null ? p.madinahRate : number(override.madinahRate);
    const extraBeds = room.extraBeds == null ? Math.max(0, count - 2) : integer(room.extraBeds, 'الأسرّة الإضافية', 0, 20);
    const extraSAR = p.extraBed * extraBeds * totalNights;
    const totalRoomSAR = makkahRate * p.makkahNights + (p.includeMadinah ? madinahRate * p.madinahNights : 0) + extraSAR;
    const perPersonSAR = totalRoomSAR / count;
    const accommodationUSD = perPersonSAR / p.sarPerUsd;
    const accommodationLYD = accommodationUSD * p.usdToLyd;
    const visaLYD = p.visaUsd * p.usdToLyd;
    const baseCost = accommodationLYD + visaLYD + p.ticketLyd + p.transportLyd + p.otherLyd + serviceCostLYD;
    const plannedProfit = p.profitType === 'fixed' ? p.profitValue : baseCost * p.profitValue / 100;
    const calculatedSell = roundUp(baseCost + plannedProfit, p.rounding);
    const sell = override.sell === '' || override.sell == null ? calculatedSell : number(override.sell, 'سعر البيع');
    return {key:room.id, label:room.name, unit:'person', currency:'LYD', count, extraSAR, totalRoomSAR,
      perPersonSAR, accommodationUSD, accommodationLYD, visaLYD, serviceCostLYD, baseCost, plannedProfit,
      calculatedSell, sell, basePrice:money(sell), profit:sell-baseCost, margin:baseCost > 0 ? (sell-baseCost)/baseCost*100 : 0};
  });
  return {totalNights, baseRoomSAR, serviceCostLYD, results};
}
function calculateService(input, service) {
  if (!service || service.active === false) fail('VALIDATION', 'اختر خدمة فعالة');
  const sourceCost = input.cost === '' || input.cost == null ? number(service.cost) : number(input.cost);
  const saleCurrency=currency(input.saleCurrency||service.saleCurrency||'LYD');
  const baseCost = convertCurrency(sourceCost,service.currency||'LYD',saleCurrency,input);
  const profitValue = number(input.profitValue);
  const plannedProfit = input.profitType === 'fixed' ? profitValue : baseCost * profitValue / 100;
  const calculatedSell = roundUp(baseCost + plannedProfit, number(input.rounding));
  const sell = input.sell === '' || input.sell == null ? calculatedSell : number(input.sell);
  return {results:[{key:service.id, label:service.name, unit:service.unit || 'item', currency:saleCurrency,
    baseCost, calculatedSell, plannedProfit, sell, basePrice:money(sell), profit:sell-baseCost,
    margin:baseCost > 0 ? (sell-baseCost)/baseCost*100 : 0}]};
}
function quoteLine(source, input) {
  const quantity = integer(input.quantity, 'العدد', 1, 10000);
  const nights = source.unit === 'roomNight' ? integer(input.nights, 'الليالي', 1, 365) : 1;
  const units = quantity * nights;
  const lineCurrency=currency(source.currency||'LYD');
  const extras = (input.extras || []).map(e => {
    const code=currency(e.currency||lineCurrency),amount=number(e.amount,'التكلفة الإضافية');
    const rate=code===lineCurrency?1:number(e.rate,'سعر تحويل التكلفة إلى عملة البند',.000001,1e6);
    return {label:text(e.label,'وصف التكلفة',200,true),amount,currency:code,rate,convertedAmount:money(amount*rate)};
  });
  if (extras.length > 20) fail('VALIDATION', 'الحد الأقصى 20 تكلفة إضافية لكل بند');
  const extraTotal = money(extras.reduce((sum,e) => sum+e.convertedAmount,0));
  const purchase = money(source.netPrice * units);
  const cost = money(purchase + extraTotal);
  const marginValue = number(input.marginValue, 'هامش الربح');
  const marginType = input.marginType === 'fixed' ? 'fixed' : 'percent';
  const plannedProfit = marginType === 'fixed' ? marginValue * units : cost * marginValue / 100;
  const mode = input.mode === 'manual' ? 'manual' : 'margin';
  const total = money(mode === 'manual' ? number(input.sellUnit, 'سعر بيع الوحدة') * units : cost + plannedProfit);
  return {...source, currency:lineCurrency, quantity, nights, units, extras, extraTotal, purchase, cost, mode, marginType, marginValue,
    sellUnit:total/units, total, profit:money(total-cost), belowCost:total<cost};
}
module.exports = {AppError, fail, number, integer, text, money, roundUp, currency, CURRENCIES, convertCurrency, totalsByCurrency, calculateProgram, calculateService, quoteLine};
