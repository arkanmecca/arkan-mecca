/* Only doGet and api are browser-callable; privileged helpers end in _. */
function doGet() {return HtmlService.createHtmlOutputFromFile('Index').setTitle('رحلة | التسعير والعروض').addMetaTag('viewport','width=device-width, initial-scale=1');}
function api(request) {
  try {var result=app_().handle(request);if(result.ok && request.action==='backup.create')result.data=createBackup_(request.requestId);return result;}
  catch(e){console.error('RIHLA_SERVER',String(e.message).slice(0,300));return {ok:false,error:{code:'SERVER',message:'تعذر الوصول إلى البيانات. راجع إعداد المنظومة أو أعد المحاولة.'}};}
}
function randomBytes_(length) {var hex='';while(hex.length<length*2)hex+=Utilities.getUuid().replace(/-/g,'');return hex.match(/../g).slice(0,length).map(function(h){return parseInt(h,16);});}
function crypto_() {return Rihla.configureCrypto(randomBytes_,function(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');},function(){return Utilities.getUuid();});}
function app_() {return Rihla.createApp({store:new SheetsStore_(),crypto:crypto_()});}

/* Run setup_ from the editor after setting the two initial credentials in Script properties. */
function setup_() {
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('DATABASE_ID'))throw Error('Already initialized. Existing data was not changed.');
  var username=props.getProperty('INITIAL_ADMIN_USER'),password=props.getProperty('INITIAL_ADMIN_PASSWORD');
  if(!username||!password)throw Error('Set INITIAL_ADMIN_USER and INITIAL_ADMIN_PASSWORD in Script properties first.');
  var db=SpreadsheetApp.create('RIHLA — Private Data');
  Rihla.TABLES.forEach(function(t,i){var s=i===0?db.getSheets()[0].setName(t):db.insertSheet(t);s.getRange(1,1,1,4).setValues([['id','version','updatedAt','data']]).setFontWeight('bold');s.setFrozenRows(1);s.getRange('A:D').setNumberFormat('@');});
  SpreadsheetApp.flush();
  Rihla.createApp({store:new SheetsStore_(db.getId()),crypto:crypto_()}).initialize(username,password);
  var folder=DriveApp.createFolder('RIHLA — Private Backups');
  props.setProperties({DATABASE_ID:db.getId(),BACKUP_FOLDER_ID:folder.getId()});props.deleteProperty('INITIAL_ADMIN_PASSWORD');props.deleteProperty('INITIAL_ADMIN_USER');
  installMaintenance_();console.log('Setup complete. Private database: '+db.getUrl());
}
function installMaintenance_(){ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='nightlyMaintenance_';}).forEach(function(t){ScriptApp.deleteTrigger(t);});ScriptApp.newTrigger('nightlyMaintenance_').timeBased().everyDays(1).atHour(2).create();}
function createBackup_(requestId){
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {var props=PropertiesService.getScriptProperties(),folder=DriveApp.getFolderById(props.getProperty('BACKUP_FOLDER_ID'));if(requestId&&!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId))throw Error('Invalid request ID');var name='RIHLA_BACKUP_'+(requestId||Utilities.formatDate(new Date(),'UTC','yyyy-MM-dd_HH-mm-ss')),existing=folder.getFilesByName(name);var copy=existing.hasNext()?existing.next():DriveApp.getFileById(props.getProperty('DATABASE_ID')).makeCopy(name,folder);return {name:name,id:copy.getId(),createdAt:copy.getDateCreated().toISOString()};}
  finally {lock.releaseLock();}
}
function nightlyMaintenance_(){app_().cleanup();createBackup_();}
function verifyInstallation_(){var snapshot=new SheetsStore_().read_();Rihla.validateSnapshot(snapshot.data);var start=Date.now(),c=crypto_(),hash=c.hash('installation-check-only-2026');if(!c.verify('installation-check-only-2026',hash))throw Error('Password verification failed');console.log(JSON.stringify({schema:'OK',passwordCheck:'OK',passwordMilliseconds:Date.now()-start,tables:Rihla.TABLES.length}));}
function restoreBackup_(){
  var props=PropertiesService.getScriptProperties(),backupId=props.getProperty('RESTORE_BACKUP_ID');if(!backupId)throw Error('Set RESTORE_BACKUP_ID first.');
  var backup=DriveApp.getFileById(backupId),parents=backup.getParents(),inside=false;while(parents.hasNext())if(parents.next().getId()===props.getProperty('BACKUP_FOLDER_ID'))inside=true;if(!inside)throw Error('File is not in the private backup folder.');
  Rihla.validateSnapshot(new SheetsStore_(backupId).read_().data);
  var restored=backup.makeCopy('RIHLA — Restored '+new Date().toISOString()),target=new SheetsStore_(restored.getId());
  target.transaction(function(tx){['sessions','attempts','requests'].forEach(function(t){tx.all(t).forEach(function(r){tx.remove(t,r.id);});});tx.all('users').forEach(function(u){tx.put('users',Object.assign({},u,{authVersion:u.authVersion+1}));});});
  Rihla.validateSnapshot(target.read_().data);props.deleteProperty('RESTORE_BACKUP_ID');
  console.log('Verified restored COPY: '+restored.getId()+'. Current database unchanged. Review copy, then set DATABASE_ID to its ID to switch.');
}
