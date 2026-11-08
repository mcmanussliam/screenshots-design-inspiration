#!/usr/bin/env node
// One-time / maintainer-side audit. Never changes, crops or recompresses originals.
// Run on a FULL checkout: node scripts/scan-image-dimensions.mjs --scan
import {readFileSync,writeFileSync,openSync,readSync,closeSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const manifestFile=resolve(root,'data/image-dimensions.json');
const formats=/\.(png|jpe?g|gif|webp)$/i;
function readHead(path,bytes=256*1024){
 const fd=openSync(path,'r'),buffer=Buffer.allocUnsafe(bytes);
 try{const len=readSync(fd,buffer,0,bytes,0);return buffer.subarray(0,len);}
 finally{closeSync(fd);}
}
export function measureImage(buffer){
 if(buffer.length<10)return null;
 if(buffer.length>=24&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  if(buffer.toString('ascii',12,16)!=='IHDR')return null;
  return checked(buffer.readUInt32BE(16),buffer.readUInt32BE(20));
 }
 if(buffer.toString('ascii',0,3)==='GIF'&&buffer.length>=10)
  return checked(buffer.readUInt16LE(6),buffer.readUInt16LE(8));
 if(buffer[0]===255&&buffer[1]===216){
  let offset=2;
  const frames=new Set([192,193,194,195,197,198,199,201,202,203,205,206,207]);
  while(offset+4<buffer.length){
   if(buffer[offset]!==255){offset++;continue;}
   while(buffer[offset]===255)offset++;
   const type=buffer[offset++];
   if(type===217||type===218)break;
   if(type===216||type===1||(type>=208&&type<=215))continue;
   if(offset+2>buffer.length)break;
   const length=buffer.readUInt16BE(offset);
   if(length<2||offset+length>buffer.length)break;
   if(frames.has(type)&&length>=7)return checked(buffer.readUInt16BE(offset+3),buffer.readUInt16BE(offset+5));
   offset+=length;
  }
 }
 if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'){
  const id=buffer.toString('ascii',12,16);
  if(id==='VP8X'&&buffer.length>=30){
   return checked(1+buffer.readUIntLE(24,3),1+buffer.readUIntLE(27,3));
  }
  if(id==='VP8L'&&buffer.length>=25){
   const bits=buffer.readUInt32LE(21);
   return checked((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);
  }
  if(id==='VP8 '&&buffer.length>=30){
   return checked(buffer.readUInt16LE(26)&0x3fff,buffer.readUInt16LE(28)&0x3fff);
  }
 }
 return null;
}
function checked(width,height){
 return Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&
 width<=100000&&height<=100000?{width,height}:null;
}
function collect(){
 const files=execFileSync('git',['ls-tree','-r','--name-only','HEAD'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024})
  .split('\n').filter(p=>p.startsWith('design/')&&formats.test(p));
 const old=JSON.parse(readFileSync(manifestFile,'utf8'));
 const images={};const missing=[],unknown=[];
 for(const file of files){
  const full=resolve(root,file);
  if(!existsSync(full)){missing.push(file);continue;}
  let dimensions;
  try{dimensions=measureImage(readHead(full));}catch{dimensions=null;}
  if(!dimensions){unknown.push(file);continue;}
  images[file]=dimensions;
 }
 const report={files:files.length,measured:Object.keys(images).length,
  missing:missing.length,unsupported:unknown.length,examples:[...missing,...unknown].slice(0,12)};
 if(files.length&&!report.measured)throw new Error('No images measured; use a full Git checkout, not a sparse metadata checkout.');
 if(process.argv.includes('--scan')){
  writeFileSync(manifestFile,JSON.stringify({version:1,images:Object.fromEntries(Object.entries(images).sort(([a],[b])=>a.localeCompare(b)))},null,2)+'\n');
 }
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 if(!process.argv.includes('--scan')&&!process.argv.includes('--dry-run')){
  console.error('Usage: node scripts/scan-image-dimensions.mjs --scan|--dry-run');process.exit(2);
 }
 collect();
}
