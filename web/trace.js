/** Deterministic local raster-to-vector trace for embroidery logos/flat artwork.
 * Connected components + boundary tracing; outputs real editable SVG paths.
 * It is not machine digitization or photographic pixel-exact reproduction.
 */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hex=c=>'#'+c.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
const distance=(a,b)=>{let d=0;for(let i=0;i<3;i++)d+=(a[i]-b[i])**2;return d};
function palette(image,colors,background){
 const {data,width:w,height:h}=image;const samples=[];
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const j=(y*w+x)*4;
  if(data[j+3]<110)continue;const c=[data[j],data[j+1],data[j+2]];
  if(background&&distance(c,background)<550)continue;
  samples.push(c);}
 if(!samples.length)return[];
 // Deterministic farthest-first seed, then centroid refinement (no network, no ML billing).
 const centers=[samples[Math.floor(samples.length/2)]];
 for(let n=1;n<colors;n++){let best=null,score=-1;for(let k=0;k<samples.length;k+=3){const c=samples[k],d=Math.min(...centers.map(v=>distance(c,v)));if(d>score){best=c;score=d}}if(!best||score<100)break;centers.push(best)}
 for(let t=0;t<7;t++){
  const sums=centers.map(()=>[0,0,0,0]);for(const s of samples){let id=0,best=Infinity;centers.forEach((v,i)=>{const d=distance(v,s);if(d<best){best=d;id=i}});for(let j=0;j<3;j++)sums[id][j]+=s[j];sums[id][3]++}
  centers.forEach((v,i)=>{if(sums[i][3])for(let j=0;j<3;j++)v[j]=sums[i][j]/sums[i][3]});
 }
 return centers;
}
function estimateBackground(image){
 const {data,width:w,height:h}=image;const points=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),0],[Math.floor(w/2),h-1]];
 const candidates=points.filter(([x,y])=>data[(y*w+x)*4+3]>100).map(([x,y])=>[...data.slice((y*w+x)*4,(y*w+x)*4+3)]);
 if(candidates.length<4)return null;let best=candidates[0],votes=0;
 for(const c of candidates){let count=candidates.filter(t=>distance(t,c)<1800).length;if(count>votes){votes=count;best=c}}
 return votes>=4?best:null;
}
function simplifyPoints(points,tolerance=1){
 // Collapse straight edges (the raster grid already produced exact boundaries).
 if(points.length<4)return points;
 const keep=[];for(let i=0;i<points.length;i++){
  const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
  const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cross)>tolerance)keep.push(b);
 }
 return keep.length>=3?keep:points;
}
function edgesToPaths(cells,w,h,index){
 const edges=new Map();const add=(a,b)=>{const key=a.join(',');if(!edges.has(key))edges.set(key,[]);edges.get(key).push(b)};
 for(const pixel of cells){const x=pixel%w,y=Math.floor(pixel/w);
  if(y===0||index[pixel-w]!==index[pixel])add([x,y],[x+1,y]);
  if(x===w-1||index[pixel+1]!==index[pixel])add([x+1,y],[x+1,y+1]);
  if(y===h-1||index[pixel+w]!==index[pixel])add([x+1,y+1],[x,y+1]);
  if(x===0||index[pixel-1]!==index[pixel])add([x,y+1],[x,y]);
 }
 const outlines=[];
 while(edges.size){const start=edges.keys().next().value;let key=start,pts=[];let stop=0;
  while(edges.has(key)&&stop++<w*h*4){const outgoing=edges.get(key),next=outgoing.pop();if(!outgoing.length)edges.delete(key);pts.push(key.split(',').map(Number));key=next.join(',');if(key===start)break;}
  if(pts.length>=4&&key===start)outlines.push(simplifyPoints(pts));
 }
 return outlines;
}
/**
 * @param {{data:Uint8ClampedArray,width:number,height:number}} image
 * @param {{colors?:number,removeBackground?:boolean,minArea?:number,maxObjects?:number,x?:number,y?:number,width?:number,height?:number}} options
 */
export function traceImageData(image,options={}){
 const w=image?.width,h=image?.height,data=image?.data;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>350000||!data||data.length<w*h*4)throw Error('Use a decoded image smaller than 350k pixels');
 const colors=clamp(Number(options.colors)||5,2,10),minArea=clamp(Number(options.minArea)||10,2,400),maxObjects=clamp(Number(options.maxObjects)||260,1,400);
 const bg=options.removeBackground===false?null:estimateBackground(image);
 const centers=palette(image,colors,bg);if(!centers.length)return{items:[],colors:[],regions:0,background:bg&&hex(bg)};
 const ids=new Int16Array(w*h);ids.fill(-1);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x,j=p*4;if(data[j+3]<110)continue;
  const rgb=[data[j],data[j+1],data[j+2]];
  if(bg&&distance(rgb,bg)<(Number(options.backgroundTolerance)||900))continue;
  let index=0,best=Infinity;centers.forEach((v,i)=>{const d=distance(rgb,v);if(d<best){best=d;index=i}});ids[p]=index;
 }
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),components=[];
 for(let p=0;p<w*h;p++){
  if(seen[p]||ids[p]<0)continue;const label=ids[p];let head=0,tail=1;queue[0]=p;seen[p]=1;const pixels=[];
  while(head<tail){const v=queue[head++],x=v%w,y=Math.floor(v/w);pixels.push(v);
   for(const n of [x>0?v-1:-1,x<w-1?v+1:-1,y>0?v-w:-1,y<h-1?v+w:-1]){if(n>=0&&!seen[n]&&ids[n]===label){seen[n]=1;queue[tail++]=n}}
  }
  if(pixels.length>=minArea)components.push({label,pixels,area:pixels.length});
 }
 components.sort((a,b)=>b.area-a.area);
 const sx=(Number(options.width)||550)/w,sy=(Number(options.height)||430)/h,ox=Number(options.x)||125,oy=Number(options.y)||100;
 const round=n=>+n.toFixed(2);
 const items=[];for(const comp of components.slice(0,maxObjects)){
  const paths=edgesToPaths(comp.pixels,w,h,ids);if(!paths.length)continue;
  const d=paths.map(points=>'M'+points.map(([px,py])=>`${round(ox+px*sx)},${round(oy+py*sy)}`).join(' L')+' Z').join(' ');
  items.push({type:'path',name:'Image region '+(items.length+1),d,x:0,y:0,w:round(w*sx),h:round(h*sy),fill:hex(centers[comp.label]),stroke:hex(centers[comp.label]),sw:0,fillRule:'evenodd'});
 }
 return {items,colors:centers.map(hex),regions:components.length,omitted:Math.max(0,components.length-items.length),background:bg&&hex(bg)};
}
