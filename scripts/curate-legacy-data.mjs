#!/usr/bin/env node
// One-time curation, source image bytes never downloaded or modified.
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {dirname,basename} from 'node:path';
const mode=process.argv[2];
if(!['--dry-run','--stage'].includes(mode))throw Error('usage: --dry-run|--stage');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const entries=git('ls-tree','-r','-z','HEAD').split('\0').filter(Boolean).map(row=>{
 const [info,path]=row.split('\t');return {path,sha:info.split(' ')[2]};
});
const files=new Set(entries.map(e=>e.path));
const read=path=>git('show','HEAD:'+path);
const images=entries.filter(e=>e.path.startsWith('design/')&&/\.(png|jpe?g|gif|webp|avif)$/i.test(e.path));
const byHash=new Map();
for(const x of images){const a=byHash.get(x.sha)||[];a.push(x.path);byHash.set(x.sha,a);}
const removals=[],cross=[];
for(const paths of byHash.values()){
 if(paths.length<2)continue;
 if(new Set(paths.map(dirname)).size>1){cross.push(paths);continue;}
 paths.sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
 for(const path of paths.slice(1))removals.push({path,canonical:paths[0]});
}
const grouped=new Map();
for(const item of removals){const a=grouped.get(dirname(item.path))||[];a.push(item);grouped.set(dirname(item.path),a);}
const dimensions=JSON.parse(read('data/image-dimensions.json'));
const sizes=JSON.parse(read('data/blob-sizes.json'));
const changes=[];let stripped=0,tagFixes=0,orphans=0,unknown=0;
const folders=new Map();
for(const item of images){const dir=dirname(item.path),list=folders.get(dir)||[];list.push(item.path);folders.set(dir,list);}
for(const [dir,paths] of folders){
 const tagsPath=dir+'/tags.json',indexPath=dir+'/index.html';
 if(!files.has(tagsPath)){unknown+=paths.length;continue;}
 let tags=JSON.parse(read(tagsPath)),updated=false;
 const existing=new Set(paths.map(path=>basename(path)));
 for(const name of Object.keys(tags)){
  if(!existing.has(name)){delete tags[name];orphans++;updated=true;}
  else if(Array.isArray(tags[name])){
   const clean=[...new Set(tags[name].filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];
   if(JSON.stringify(clean)!==JSON.stringify(tags[name])){tags[name]=clean;updated=true;}
  }
 }
 for(const item of grouped.get(dir)||[]){
  const old=basename(item.path),kept=basename(item.canonical);
  tags[kept]=[...new Set([...(Array.isArray(tags[kept])?tags[kept]:[]),...(Array.isArray(tags[old])?tags[old]:[])])];
  delete tags[old];updated=true;
 }
 if(updated){changes.push({path:tagsPath,content:JSON.stringify(tags,null,2)+'\n'});tagFixes++;}
 const retained=paths.filter(p=>!removals.some(r=>r.path===p));
 unknown+=retained.filter(p=>!Array.isArray(tags[basename(p)])||!tags[basename(p)].length).length;
 if(!files.has(indexPath))continue;
 const old=read(indexPath),m=old.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*$/);
 if(!m)continue; // Never discard substantive HTML content.
 const raw=m[1];
 const name=(raw.match(/^gallery-directory:\s*(.*)$/m)?.[1]||basename(dir)).trim().replace(/^["']|["']$/g,'');
 const inline=raw.match(/^tags:\s*\[([^\]]*)\]/m);
 const tagsList=inline?inline[1].split(',').map(x=>x.trim().replace(/^["']|["']$/g,'')):
 [...(raw.match(/^tags:\s*\r?\n((?:\s+-[^\n]*\r?\n?)*)/m)?.[1]||'').matchAll(/^\s+-\s+(.+)$/gm)].map(x=>x[1].trim());
 const minimal='---\ngallery-directory: '+JSON.stringify(name)+'\ntags: '+JSON.stringify([...new Set(tagsList.filter(Boolean))])+'\n---\n';
 if(old!==minimal){changes.push({path:indexPath,content:minimal});stripped++;}
}
for(const {path} of removals){delete dimensions.images[path];delete sizes.files[path];}
const report={version:1,originalImages:images.length,removedIntraProductDuplicates:removals.length,
 retainedCrossProductDuplicateGroups:cross.length,crossProductReviewQueue:cross,
 simplifiedLegacyIndexes:stripped,tagFilesCorrected:tagFixes,orphanTagKeysRemoved:orphans,
 remainingScreensMissingTags:unknown};
changes.push({path:'data/blob-sizes.json',content:JSON.stringify(sizes)+'\n'});
changes.push({path:'data/image-dimensions.json',content:JSON.stringify(dimensions)+'\n'});
changes.push({path:'data/curation-report.json',content:JSON.stringify(report,null,2)+'\n'});
console.log(JSON.stringify({images:images.length,removed:removals.length,stripped,tagFixes,orphans,unknown,cross:cross.length},null,2));
if(mode==='--dry-run')process.exit(0);
const repo=process.env.GITHUB_REPOSITORY,token=process.env.GH_TOKEN;
if(!repo||!token)throw Error('GITHUB_REPOSITORY and GH_TOKEN are required');
const parent=git('rev-parse','HEAD'),base=git('rev-parse','HEAD^{tree}');
async function api(path,payload){
 const r=await fetch('https://api.github.com/repos/'+repo+'/'+path,{method:'POST',
 headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},
 body:JSON.stringify(payload),signal:AbortSignal.timeout(150000)});
 if(!r.ok)throw Error(path+' HTTP '+r.status+': '+(await r.text()).slice(0,1000));
 return r.json();
}
const elements=[...removals.map(x=>({path:x.path,mode:'100644',type:'blob',sha:null})),
 ...changes.map(x=>({path:x.path,mode:'100644',type:'blob',content:x.content}))];
const newTree=await api('git/trees',{base_tree:base,tree:elements});
const commit=await api('git/commits',{message:'data: consolidate within-product duplicate images and simplify old Jekyll metadata',
 tree:newTree.sha,parents:[parent]});
console.log('STAGED_CURATION_SHA='+commit.sha);
console.log('STAGED_CURATION_PARENT='+parent);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Staged cleanup SHA: '+commit.sha+'\n');
