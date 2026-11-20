/** Hooop Companion: local native conversions, strictly opt-in device transfers
 * and paired phone monitoring. Node 24+, no dependencies. Does NOT invent
 * control protocols for devices that merely advertise Wi-Fi/BLE/USB.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import crypto from 'node:crypto';
import {createAuth} from './auth.mjs';
import {discoverBluetooth,discoverLan,listVolumes} from './devices.mjs';
import {machineProfiles,findProfile} from './profiles.mjs';
const exec=promisify(execFile);
const WEB=fileURLToPath(new URL('../web/',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const exportsAllowed=new Set(['pes','pec','pen','dst','exp','jef','vp3']);
const inputTypes={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif','image/bmp':'.bmp','image/tiff':'.tiff','image/svg+xml':'.svg'};
function safeName(name){return String(name||'hooop-design').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'-').replace(/-+/g,'-').slice(0,65)||'hooop-design'}
function send(res,status,data,headers={}){const body=Buffer.from(JSON.stringify(data));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':String(body.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body)}
function fail(msg,status=400){throw Object.assign(Error(msg),{status})}
function readJson(req,max=5*1024*1024){return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>max){reject(Object.assign(Error('Request exceeds file size limit'),{status:413}));req.destroy();return}chunks.push(chunk)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(Object.assign(Error('Invalid JSON'),{status:400}))}});req.on('error',reject)})}
function extractToken(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):null}
function fileContent(body){const type=String(body.mime||'');if(!Object.hasOwn(inputTypes,type))fail('Unsupported image or SVG type');const text=String(body.data||'');if(!/^[a-zA-Z0-9+/=]+$/.test(text)||text.length>6*1024*1024)fail('Bad image data or image too large',413);const data=Buffer.from(text,'base64');if(!data.length||data.length>4*1024*1024)fail('Input file must be 1 byte to 4 MB');
 if(type==='image/svg+xml'){
  const s=data.toString('utf8');const check=s.replace(/xmlns(?::[a-z0-9_-]+)?\s*=\s*["'][^"']+["']/gi,'');
  if(!/<svg[\s>]/i.test(s)||/<\s*(?:script|foreignObject|style|iframe)|<!DOCTYPE|<!ENTITY|\bonload\s*=|\bonerror\s*=|\b(?:href|src)\s*=\s*["']\s*(?:https?:|data:|file:|javascript:)|url\s*\(|@import/i.test(check))fail('SVG uses unsupported or unsafe content');
 }
 return {data,ext:inputTypes[type]};}
function validTargetId(v){return typeof v==='string'&&/^[a-zA-Z0-9_-]{1,85}$/.test(v)}
function getLanTargets(env){let o={};try{o=JSON.parse(env.HOOOP_LAN_TARGETS_JSON||'{}')}catch{}return Object.entries(o).filter(([id,x])=>validTargetId(id)&&x&&typeof x.endpoint==='string'&&x.endpoint.startsWith('https://')).map(([id,x])=>({id,name:String(x.name||id).slice(0,80),endpoint:x.endpoint,authorization:typeof x.authorization==='string'?x.authorization:''}));}
const STATUS_TIMEOUT=30000;
export function createCompanion({env=process.env,cli=env.HOOOP_CLI||'zigzag',runNative=async(args,timeout=STATUS_TIMEOUT)=>exec(cli,args,{timeout,maxBuffer:1024*500,windowsHide:true}),usbFinder=listVolumes,bleFinder=discoverBluetooth,lanFinder=discoverLan}={}){
 const auth=createAuth({pin:env.HOOOP_LOCAL_PIN});const jobs=new Map(),events=[];const pushEvent=(type,detail)=>{events.unshift({id:crypto.randomUUID(),type,detail,time:new Date().toISOString()});events.length= Math.min(events.length,60)?Math.min(events.length,60):0};
 const permittedWrite=env.HOOOP_ALLOW_REMOTE_TRANSFER==='1';const permittedBle=env.HOOOP_ALLOW_BLE_SEND==='1';const lanTargets=getLanTargets(env),visionBudget=new Map();const bridge={auth,jobs,events};
 let snapshot={volumes:[],bluetooth:{status:'not-scanned',devices:[]},lan:[],lanTargets:lanTargets.map(x=>({id:x.id,name:x.name})),updated:null};
 async function convert(body){
  const profile=findProfile(body.profile);if(!profile)fail('Choose a supported machine profile');
  const format=String(body.format||profile.format||'').toLowerCase();if(!exportsAllowed.has(format))fail('Select a supported embroidery format');
  if(body.format&&format!==profile.format)fail('Requested output format does not match selected machine profile');
  const {data,ext}=fileContent(body);const jobId=crypto.randomUUID();
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'hooop-companion-'));
  const input=path.join(directory,'source'+ext),output=path.join(directory,safeName(body.name)+'.'+format);
  const job={id:jobId,name:safeName(body.name),profile:profile.id,format,state:'preparing',progress:0,created:new Date().toISOString(),output,dir:directory,filename:path.basename(output),destination:'download'};
  jobs.set(job.id,job);
  await fs.writeFile(input,data,{flag:'wx',mode:0o600});
  (async()=>{try{
    job.state='digitizing';job.progress=10;pushEvent('digitizing',job.name);
    await runNative(['convert',input,'--out',output,'--machine',profile.id],120000);
    const result=await fs.stat(output);if(result.size<50)throw Error('Native converter returned an empty or invalid machine file');
    job.state='ready';job.progress=100;job.bytes=result.size;job.completed=new Date().toISOString();pushEvent('export-ready',job.name);
  }catch(e){job.state='failed';job.error=String(e.message||e).slice(0,300);pushEvent('conversion-failed',job.error);}})();
  return job;
 }
 async function transfer(body){
  if(!permittedWrite)fail('Remote transfers are disabled. Set HOOOP_ALLOW_REMOTE_TRANSFER=1 on the desktop.',403);
  if(body.confirm!==true)fail('Explicit confirmation is required',400);
  const job=jobs.get(String(body.job_id));if(!job||job.state!=='ready')fail('Convert a design successfully before transferring');
  if(job.transferState==='running')fail('A transfer is already in progress',409);
  const method=String(body.method||'');const dest=String(body.target||'');
  if(!['usb-file','configured-lan-http','ble-skitch'].includes(method))fail('Unsupported connection method');
  if(method==='ble-skitch'&&(!permittedBle||job.profile!=='brother-skitch'||job.format!=='pen'))fail('Only explicitly enabled Brother Skitch PP1 BLE transfer is implemented; other Bluetooth devices are discovery-only.',403);
  if(method==='configured-lan-http'&&!lanTargets.some(x=>x.id===dest))fail('Configure and approve a known HTTPS file-receiver endpoint on the desktop before LAN transfer.',403);
  if(method==='usb-file'&&!(await usbFinder()).some(x=>x.id===dest))fail('Select a currently mounted destination drive');
  job.transferState='running';job.progress=0;job.destination=method;pushEvent('transfer-started',job.name+' · '+method);
  (async()=>{try{
    if(method==='usb-file'){
      const v=(await usbFinder()).find(x=>x.id===dest);if(!v)throw Error('Drive disconnected');
      const real=await fs.realpath(v.path);if(real!==v.path)throw Error('Drive mount changed');
      const to=path.join(real,job.filename);await fs.copyFile(job.output,to,fs.constants.COPYFILE_EXCL);job.targetName=path.basename(real);job.progress=100;
    }else if(method==='configured-lan-http'){
      const t=lanTargets.find(x=>x.id===dest);const payload=await fs.readFile(job.output);
      const u=new URL(t.endpoint);if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid HTTPS destination');
      const response=await fetch(u,{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-Hooop-Filename':job.filename,...(t.authorization?{'Authorization':t.authorization}:{})},body:payload,redirect:'error',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('Approved LAN receiver rejected file (HTTP '+response.status+')');job.targetName=t.name;job.progress=100;
    }else{
      // Skitch needs raw SVG/image input; the machine's physical Start remains on-device.
      const inputFiles=await fs.readdir(job.dir);const input=inputFiles.find(f=>f.startsWith('source.'));
      if(!input)throw Error('Missing source');
      await runNative(['skitch','send',path.join(job.dir,input),'--scan','10'],100000);job.progress=100;job.targetName='Brother Skitch PP1';
    }
    job.transferState='completed';pushEvent('transfer-completed',job.name+' · '+(job.targetName||method));
  }catch(e){job.transferState='failed';job.transferError=String(e.message||e).slice(0,300);pushEvent('transfer-failed',job.transferError);}})();
  return job;
 }
 function publicJob(j){return{id:j.id,name:j.name,profile:j.profile,format:j.format,state:j.state,progress:j.progress,created:j.created,completed:j.completed,bytes:j.bytes,filename:j.filename,error:j.error,transferState:j.transferState,transferError:j.transferError,targetName:j.targetName,destination:j.destination}}
 async function route(req,res){
  const url=new URL(req.url||'/', 'http://localhost');const pathname=url.pathname,method=req.method||'GET';
  if(method==='OPTIONS'){res.writeHead(405);res.end();return}
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail('Cross-origin requests are not allowed',403);
  if(pathname.startsWith('/api/bridge/')){
    if(pathname==='/api/bridge/health'&&method==='GET')return send(res,200,{app:'Hooop Companion',version:1,connected:true,tls:!!env.HOOOP_TLS_CERT,pairingRequired:true,remoteWrite:permittedWrite,bluetoothTransfer:permittedBle});
    if(pathname==='/api/bridge/pair'&&method==='POST'){
      if(!String(req.headers['content-type']).startsWith('application/json'))fail('JSON required',415);
      const body=await readJson(req,1000);return send(res,200,auth.issue(req.socket.remoteAddress||'unknown',String(body.pin||'')));
    }
    if(!auth.verify(extractToken(req)))fail('Pair your phone with the desktop using the current pairing code.',401);
    if(pathname==='/api/bridge/session'&&method==='GET')return send(res,200,{paired:true,remoteWrite:permittedWrite,bluetoothTransfer:permittedBle});
    if(pathname==='/api/bridge/session'&&method==='DELETE'){auth.revoke(extractToken(req));return send(res,200,{revoked:true})}
    if(pathname==='/api/bridge/profiles'&&method==='GET')return send(res,200,{machines:machineProfiles});
    if(pathname==='/api/bridge/status'&&method==='GET')return send(res,200,{bridge:'online',snapshot:{...snapshot,lanTargets:lanTargets.map(x=>({id:x.id,name:x.name}))},events:events.slice(0,25),jobs:[...jobs.values()].slice(-30).map(publicJob),localTime:new Date().toISOString(),remoteWrite:permittedWrite,bluetoothTransfer:permittedBle});
    if(pathname==='/api/bridge/discover'&&method==='POST'){
      const body=await readJson(req,1000);const which=String(body.type||'all');if(!['usb','lan','ble','all'].includes(which))fail('Unknown discovery type');
      if(which==='all'||which==='usb')snapshot.volumes=await usbFinder();
      if(which==='all'||which==='ble')snapshot.bluetooth=await bleFinder({cli,seconds:6});
      if(which==='all'||which==='lan')snapshot.lan=await lanFinder({timeoutMs:1300});
      snapshot.updated=new Date().toISOString();pushEvent('discovery',which);return send(res,200,{snapshot});
    }
    if(pathname==='/api/bridge/skitch-status'&&method==='POST'){
      try{const {stdout}=await runNative(['skitch','status','--scan','8'],23000);const lines=stdout.trim().slice(0,1000);pushEvent('pp1-status',lines);return send(res,200,{protocol:'skitch',connected:true,raw:lines});}
      catch(e){return send(res,503,{protocol:'skitch',connected:false,error:'Brother PP1 not currently accessible: '+String(e.message).slice(0,170)})}
    }
    if(pathname==='/api/bridge/convert'&&method==='POST'){
      if(!String(req.headers['content-type']).startsWith('application/json'))fail('JSON required',415);
      const body=await readJson(req,6*1024*1024);const job=await convert(body);return send(res,202,{job:publicJob(job)});
    }
    if(pathname==='/api/bridge/transfer'&&method==='POST')return send(res,202,{job:publicJob(await transfer(await readJson(req,5000)))});
    if(pathname==='/api/bridge/vision'&&method==='POST'){
      if(!env.OPENROUTER_API_KEY)return fail('Optional image analysis requires OPENROUTER_API_KEY configured on your desktop bridge',501);
      const ident=crypto.createHash('sha256').update(extractToken(req)).digest('hex');const previous=visionBudget.get(ident)||[];const now=Date.now();const recent=previous.filter(t=>now-t<60000);if(recent.length>=4)fail('Vision advice limited to four requests per minute',429);recent.push(now);visionBudget.set(ident,recent);
      const body=await readJson(req,4*1024*1024),mime=String(body.mime||'');if(!['image/png','image/jpeg','image/webp'].includes(mime))fail('Vision accepts PNG, JPEG or WebP');
      if(typeof body.data!=='string'||body.data.length>3*1024*1024||!/^[a-zA-Z0-9+/=]+$/.test(body.data))fail('Image too large or malformed');
      const model=env.HOOOP_VISION_MODEL||'google/gemini-2.5-flash';
      const ai=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+env.OPENROUTER_API_KEY,'Content-Type':'application/json','HTTP-Referer':'https://hooop.vercel.app','X-Title':'Hooop'},body:JSON.stringify({model,max_tokens:400,temperature:0.15,messages:[{role:'system',content:'You are a professional embroidery digitizing advisor. Briefly identify subjects, logo/text, dominant thread colors, background to remove, tiny details that might not sew, and actionable tracing/digitizing steps. Do not claim pixel-exact reconstruction. Reply concise plain text.'},{role:'user',content:[{type:'text',text:'Analyze this image for embroidery conversion. Focus on identifying exact shapes and thread-color areas. Never claim a stitch pattern is verified.'},{type:'image_url',image_url:{url:'data:'+mime+';base64,'+body.data}}]}]}),signal:AbortSignal.timeout(25000)});
      if(!ai.ok)fail('Image analysis provider error ('+ai.status+')',502);
      const data=await ai.json();return send(res,200,{analysis:String(data?.choices?.[0]?.message?.content||'No analysis returned').slice(0,4500),model});
    }
    const match=pathname.match(/^\/api\/bridge\/jobs\/([a-f0-9-]{36})(\/file)?$/);
    if(match&&method==='GET'){
      const job=jobs.get(match[1]);if(!job)fail('Job not found',404);
      if(!match[2])return send(res,200,{job:publicJob(job)});
      if(job.state!=='ready')fail('File not ready',409);
      const binary=await fs.readFile(job.output);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':String(binary.length),'Content-Disposition':'attachment; filename="'+job.filename+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(binary);return;
    }
    fail('Unknown API route',404);
  }
  if(method!=='GET'&&method!=='HEAD')fail('Method not allowed',405);
  let file=pathname==='/'||pathname==='/studio/'||pathname==='/guide/'||pathname==='/devices/'?'index.html':pathname.replace(/^\/+/, '');
  if(file.includes('..')||file.includes('\\')||file.startsWith('.'))fail('Invalid path',400);
  const root=path.resolve(WEB),target=path.resolve(root,file);
  if(!target.startsWith(root+path.sep)&&target!==root)fail('Invalid path',400);
  let body;try{body=await fs.readFile(target)}catch{fail('Page not found',404)}
  const type=MIME[path.extname(target)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Content-Length':String(body.length),'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Cache-Control':file==='sw.js'?'no-cache':'private, max-age=60','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});res.end(method==='HEAD'?undefined:body);
 }
 const handler=(req,res)=>{route(req,res).catch(e=>{if(!res.headersSent)send(res,e.status||500,{error:String(e.message||e).slice(0,350)});else res.end()})};
 return{...bridge,handler,server:http.createServer(handler),getSnapshot:()=>snapshot};
}
export async function startCompanion(env=process.env){
 const {handler,auth}=createCompanion({env});const tls=Boolean(env.HOOOP_TLS_CERT&&env.HOOOP_TLS_KEY);
 if(Boolean(env.HOOOP_TLS_CERT)!==Boolean(env.HOOOP_TLS_KEY))throw Error('Both HOOOP_TLS_CERT and HOOOP_TLS_KEY are required');
 const bind=env.HOOOP_HOST||'127.0.0.1';if(!tls&&!['127.0.0.1','::1','localhost'].includes(bind))throw Error('LAN/mobile access requires TLS: supply HOOOP_TLS_CERT and HOOOP_TLS_KEY. Plain HTTP can bind only to loopback.');
 const srv=tls?https.createServer({cert:await fs.readFile(env.HOOOP_TLS_CERT),key:await fs.readFile(env.HOOOP_TLS_KEY)},handler):http.createServer(handler);
 const port=Number(env.HOOOP_PORT||4787);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 await new Promise((resolve,reject)=>srv.once('error',reject).listen(port,bind,resolve));
 const scheme=tls?'https':'http';const address=scheme+'://'+(bind.includes(':')?'['+bind+']':bind)+':'+port;
 console.log('\nHooop Companion · secure local embroidery bridge\nURL: '+address+'/devices/\nPairing code: '+auth.pin+'\nRemote transfer: '+(env.HOOOP_ALLOW_REMOTE_TRANSFER==='1'?'ENABLED — requires confirmation':'DISABLED')+'\nBluetooth PP1 upload: '+(env.HOOOP_ALLOW_BLE_SEND==='1'?'ENABLED':'DISABLED')+'\n');
 return{server:srv,address,auth};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startCompanion().catch(e=>{console.error('Hooop Companion:',e.message);process.exitCode=1});
