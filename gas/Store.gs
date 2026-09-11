function SheetsStore_(databaseId) { this.databaseId=databaseId||PropertiesService.getScriptProperties().getProperty('DATABASE_ID'); }
SheetsStore_.prototype.metaCacheKey_=function(){return 'rihla_meta_'+this.databaseId;};
SheetsStore_.prototype.sheets_=function(){
  var cache=CacheService.getScriptCache(),cached=cache.get(this.metaCacheKey_());
  if(cached) return JSON.parse(cached);
  var metadata=Sheets.Spreadsheets.get(this.databaseId,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount)))'});
  var sheets={}; metadata.sheets.forEach(function(s){sheets[s.properties.title]=s.properties;});
  cache.put(this.metaCacheKey_(),JSON.stringify(sheets),300);
  return sheets;
};
SheetsStore_.prototype.read_=function(){
  if(!this.databaseId) throw Error('Run setup_ first');
  var sheets=this.sheets_();
  var ranges=Rihla.TABLES.map(function(t){if(!sheets[t])throw Error('Missing table '+t);return "'"+t+"'!A2:D";});
  var result=Sheets.Spreadsheets.Values.batchGet(this.databaseId,{ranges:ranges,valueRenderOption:'UNFORMATTED_VALUE'});
  var data={},positions={},next={};
  Rihla.TABLES.forEach(function(t,i){
    data[t]={};positions[t]={}; var rows=result.valueRanges[i].values||[];next[t]=rows.length+1;
    rows.forEach(function(row,j){if(!row[0])return;var record=JSON.parse(row[3]);if(record.id!==row[0])throw Error('Corrupt row');if(data[t][record.id])throw Error('Duplicate row');data[t][record.id]=record;positions[t][record.id]=j+1;});
  });
  return {data:data,positions:positions,next:next,sheets:sheets};
};
SheetsStore_.prototype.transaction=function(callback){
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    var snapshot=this.read_(),tx=new Rihla.UnitOfWork(snapshot.data,Date.now,function(){return Utilities.getUuid();});
    var result=callback(tx),requests=[],growth={};
    tx.changes.forEach(function(change){
      var table=change.table,sheet=snapshot.sheets[table],id=change.remove?change.id:change.row.id;
      var row=snapshot.positions[table][id];
      if(row===undefined){if(change.remove)return;row=snapshot.next[table]++;}
      if(row>=sheet.gridProperties.rowCount) growth[table]=Math.max(growth[table]||0,row+100-sheet.gridProperties.rowCount);
      var values=change.remove?['','','','']:[id,String(change.row.version),change.row.updatedAt,JSON.stringify(change.row)];
      requests.push({updateCells:{start:{sheetId:sheet.sheetId,rowIndex:row,columnIndex:0},rows:[{values:values.map(function(v){return {userEnteredValue:{stringValue:v}};})}],fields:'userEnteredValue'}});
    });
    Object.keys(growth).forEach(function(t){requests.unshift({appendDimension:{sheetId:snapshot.sheets[t].sheetId,dimension:'ROWS',length:growth[t]}});});
    // Atomic data, audit and duplicate-request receipt commit.
    if(requests.length) Sheets.Spreadsheets.batchUpdate({requests:requests},this.databaseId);
    // A sheet's row count only changes on growth; refresh the cached structure so later
    // writes compute growth against the real row count instead of a stale, smaller one.
    if(Object.keys(growth).length) CacheService.getScriptCache().remove(this.metaCacheKey_());
    return result;
  } finally {lock.releaseLock();}
};
// No-lock path for actions that only read data (opening a screen, listing records).
// Concurrent users no longer queue behind each other just to view data; the lock is
// reserved for the moment something is actually saved.
SheetsStore_.prototype.read=function(callback){
  var snapshot=this.read_(),tx=new Rihla.UnitOfWork(snapshot.data,Date.now,function(){return Utilities.getUuid();});
  var result=callback(tx);
  if(tx.changes.size) throw Error('read() must not write data; use transaction() instead');
  return result;
};
