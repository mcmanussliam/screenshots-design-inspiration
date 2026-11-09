#!/usr/bin/env node
// Review-first screen capture: public allowlisted pages only, fixed viewport,
// no login or paywall bypass, robots compliance, source attribution.
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {classifyTags} from '../site/scripts/tag-taxonomy.mjs';
const root=resolve(import.meta.dirname,'..');
export const allowedHosts=new Set(['getbootstrap.com']);
export function validateSource(s){
 if(!s||!['ios','android','web'].includes(s.platform)||!/^[a-z0-9-]{3,70}$/.test(s.slug||''))throw Error('Invalid platform or slug');
 if(!allowedHosts.has(s.allowedHost)||!s.allowedPrefix?.startsWith('/'))throw Error('Unapproved source host');
 if(!['CC-BY-3.0','CC-BY-4.0','CC0-1.0','MIT','OWNER-PERMISSION'].includes(s.license)||!s.licenseEvidence||!s.credit||!s.owner)throw Error('Unverified redistribution rights');
 if(s.viewport?.width<320||s.viewport.width>1920||s.viewport.height<500||s.viewport.height>1600||s.viewport.scale!==1)throw Error('Unapproved screenshot viewport');
 if(!Array.isArray(s.screens)||!s.screens.length||s.screens.length>15)throw Error('Invalid capture count');
 const filenames=new Set();
 for(const item of s.screens){
  if(!/^[a-z0-9-]+\.png$/.test(item.filename)||filenames.has(item.filename))throw Error('Unsafe or duplicate filename');
  filenames.add(item.filename);
  const url=new URL(item.url);
  if(url.protocol!=='https:'||url.username||url.password||url.hostname!==s.allowedHost||!url.pathname.startsWith(s.allowedPrefix)||url.search||url.hash)
   throw Error('Unapproved screenshot URL '+item.url);
  const tags=classifyTags(item.tags);
  if(!tags.screen.length&&!tags.element.length||tags.unreviewed.length)throw Error('Unverified screen tags '+item.filename);
 }
 return true;
}
const matchPath=(pattern,path)=>{
 if(!pattern)return false;
 const escaped=pattern.replace(/[^a-zA-Z0-9*\/-]/g,'\\$&').replace(/\*/g,'.*');
 return new RegExp('^'+escaped).test(path);
};
export function allowedByRobots(text,path,agent='OpenScreensBot'){
 const groups=[];let current=null,hasRules=false;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.split('#')[0].trim(),i=line.indexOf(':');
  if(i<0)continue;
  const key=line.slice(0,i).toLowerCase(),value=line.slice(i+1).trim();
  if(key==='user-agent'){
   if(!current||hasRules){current={agents:[],rules:[]};groups.push(current);hasRules=false;}
   current.agents.push(value.toLowerCase());
  }else if((key==='allow'||key==='disallow')&&current){
   hasRules=true;if(value)current.rules.push({key,value});
  }
 }
 const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.toLowerCase().includes(a)));
 const used=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 let best=null;
 for(const g of used)for(const r of g.rules){
  if(!matchPath(r.value,path))continue;
  const n=r.value.replace(/\*/g,'').length;
  if(!best||n>best.n||n===best.n&&r.key==='allow')best={n,kind:r.key};
 }
 return !best||best.kind==='allow';
}
const wait=ms=>new Promise(res=>setTimeout(res,ms));
async function runCapture(){
 const {chromium}=await import('playwright');
 const config=JSON.parse(readFileSync(resolve(root,'data/approved-captures.json'),'utf8'));
 const products=JSON.parse(readFileSync(resolve(root,'data/product-metadata.json'),'utf8'));
 const sizes=JSON.parse(readFileSync(resolve(root,'data/blob-sizes.json'),'utf8'));
 const dimensions=JSON.parse(readFileSync(resolve(root,'data/image-dimensions.json'),'utf8'));
 const provFile=resolve(root,'data/source-provenance.json');
 let provenance={version:1,products:{}};
 try{provenance=JSON.parse(readFileSync(provFile,'utf8'));}catch{}
 const browser=await chromium.launch({headless:true});
 const files=[],records=[],report=[];
 try{
  for(const source of config.entries){
   validateSource(source);
   const robotsResponse=await fetch('https://'+source.allowedHost+'/robots.txt',{signal:AbortSignal.timeout(15000)});
   if(!robotsResponse.ok)throw Error('Robots policy unavailable '+source.allowedHost);
   const robots=await robotsResponse.text();
   const context=await browser.newContext({viewport:{width:source.viewport.width,height:source.viewport.height},
    deviceScaleFactor:1,locale:'en-US',colorScheme:'light',reducedMotion:'reduce',
    userAgent:'OpenScreensBot/1.0 (https://github.com/'+(process.env.GITHUB_REPOSITORY||'mcmanussliam/screenshots-design-inspiration')+')'});
   try{
    const page=await context.newPage(),screens=[];
    for(const item of source.screens){
     const url=new URL(item.url);
     if(!allowedByRobots(robots,url.pathname))throw Error('robots.txt blocks '+item.url);
     await wait(1500);
     const response=await page.goto(item.url,{waitUntil:'domcontentloaded',timeout:35000});
     if(!response?.ok()||new URL(page.url()).origin!==url.origin)throw Error('Page unavailable or redirected '+item.url);
     await page.waitForLoadState('load',{timeout:12000}).catch(()=>{});
     await page.evaluate(()=>document.fonts?.ready).catch(()=>{});
     await wait(600);
     const bytes=await page.screenshot({type:'png',fullPage:false,animations:'disabled',caret:'hide'});
     const path='design/'+source.platform+'/'+source.slug+'/'+item.filename;
     const out=resolve(root,'capture-output',path);
     mkdirSync(dirname(out),{recursive:true});writeFileSync(out,bytes);
     files.push({path,bytes});
     const sha256=createHash('sha256').update(bytes).digest('hex');
     screens.push({source:item.url,file:item.filename,sha256,bytes:bytes.length});
     sizes.files[path]=bytes.length;
     dimensions.images[path]={width:source.viewport.width,height:source.viewport.height};
     console.log('CAPTURED '+path+' '+bytes.length+' bytes '+source.viewport.width+'x'+source.viewport.height);
    }
    const id=source.platform+':'+source.slug;
    products.products[id]={category:source.category,description:source.description,domain:source.domain};
    provenance.products[id]={source:source.source,owner:source.owner,license:source.license,
     licenseEvidence:source.licenseEvidence,licenseUrl:source.licenseUrl,credit:source.credit,
     method:'independent-screenshot-of-approved-public-page',captureDate:new Date().toISOString().slice(0,10),
     viewport:source.viewport,screens};
    const folder='design/'+source.platform+'/'+source.slug+'/';
    const index='---\ngallery-directory: '+source.name+'\ntags: [Dashboard, Login, Checkout, Pricing]\n---\n';
    const tags=Object.fromEntries(source.screens.map(s=>[s.filename,s.tags]));
    records.push({path:folder+'index.html',text:index},{path:folder+'tags.json',text:JSON.stringify(tags,null,2)+'\n'});
    report.push({id,source:source.source,license:source.license,count:screens.length,screens});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
 mkdirSync(resolve(root,'capture-output'),{recursive:true});
 writeFileSync(resolve(root,'capture-output/report.json'),JSON.stringify(report,null,2)+'\n');
 // Staging creates Git objects without changing public main. A maintainer checks
 // the screenshots and then advances main using the GitHub connection.
 if(!process.env.GH_TOKEN||!process.env.GITHUB_REPOSITORY||!process.env.GITHUB_SHA){
  console.log('CAPTURE-ONLY: review capture-output/ and commit through a PR.');return;
 }
 const repo=process.env.GITHUB_REPOSITORY,token=process.env.GH_TOKEN,head=process.env.GITHUB_SHA;
 async function request(path,body){
  const response=await fetch('https://api.github.com/repos/'+repo+'/'+path,{
   method:body?'POST':'GET',headers:{Accept:'application/vnd.github+json',
    Authorization:'Bearer '+token,'Content-Type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error(path+' '+response.status+' '+(await response.text()).slice(0,1200));
  return response.json();
 }
 const gitCommit=await request('git/commits/'+head);
 const elements=[...records.map(r=>({path:r.path,mode:'100644',type:'blob',content:r.text}))];
 for(const [path,data] of [['data/product-metadata.json',products],['data/source-provenance.json',provenance],
  ['data/image-dimensions.json',dimensions],['data/blob-sizes.json',sizes]]){
  elements.push({path,mode:'100644',type:'blob',content:JSON.stringify(data,null,2)+'\n'});
 }
 for(const file of files){
  const blob=await request('git/blobs',{content:file.bytes.toString('base64'),encoding:'base64'});
  elements.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});
 }
 const tree=await request('git/trees',{base_tree:gitCommit.tree.sha,tree:elements});
 const staged=await request('git/commits',{
  message:'data: independently capture licensed Bootstrap web UI examples',
  tree:tree.sha,parents:[head]});
 console.log('STAGED_CAPTURE_COMMIT_SHA='+staged.sha);
 console.log('STAGED_CAPTURE_PARENT_SHA='+head);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  'Staged '+files.length+' licensed screenshots.\n\nGit commit: '+staged.sha+
  '\n\nA maintainer must inspect the images before publishing.\n');
}
if(process.argv.includes('--capture'))runCapture().catch(error=>{console.error(error);process.exitCode=1;});
