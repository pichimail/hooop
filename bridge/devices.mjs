/** Device discovery is deliberately distinct from protocol compatibility.
 * USB drive discovery means a file can be copied, not that a machine is controllable.
 * mDNS services mean a LAN endpoint advertises itself, not that we may send a job.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import dgram from 'node:dgram';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);
export const deviceId=(prefix,value)=>prefix+'-'+crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
export function volumeRoots(platform=process.platform,env=process.env){
  if(platform==='darwin')return ['/Volumes'];
  if(platform==='win32')return Array.from({length:23},(_,i)=>String.fromCharCode(68+i)+':\\');
  const name=env.USER||env.LOGNAME||'';
  return ['/media/'+name,'/run/media/'+name,'/mnt'];
}
export async function listVolumes({roots=volumeRoots(),platform=process.platform}={}){
  const found=[];
  for(const root of roots){
    let candidate=[];
    if(platform==='win32'||roots.includes(root)&&root.endsWith(':\\'))candidate=[root];
    else{
      try{candidate=(await fs.readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()&&!x.isSymbolicLink()).map(x=>path.join(root,x.name));}catch{continue;}
    }
    for(const mount of candidate){
      try{
        const real=await fs.realpath(mount);const stat=await fs.stat(real);
        if(!stat.isDirectory())continue;
        await fs.access(real,fs.constants.R_OK);
        found.push({id:deviceId('volume',real),name:path.basename(real)||real,kind:'usb-volume',path:real,connected:true,mode:'file-transfer',capability:'Write an embroidery file to the selected drive; machine protocol is not inferred.'});
      }catch{}
    }
  }
  return found;
}
export const MDNS_TYPES=['_embroidery._tcp.local','_http._tcp.local','_ipp._tcp.local'];
export function dnsQuery(name){
  const parts=name.split('.');const length=12+parts.reduce((s,p)=>s+1+Buffer.byteLength(p),1)+4;
  const b=Buffer.alloc(length);b.writeUInt16BE(0,0);b.writeUInt16BE(1,4);let i=12;
  for(const part of parts){const n=Buffer.byteLength(part);if(n>63)throw Error('DNS label too long');b[i++]=n;b.write(part,i);i+=n;}b[i++]=0;b.writeUInt16BE(12,i);i+=2;b.writeUInt16BE(1,i);return b;
}
function readDnsName(buf,offset,depth=0){
  if(depth>12||offset>=buf.length)throw Error('Invalid DNS name');const parts=[];let pos=offset;
  for(let n=0;n<90;n++){
    if(pos>=buf.length)throw Error('Invalid DNS packet');const len=buf[pos++];
    if(len===0)return{name:parts.join('.'),end:pos};
    if((len&0xc0)===0xc0){if(pos>=buf.length)throw Error('Bad pointer');const jump=((len&0x3f)<<8)|buf[pos++];const v=readDnsName(buf,jump,depth+1);return{name:[...parts,v.name].filter(Boolean).join('.'),end:pos};}
    if(len>63||pos+len>buf.length)throw Error('Bad label');parts.push(buf.toString('utf8',pos,pos+len));pos+=len;
  }
  throw Error('DNS recursion');
}
export function decodeMdns(data){
  const results=[];if(data.length<12)return results;
  try{
    let at=12;const questions=data.readUInt16BE(4),count=[6,8,10].reduce((s,p)=>s+data.readUInt16BE(p),0);
    for(let i=0;i<questions;i++){const q=readDnsName(data,at);at=q.end+4;if(at>data.length)return [];}
    for(let i=0;i<Math.min(128,count);i++){
      const name=readDnsName(data,at);at=name.end;if(at+10>data.length)break;
      const type=data.readUInt16BE(at),size=data.readUInt16BE(at+8);at+=10;const end=at+size;if(end>data.length)break;
      if(type===12||type===33){let target=readDnsName(data,at+(type===33?6:0)).name;
        if(type===33){const port=data.readUInt16BE(at+4);results.push({name:name.name,target,port,kind:'mdns-service',supported:false});}
        else results.push({name:target,service:name.name,kind:'mdns-service',supported:false});}
      at=end;
    }
  }catch{return [];}
  return results;
}
export async function discoverLan({timeoutMs=1200,createSocket=dgram.createSocket}={}){
  const socket=createSocket({type:'udp4',reuseAddr:true});const found=new Map();
  return await new Promise(resolve=>{
    let done=false;const finish=()=>{if(done)return;done=true;try{socket.close()}catch{}resolve([...found.values()].slice(0,50));};
    socket.on('message',message=>{for(const item of decodeMdns(message)){
      // Never infer a vendor-specific transfer protocol from generic mDNS.
      if(!/_embroidery|_ipp|_http/i.test(item.name+' '+(item.service||'')))continue;
      const key=item.name+'|'+(item.service||'');found.set(key,{...item,id:deviceId('lan',key),mode:'discovery-only',note:'Presence discovered; transfer protocol not verified.'});
    }});
    socket.on('error',finish);
    try{socket.bind(0,()=>{
      try{socket.addMembership('224.0.0.251');socket.setMulticastTTL(1);for(const name of MDNS_TYPES){const q=dnsQuery(name);socket.send(q,5353,'224.0.0.251',()=>{});} }catch{}
    });}catch{finish()}
    setTimeout(finish,Math.max(100,Math.min(5000,timeoutMs))).unref?.();
  });
}
export async function discoverBluetooth({cli='zigzag',seconds=6}={}){
  const args=['discover','--scan',String(Math.min(15,Math.max(2,seconds)))];
  try{
    const {stdout}=await execFileAsync(cli,args,{timeout:26000,maxBuffer:1024*300,windowsHide:true});
    const data=JSON.parse(stdout);
    return{status:'available',devices:Array.isArray(data.devices)?data.devices.slice(0,70).map(d=>({...d,mode:d.protocol==='skitch'?'supported-pp1':'discovery-only'})):[]};
  }catch(e){return{status:'unavailable',devices:[],detail:'Install the Hooop Bluetooth-enabled CLI and grant Bluetooth permission. '+String(e.message).slice(0,170)};}
}
