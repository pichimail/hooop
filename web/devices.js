/* Machine hub & paired phone control. No simulated device statuses. */
if(location.pathname.replace(/\/+$/,'')==='/devices'){
 const $=s=>document.querySelector(s),tokenKey='hooop-bridge-token';let token=sessionStorage.getItem(tokenKey)||'',bridge=false,profiles=[],snapshot={volumes:[],bluetooth:{devices:[]},lan:[]},job=null,refreshHandle=null;
 const status=(msg)=>{$('#pair-message').textContent=msg};
 function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n}
 async function api(path,{method='GET',body,needToken=true}={}){
  const headers={'Content-Type':'application/json'};if(needToken&&token)headers.Authorization='Bearer '+token;
  const res=await fetch('/api/bridge/'+path,{method,headers,body:body!==undefined?JSON.stringify(body):undefined,cache:'no-store'});let data;try{data=await res.json()}catch{throw Error('Companion did not return JSON')};if(!res.ok)throw Error(data.error||res.statusText);return data;
 }
 function canUseBridge(){if(!bridge)throw Error('Start Hooop Companion on your desktop and open its HTTPS phone link. Cloud-only studio cannot access machine hardware.');if(!token)throw Error('Enter your desktop pairing code first.');}
 async function loadProfiles(){
  let data;try{data=await fetch('/machine-profiles.json').then(r=>r.json())}catch{data={machines:[]}}
  profiles=data.machines||[];renderProfiles();
 }
 function renderProfiles(){
  const selected=$('#machine-profile'),transfer=$('#transfer-profile');const last=selected.value||'brother-skitch',previous=transfer.value||last;
  for(const box of [selected,transfer]){box.replaceChildren();for(const p of profiles){const o=el('option','',p.name);o.value=p.id;box.append(o)}}
  selected.value=profiles.find(x=>x.id===last)?last:profiles[0]?.id||'';
  transfer.value=profiles.find(x=>x.id===previous)?previous: selected.value;showProfile();
 }
 function showProfile(){const p=profiles.find(x=>x.id===$('#machine-profile').value);const target=$('#profile-details');target.replaceChildren();if(!p)return;
  target.append(el('b','',p.name),document.createElement('br'));
  target.append(el('span','pill',p.format?'.'+p.format.toUpperCase():'FORMAT UNVERIFIED'),el('span','pill',p.direct_control?'PP1 BLE ADAPTER':'FILE-BASED'),el('span','pill',p.tested?'PHYSICALLY TESTED':'NOT DEVICE-TESTED'));
  target.append(el('div','',`Hoops: ${(p.hoops||[]).join(' · ')} mm`),el('div','',`Minimum stitch: ${p.min_stitch_mm||'machine default'} mm · Stitch limit: not verified`),el('div','',p.compatibility_note||'Profile only.'));
 }
 $('#machine-profile').addEventListener('change',()=>{$('#transfer-profile').value=$('#machine-profile').value;showProfile()});$('#transfer-profile').addEventListener('change',()=>{$('#machine-profile').value=$('#transfer-profile').value;showProfile()});
 function badge(text,ok){const b=$('#bridge-badge');b.textContent=text;b.style.borderColor=ok?'#8daaa0':'#dfe2dc'}
 async function connect(){
  try{const data=await api('health',{needToken:false});bridge=Boolean(data.connected);badge('DESKTOP COMPANION ONLINE',true);
   if(token){try{await api('session');status('Paired. Use Scan to discover actual nearby devices.');await refresh()}catch{token='';sessionStorage.removeItem(tokenKey);status('Previous pairing expired. Enter the new code shown by the desktop.')}}
   else status('Enter the pairing code printed by your Hooop Companion on the desktop.');
  }catch{bridge=false;badge('CLOUD EDITION · NO DESKTOP LINK',false);status('Open this page through the HTTPS address printed by your running desktop companion. The public site cannot discover or control hardware. Run: node bridge/server.mjs (see bridge/README.md).');}
 }
 $('#pair-button').addEventListener('click',async()=>{
  try{if(!bridge)throw Error('Companion not detected. Open the desktop bridge HTTPS URL.');const data=await api('pair',{method:'POST',body:{pin:$('#pair-pin').value},needToken:false});token=data.token;sessionStorage.setItem(tokenKey,token);$('#pair-pin').value='';status('Paired successfully. Device sessions expire after eight hours.');await refresh();}
  catch(e){status(e.message)}
 });
 $('#disconnect-companion').addEventListener('click',async()=>{try{if(token&&bridge)await api('session',{method:'DELETE'})}catch{}token='';sessionStorage.removeItem(tokenKey);badge('NOT PAIRED',false);status('Pairing forgotten on this phone.');$('#discovery-list').replaceChildren();$('#activity-list').replaceChildren()});
 $('#copy-companion-url').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+'/devices/');status('Phone link copied. Use the HTTPS companion URL, not the public cloud page.')}catch{status(location.origin+'/devices/')}});
 $('#share-companion-url').addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title:'Hooop Companion',url:location.origin+'/devices/'})}catch{}}else $('#copy-companion-url').click()});
 function deviceRow(name,subtitle,capability){const row=el('div','device-item'),main=el('div');main.append(el('div','',name),el('small','',subtitle));row.append(main,el('span','',capability));return row}
 function renderDiscovery(){const list=$('#discovery-list');list.replaceChildren();let total=0;
  for(const d of snapshot.bluetooth?.devices||[]){list.append(deviceRow(d.name||'Unnamed BLE peripheral',`Bluetooth · ${d.service_count||0} advertised services`,d.protocol==='skitch'?'PP1 PROTOCOL':'DISCOVERY ONLY'));total++}
  for(const d of snapshot.volumes||[]){list.append(deviceRow(d.name,`USB/mounted drive · ${d.path||'Volume'}`,'FILE COPY'));total++}
  for(const d of snapshot.lan||[]){list.append(deviceRow(d.name||d.target||'LAN service',`mDNS · ${d.service||'discovery'}`,'UNVERIFIED'));total++}
  if(!total)list.append(el('div','hint','No devices discovered. This is an actual scan result, not a simulated machine list.'));
  const method=$('#transfer-method').value;const sel=$('#transfer-target');sel.replaceChildren();sel.append(new Option('Select destination',''));
  const targets=method==='usb-file'?snapshot.volumes||[]:method==='configured-lan-http'?(snapshot.lanTargets||[]):[];
  for(const d of targets)sel.append(new Option(d.name,d.id));
  if(method==='configured-lan-http'&&!targets.length)sel.append(new Option('No approved HTTPS receiver configured',''));
  if(method==='ble-skitch')sel.append(new Option('Brother Skitch PP1 (pair locally)','brother-skitch'));
 }
 $('#transfer-method').addEventListener('change',renderDiscovery);
 document.querySelectorAll('[data-discover]').forEach(button=>button.addEventListener('click',async()=>{
  const type=button.dataset.discover;try{canUseBridge();button.disabled=true;$('#discovery-status').textContent='Scanning real '+type.toUpperCase()+' hardware…';
   const data=await api('discover',{method:'POST',body:{type}});snapshot=data.snapshot;renderDiscovery();$('#discovery-status').textContent=`${type.toUpperCase()} scan completed · ${new Date(data.snapshot.updated).toLocaleTimeString()}. Generic devices are discovery-only until a compatible protocol is verified.`;
  }catch(e){$('#discovery-status').textContent=e.message}finally{button.disabled=false}
 }));
 $('#browser-ble').addEventListener('click',async()=>{
  try{if(!navigator.bluetooth?.requestDevice)throw Error('Web Bluetooth is unavailable here (for example, Safari/iOS). Use desktop Bluetooth scanning.');const device=await navigator.bluetooth.requestDevice({acceptAllDevices:true});$('#discovery-list').prepend(deviceRow(device.name||'Unnamed BLE device','Phone browser discovery; no Hooop control adapter','DISCOVERY ONLY'));
  }catch(e){$('#discovery-status').textContent=e.message}
 });
 function renderActivity(events=[]){const list=$('#activity-list');list.replaceChildren();if(!events.length){list.append(el('li','hint','No activity recorded on this desktop session.'));return}
  for(const ev of events.slice(0,20)){const li=el('li');li.append(el('time','',new Date(ev.time).toLocaleTimeString()),el('span','',ev.type+' · '+ev.detail));list.append(li)}
 }
 async function refresh(){try{canUseBridge();const data=await api('status');snapshot=data.snapshot||snapshot;renderDiscovery();renderActivity(data.events);$('#machine-status').textContent=`Bridge online · ${data.jobs.length} conversion jobs · Remote transfers ${data.remoteWrite?'enabled':'disabled'} · BLE PP1 upload ${data.bluetoothTransfer?'enabled':'disabled'}`;}
 catch(e){$('#machine-status').textContent=e.message;}}
 $('#refresh-monitor').addEventListener('click',refresh);
 $('#poll-pp1').addEventListener('click',async()=>{try{canUseBridge();$('#machine-status').textContent='Reading Brother PP1 Bluetooth status…';const d=await api('skitch-status',{method:'POST',body:{}});$('#machine-status').textContent=d.connected?d.raw:d.error;}catch(e){$('#machine-status').textContent=e.message}});
 const allowedTypes={'image/svg+xml':true,'image/png':true,'image/jpeg':true,'image/webp':true};
 async function base64(f){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(f)})}
 function pollJob(id){return new Promise((resolve,reject)=>{let n=0;const tick=async()=>{try{const data=await api('jobs/'+id);job=data.job;$('#convert-status').textContent=`${job.name} · ${job.state} · ${job.progress}%${job.error?' — '+job.error:''}`;
   if(job.state==='ready')resolve(job);else if(job.state==='failed')reject(Error(job.error));else if(n++>=160)reject(Error('Job timed out in the browser; refresh monitoring for status.'));else setTimeout(tick,800);
  }catch(e){reject(e)}};tick()})}
 $('#convert-file').addEventListener('click',async()=>{const button=$('#convert-file');try{canUseBridge();const file=$('#machine-file').files?.[0];if(!file)throw Error('Choose an artwork file first');if(!allowedTypes[file.type]||file.size>4*1024*1024)throw Error('Use SVG/PNG/JPEG/WebP smaller than 4 MB');const profile=profiles.find(x=>x.id===$('#transfer-profile').value);if(!profile?.format)throw Error('This machine profile has no verified export format');
   button.disabled=true;$('#convert-status').textContent='Uploading to local Rust converter…';const r=await api('convert',{method:'POST',body:{mime:file.type,data:await base64(file),profile:profile.id,name:file.name.replace(/\.[^.]+$/,'')}});const completed=await pollJob(r.job.id);
   const res=await fetch('/api/bridge/jobs/'+completed.id+'/file',{headers:{Authorization:'Bearer '+token}});if(!res.ok)throw Error('Could not download finished file');const blob=await res.blob();const u=URL.createObjectURL(blob),anchor=$('#download-machine-file');if(anchor.href.startsWith('blob:'))URL.revokeObjectURL(anchor.href);anchor.href=u;anchor.download=completed.filename;anchor.classList.remove('hidden');$('#send-machine-file').disabled=false;$('#convert-status').textContent=`Ready: ${completed.filename} · ${completed.bytes} bytes. Check the design before machine transfer.`;
  }catch(e){$('#convert-status').textContent=e.message}finally{button.disabled=false}
 });
 $('#send-machine-file').addEventListener('click',async()=>{try{canUseBridge();if(!job||job.state!=='ready')throw Error('Convert a design first.');if(!$('#confirm-transfer').checked)throw Error('Review and explicitly approve the machine transfer first.');const method=$('#transfer-method').value,target=$('#transfer-target').value;if(!target)throw Error('Choose the mounted volume or configured receiver.');
   const d=await api('transfer',{method:'POST',body:{job_id:job.id,method,target,confirm:true}});$('#transfer-status').textContent='Transfer started; refresh activity to see final status.';setTimeout(async()=>{try{const v=await api('jobs/'+job.id);$('#transfer-status').textContent='Transfer: '+(v.job.transferState||'pending')+(v.job.transferError?' — '+v.job.transferError:'');}catch{}},1800);
  }catch(e){$('#transfer-status').textContent=e.message}
 });
 loadProfiles().then(connect);
 refreshHandle=setInterval(()=>{if(token&&bridge&&document.visibilityState==='visible')refresh().catch(()=>{})},12000);
 window.addEventListener('pagehide',()=>clearInterval(refreshHandle),{once:true});
}
