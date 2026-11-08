import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const platforms = new Set(['ios', 'android', 'web', 'email', 'marketing']);
const imageRE = /\.(?:png|jpe?g|gif|webp|avif)$/i;
const repo = process.env.GITHUB_REPOSITORY || 'mcmanussliam/screenshots-design-inspiration';
const revision = process.env.GITHUB_SHA || 'main';
export const kebab = (s) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
export const urlFor = (path, repository=repo, ref=revision) => {
  const [owner,name] = repository.split('/');
  return 'https://raw.githubusercontent.com/' + [owner,name,ref,...path.split('/')].map(encodeURIComponent).join('/');
};
export function frontmatter(content) {
  const raw = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
  const name = raw.match(/^gallery-directory:\s*(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
  const inline = raw.match(/^tags:\s*\[([^\]]*)\]/m);
  let tags = inline ? inline[1].split(',').map(t=>t.trim().replace(/^["']|["']$/g,'')) : [];
  if (!inline) {
    const match = raw.match(/^tags:\s*\r?\n((?:\s+-[^\n]*\r?\n?)*)/m);
    tags = match ? [...match[1].matchAll(/^\s+-\s+(.+)$/gm)].map(m=>m[1].trim()) : [];
  }
  return {name, tags: tags.filter(Boolean)};
}
function git(...args) {
  return execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:30*1024*1024,stdio:['ignore','pipe','pipe']});
}
function getFiles() {
  try { return git('ls-tree','-r','--name-only','HEAD').trim().split('\n'); }
  catch { return []; }
}
function source(path) {
  try { return git('show','HEAD:'+path); }
  catch { return ''; }
}
export function createCatalog(paths, getText = source) {
  const groups = new Map();
  for(const path of paths) {
    const parts = path.split('/');
    if(parts.length!==3 || !platforms.has(parts[0])) continue;
    const key = parts.slice(0,2).join('/');
    if(!groups.has(key)) groups.set(key,{platform:parts[0],product:parts[1],files:[]});
    groups.get(key).files.push(parts[2]);
  }
  const products = [];
  const seen = new Set();
  for(const [dir, g] of groups) {
    const images = g.files.filter(f=>imageRE.test(f)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
    if (!images.length) continue;
    const {name,tags} = frontmatter(g.files.includes('index.html') ? getText(dir+'/index.html') : '');
    let perImage={};
    if(g.files.includes('tags.json')) {
      try { perImage = JSON.parse(getText(dir+'/tags.json') || '{}'); } catch {}
    }
    const platform = g.platform.toLowerCase();
    const kind = ['ios','android'].includes(platform) ? 'app' : 'site';
    let slug = kebab(g.product);
    if(seen.has(platform+':'+slug)) {
      let index=2; while(seen.has(platform+':'+slug+'-'+index)) index++;
      slug += '-'+index;
    }
    const id = platform+':'+slug; seen.add(id);
    products.push({
      id, slug, name:name||g.product, platform, kind, path:(kind==='app'?'apps':'sites')+'/'+platform+'/'+slug,
      category:tags[0]|| (kind==='app'?'Mobile app':'Website'),
      tags,
      screenshots:images.map(filename=>({
        name:filename,
        tags:Array.isArray(perImage[filename]) ? perImage[filename].filter(t=>typeof t==='string') : [],
        url:urlFor(dir+'/'+filename)
      }))
    });
  }
  products.sort((a,b)=>a.name.localeCompare(b.name)||a.platform.localeCompare(b.platform));
  return {version:1,generatedAt:new Date().toISOString(),products};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=createCatalog(getFiles());
  if(process.env.GITHUB_ACTIONS && !data.products.length) throw new Error('No screenshots found: cancelling empty deploy');
  mkdirSync(resolve(root,'site/src/data'),{recursive:true});
  mkdirSync(resolve(root,'site/public'),{recursive:true});
  const json=JSON.stringify(data)+'\n';
  writeFileSync(resolve(root,'site/src/data/catalog.json'),json);
  writeFileSync(resolve(root,'site/public/catalog.json'),json);
  console.log('Published '+data.products.length+' products, '+data.products.reduce((n,p)=>n+p.screenshots.length,0)+' screens');
}
