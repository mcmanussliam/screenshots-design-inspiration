import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyTags, groupedTags } from './tag-taxonomy.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const platforms = new Set(['ios','android','web','email','marketing']);
const imageRE = /\.(?:png|jpe?g|gif|webp|avif)$/i;
const videoRE = /\.(?:mp4|mov|webm)$/i;
const repo = process.env.GITHUB_REPOSITORY || 'mcmanussliam/screenshots-design-inspiration';
const revision = process.env.GITHUB_SHA || 'main';
export const kebab = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'untitled';
export const urlFor = (path, repository=repo, ref=revision) => {
  const [owner, name] = repository.split('/');
  return 'https://raw.githubusercontent.com/' +
    [owner,name,ref,...path.split('/')].map(encodeURIComponent).join('/');
};
export function frontmatter(content) {
  const raw = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
  const name = raw.match(/^gallery-directory:\s*(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g,'') || '';
  const inline = raw.match(/^tags:\s*\[([^\]]*)\]/m);
  let tags = inline ? inline[1].split(',').map(tag=>tag.trim().replace(/^["']|["']$/g,'')) : [];
  if (!inline) {
    const match = raw.match(/^tags:\s*\r?\n((?:\s+-[^\n]*\r?\n?)*)/m);
    tags = match ? [...match[1].matchAll(/^\s+-\s+(.+)$/gm)].map(m=>m[1].trim()) : [];
  }
  return { name,tags:tags.filter(Boolean) };
}
function git(...args) {
  return execFileSync('git',['-C',root,...args],{
    encoding:'utf8',maxBuffer:36*1024*1024,stdio:['ignore','pipe','pipe']
  });
}
function listFiles() {
  // ls-tree -l triggers lazy downloads of every blob in a sparse clone.
  // Keep the archive metadata-only: tracked byte sizes come from GitHub's tree API.
  const sizes=safeJson(readTracked('data/blob-sizes.json')).files || {};
  return git('ls-tree','-r','--name-only','HEAD').split('\n').filter(Boolean)
    .map(path=>({path,sizeBytes:Number.isSafeInteger(sizes[path])?sizes[path]:null}));
}
function readTracked(path) {
  try { return git('show','HEAD:'+path); }catch{return '';}
}
const safeJson = text => {try{return JSON.parse(text);}catch{return {};}};
const positiveInteger = n => Number.isSafeInteger(n)&&n>0;
const alpha = (a,b) => a.localeCompare(b,'en',{numeric:true});
export function createCatalog(entries,readSource=readTracked) {
  const productMetadata=safeJson(readSource('data/product-metadata.json')).products || {};
  const imageMetadata=safeJson(readSource('data/image-dimensions.json')).images || {};
  const groups=new Map();
  for(const entry of entries){
    const path=typeof entry==='string'?entry:entry.path;
    const parts=path.split('/');
    if(parts.length!==4||parts[0]!=='design'||!platforms.has(parts[1]))continue;
    const key=parts.slice(0,3).join('/');
    if(!groups.has(key))groups.set(key,{platform:parts[1],folder:parts[2],files:[]});
    groups.get(key).files.push({name:parts[3],bytes:typeof entry==='string'?null:entry.sizeBytes});
  }
  const products=[],seen=new Set();
  for(const [dir,group] of groups){
    const images=group.files.filter(file=>imageRE.test(file.name)).sort((a,b)=>alpha(a.name,b.name));
    if(!images.length)continue;
    const files=new Set(group.files.map(f=>f.name));
    const front=frontmatter(files.has('index.html')?readSource(dir+'/index.html'):'');
    const screenshotTags=safeJson(files.has('tags.json')?readSource(dir+'/tags.json'):'');
    const platform=group.platform,kind=['ios','android'].includes(platform)?'app':'site';
    let slug=kebab(group.folder);
    if(seen.has(platform+':'+slug)){
      let suffix=2;while(seen.has(platform+':'+slug+'-'+suffix))suffix++;
      slug+='-'+suffix;
    }
    const id=platform+':'+slug;seen.add(id);
    const info=productMetadata[id]||{};
    const productsTags=classifyTags(front.tags);
    const screenshotMedia=images.map(file=>{
      const path=dir+'/'+file.name;
      const dimensions=imageMetadata[path] || {};
      const width=positiveInteger(dimensions.width)?dimensions.width:null;
      const height=positiveInteger(dimensions.height)?dimensions.height:null;
      const originals=Array.isArray(screenshotTags[file.name])?screenshotTags[file.name]:[];
      const groups=classifyTags(originals);
      return {
        name:file.name,url:urlFor(path),format:file.name.split('.').at(-1).toLowerCase(),
        sizeBytes:Number.isSafeInteger(file.bytes)?file.bytes:null,
        width,height,aspectRatio:width&&height?Math.round(width/height*10000)/10000:null,
        orientation:width&&height?(width>height?'landscape':width<height?'portrait':'square'):'unknown',
        tags:groupedTags(originals),tagGroups:groups,rawTags:originals
      };
    });
    const videos=group.files.filter(file=>videoRE.test(file.name)).sort((a,b)=>alpha(a.name,b.name))
      .map(file=>({name:file.name,url:urlFor(dir+'/'+file.name),format:file.name.split('.').at(-1).toLowerCase(),sizeBytes:file.bytes??null}));
    products.push({
      id,slug,name:front.name||group.folder,platform,kind,
      path:(kind==='app'?'apps':'sites')+'/'+platform+'/'+slug,
      category:typeof info.category==='string'&&info.category.trim()?info.category:(kind==='app'?'Mobile app':'Website'),
      description:typeof info.description==='string'?info.description:'',
      domain:typeof info.domain==='string'?info.domain:'',
      tags:groupedTags(front.tags),tagGroups:productsTags,
      screenshots:screenshotMedia,videos
    });
  }
  products.sort((a,b)=>alpha(a.name,b.name)||alpha(a.platform,b.platform));
  return {version:2,generatedAt:new Date().toISOString(),products};
}
export function reportCatalog(data) {
  const summary={version:1,products:data.products.length,screenshots:0,videos:0,
    withDimensions:0,withScreenTags:0,unreviewedTagInstances:0,
    orientation:{portrait:0,landscape:0,square:0,unknown:0},formats:{},sourceBytes:0,
    allTags:{screen:{},element:{},flow:{},style:{},unreviewed:{}}};
  for(const product of data.products){
    summary.screenshots+=product.screenshots.length;summary.videos+=product.videos.length;
    for(const screen of product.screenshots){
      if(screen.width&&screen.height)summary.withDimensions++;
      if(screen.tags.length)summary.withScreenTags++;
      summary.orientation[screen.orientation]++;
      summary.formats[screen.format]=(summary.formats[screen.format]||0)+1;
      summary.sourceBytes+=screen.sizeBytes||0;
      for(const [bucket,tags] of Object.entries(screen.tagGroups)){
        for(const tag of tags){
          summary.allTags[bucket][tag]=(summary.allTags[bucket][tag]||0)+1;
          if(bucket==='unreviewed')summary.unreviewedTagInstances++;
        }
      }
    }
  }
  return summary;
}
if (process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const catalog=createCatalog(listFiles()),report=reportCatalog(catalog);
  if(process.env.GITHUB_ACTIONS&&!catalog.products.length)throw new Error('No screenshots found: cancelling empty deploy');
  mkdirSync(resolve(root,'site/src/data'),{recursive:true});
  mkdirSync(resolve(root,'site/public'),{recursive:true});
  const json=JSON.stringify(catalog)+'\n';
  writeFileSync(resolve(root,'site/src/data/catalog.json'),json);
  writeFileSync(resolve(root,'site/public/catalog.json'),json);
  writeFileSync(resolve(root,'site/public/dataset-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Catalog v2: '+report.products+' products, '+report.screenshots+
    ' screenshots, '+report.videos+' videos, '+report.withDimensions+' dimensioned, '+report.withScreenTags+' tagged');
}
