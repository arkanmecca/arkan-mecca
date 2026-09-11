'use strict';
// Local QA only. Not included in the deployable Apps Script application.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../test/fixture.cjs');
const env=fixture({cost:4});
const port=Number(process.env.PORT||4173),host=process.env.HOST||'0.0.0.0';
http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='POST'&&req.url==='/api'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>300000){res.writeHead(413);res.end();return;}}
    try{const request=JSON.parse(body),result=env.app.handle(request);if(result.ok&&request.action==='backup.create'){const directory=path.join(__dirname,'../test-results');fs.mkdirSync(directory,{recursive:true});const name='LOCAL_TEST_BACKUP_'+Date.now()+'.json';fs.writeFileSync(path.join(directory,name),JSON.stringify(env.store.data));result.data={name};}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}catch(e){res.writeHead(400);res.end('{}');}return;
  }
  if(req.method==='GET'&&req.url==='/qa/mobile'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><title>Mobile fixture — 390 × 844</title></head><body style="margin:0;background:#dce4eb"><iframe title="واجهة الهاتف التجريبية" src="/qa/company" style="width:390px;height:844px;border:0;display:block;margin:10px auto"></iframe></body></html>');return;
  }
  const caseTokens={'/qa/admin':env.admin,'/qa/company':env.tokens[0],'/qa/company-b':env.tokens[1]};
  if(req.method==='GET'&&(req.url==='/'||req.url==='/index.html'||caseTokens[req.url])){
    res.setHeader('Content-Type','text/html; charset=utf-8');let html=fs.readFileSync(path.join(__dirname,'../dist/web/index.html'),'utf8');
    // Isolated, synthetic authenticated-state fixtures for UI tests. No credentials
    // are entered through the browser and no fixture route exists in Code.gs.
    if(caseTokens[req.url])html=html.replace('<body>','<body><script>sessionStorage.setItem("rihla_session",'+JSON.stringify(caseTokens[req.url])+');</script>');
    res.end(html);return;
  }
  res.writeHead(404);res.end('Not found');
}).listen(port,host,()=>console.log('Local QA ready at http://'+host+':'+port+'/ — synthetic test data only'));
