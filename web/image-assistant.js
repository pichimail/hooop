import {traceImageData} from './trace.js';
const panel=document.querySelector('#image-assistant');
if(panel){
 const q=s=>panel.querySelector(s),open=document.querySelector('#open-image-assistant'),mobile=document.querySelector('#mobile-image-import');
 const picker=q('#image-upload'),preview=q('#image-preview'),status=q('#trace-status'),analyze=q('#image-analyze'),trace=q('#image-trace');
 let file=null,encoded=null,bitmap=null;
 const show=()=>{panel.classList.remove('hidden');q('#image-close').focus()};
 const close=()=>{panel.classList.add('hidden');open.focus()};
 open.addEventListener('click',show);mobile?.addEventListener('click',show);q('#image-close').addEventListener('click',close);
 panel.addEventListener('click',e=>{if(e.target===panel)close()});panel.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 async function readImage(f){
  if(!f||!['image/png','image/jpeg','image/webp','image/gif','image/bmp'].includes(f.type)||f.size>8*1024*1024)throw Error('Choose PNG/JPG/WebP/GIF/BMP smaller than 8 MB');
  if(bitmap?.close)bitmap.close();bitmap=await createImageBitmap(f);if(bitmap.width*bitmap.height>36_000_000)throw Error('Image resolution is too large');
  file=f;encoded=null;const url=URL.createObjectURL(f);preview.src=url;preview.onload=()=>URL.revokeObjectURL(url);preview.classList.remove('hidden');
  status.textContent=`${f.name} · ${bitmap.width}×${bitmap.height} px. Original stays on this device unless you request cloud analysis.`;trace.disabled=false;analyze.disabled=false;
 }
 picker.addEventListener('change',async e=>{try{await readImage(e.target.files?.[0])}catch(err){status.textContent=err.message}e.target.value=''});
 trace.addEventListener('click',async()=>{
  if(!bitmap)return;trace.disabled=true;status.textContent='Tracing color regions locally…';
  try{await new Promise(r=>setTimeout(r,20));const canvas=document.createElement('canvas');let scale=Math.min(200/bitmap.width,180/bitmap.height,1);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const result=traceImageData(ctx.getImageData(0,0,canvas.width,canvas.height),{colors:Number(q('#trace-colors').value),removeBackground:q('#trace-bg').checked,minArea:Number(q('#trace-detail').value),width:520,height:420,x:140,y:100});
   if(!result.items.length)throw Error('No contours detected. Try keeping the background or lowering the detail threshold.');
   window.HooopStudio.importTraced(result.items,(file.name.replace(/\.[^.]+$/,'')||'Traced image'));
   status.textContent=`Created ${result.items.length} editable color regions from ${result.colors.length} thread-color suggestions. ${result.omitted?result.omitted+' tiny contours omitted. ':''}Review details and run the native stitch exporter before sewing.`;
  }catch(err){status.textContent=err.message}finally{trace.disabled=false}
 });
 analyze.addEventListener('click',async()=>{
  if(!file)return;if(!q('#cloud-consent').checked){status.textContent='Confirm cloud sharing before optional AI image analysis.';return}
  analyze.disabled=true;status.textContent='Consulting the configured vision model through your desktop bridge…';
  try{
   const token=sessionStorage.getItem('hooop-bridge-token');if(!token)throw Error('Pair the browser with your Hooop Companion first (/devices/). Local tracing works without pairing.');
   if(file.size>2*1024*1024)throw Error('For cloud analysis choose an image under 2 MB. Local tracing accepts up to 8 MB.');
   if(!encoded)encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
   const res=await fetch('/api/bridge/vision',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({mime:file.type,data:encoded})});const data=await res.json();if(!res.ok)throw Error(data.error||'Vision analysis failed');q('#vision-output').textContent=data.analysis;q('#vision-output').classList.remove('hidden');status.textContent='Vision guidance ready. Use Trace into Studio to create editable shapes.';
  }catch(err){status.textContent=err.message}finally{analyze.disabled=false}
 });
}
