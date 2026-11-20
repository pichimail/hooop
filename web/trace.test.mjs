import test from 'node:test';import assert from 'node:assert/strict';import {traceImageData} from './trace.js';
function pixels(w,h,paint){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [r,g,b,a]=paint(x,y);data.set([r,g,b,a],(y*w+x)*4)}return {width:w,height:h,data}}
test('Vectorizes real color regions to editable SVG without API calls',()=>{
 const src=pixels(36,24,(x,y)=>x>9&&x<28&&y>5&&y<19?[220,55,35,255]:[255,255,255,255]);const r=traceImageData(src,{removeBackground:true,colors:3,minArea:5});
 assert.ok(r.items.length>=1);assert.equal(r.items[0].type,'path');assert.match(r.items[0].d,/^M[\d,.\sLZ]+$/);assert.ok(r.items[0].d.length>20);assert.ok(r.colors.length);
});
test('Transparent image and completely blank background have no phantom regions',()=>{
 const src=pixels(14,14,()=>[0,0,0,0]);assert.equal(traceImageData(src).items.length,0);
});
test('Connected color regions retain separate contours and bounded objects',()=>{
 const src=pixels(24,24,(x,y)=>[Math.abs(x-5)<3&&Math.abs(y-5)<3||Math.abs(x-18)<3&&Math.abs(y-18)<3?0:255,60,60,255]);const r=traceImageData(src,{removeBackground:false,minArea:5,maxObjects:2});assert.ok(r.items.length<=2);assert.equal(r.items.length,2);
});
