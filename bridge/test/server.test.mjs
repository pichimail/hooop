import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createCompanion} from '../server.mjs';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="80" height="80" fill="red"/></svg>';
const input={name:'test-design',profile:'brother-4x4',mime:'image/svg+xml',data:Buffer.from(svg).toString('base64')};
async function setup({write=false}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hooop-test-drive-'));
 const fakeVolume={id:'volume-test',name:'USB-STICK',path:root,kind:'usb-volume'};
 let calls=[];
 const c=createCompanion({env:{HOOOP_LOCAL_PIN:'123456',HOOOP_ALLOW_REMOTE_TRANSFER:write?'1':'0'},cli:'fake-zigzag',usbFinder:async()=>[fakeVolume],lanFinder:async()=>[],bleFinder:async()=>({status:'available',devices:[]}),runNative:async args=>{calls.push(args);
  if(args[0]==='convert'){await fs.writeFile(args[3],Buffer.alloc(150,0x23));return{stdout:'wrote '+args[3]}}
  return{stdout:'status: Idle, stitch 1, 0s'};
 }});
 await new Promise(r=>c.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+c.server.address().port;
 const close=async()=>{await new Promise(r=>c.server.close(r));await fs.rm(root,{recursive:true,force:true})};
 return{...c,url,calls,root,close};
}
async function request(s,path,{method='GET',body,token,origin}={}){
 const r=await fetch(s.url+'/api/bridge/'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('Bridge API requires pairing; rejects cross-origin requests',async()=>{
 const s=await setup();try{
  assert.equal((await request(s,'health')).status,200);
  assert.equal((await request(s,'profiles')).status,401);
  assert.equal((await request(s,'pair',{method:'POST',body:{pin:'123456'},origin:'https://evil.example'})).status,403);
  const pair=await request(s,'pair',{method:'POST',body:{pin:'123456'}});assert.equal(pair.status,200);
  assert.equal((await request(s,'profiles',{token:pair.data.token})).data.machines.length,9);
  assert.equal((await request(s,'status',{token:pair.data.token})).data.remoteWrite,false);
 }finally{await s.close()}
});
test('Real native adapter invocation creates downloadable machine file; remote copy is opt-in',async()=>{
 const s=await setup({write:true});try{
  const token=(await request(s,'pair',{method:'POST',body:{pin:'123456'}})).data.token;
  assert.equal((await request(s,'convert',{method:'POST',body:{...input,profile:'unknown'},token})).status,400);
  const started=await request(s,'convert',{method:'POST',body:input,token});assert.equal(started.status,202,JSON.stringify(started.data));
  let job;for(let i=0;i<30;i++){job=(await request(s,'jobs/'+started.data.job.id,{token})).data.job;if(job.state!=='digitizing'&&job.state!=='preparing')break;await sleep(20)}
  assert.equal(job.state,'ready');assert.equal(s.calls[0][0],'convert');assert.deepEqual(s.calls[0].slice(-2),['--machine','brother-4x4']);
  const output=await fetch(s.url+'/api/bridge/jobs/'+job.id+'/file',{headers:{Authorization:'Bearer '+token}});assert.equal(output.status,200);assert.equal((await output.arrayBuffer()).byteLength,150);
  assert.equal((await request(s,'transfer',{method:'POST',body:{job_id:job.id,method:'usb-file',target:'volume-test'},token})).status,400);
  assert.equal((await request(s,'transfer',{method:'POST',body:{job_id:job.id,method:'ble-skitch',target:'x',confirm:true},token})).status,403);
  const t=await request(s,'transfer',{method:'POST',body:{job_id:job.id,method:'usb-file',target:'volume-test',confirm:true},token});assert.equal(t.status,202);
  let transferState;for(let i=0;i<60;i++){transferState=(await request(s,'jobs/'+job.id,{token})).data.job.transferState;if(transferState==='completed'||transferState==='failed')break;await sleep(30)}
  assert.equal(transferState,'completed');assert.equal((await fs.readFile(path.join(s.root,'test-design.pes'))).byteLength,150);
 }finally{await s.close()}
});
test('Bridge does not expose unapproved transfers or arbitrary external URLs',async()=>{
 const s=await setup();try{const token=(await request(s,'pair',{method:'POST',body:{pin:'123456'}})).data.token;
  assert.equal((await request(s,'transfer',{method:'POST',body:{job_id:'x',confirm:true,method:'configured-lan-http',target:'http://evil'},token})).status,403);
  assert.equal((await request(s,'vision',{method:'POST',body:{mime:'image/png',data:'AAAA'},token})).status,501);
 }finally{await s.close()}
});
