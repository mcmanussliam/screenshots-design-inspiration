#!/usr/bin/env node
/**
 * Rename Git paths by rewriting trees, not screenshot blobs.
 *
 * Works with Git's partial clone: binary blob objects are never downloaded.
 * Usage: node scripts/normalize-repository.mjs --check | --migrate | --api-migrate
 * `--migrate` creates a new commit descending from HEAD and pushes it to main.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, dirname, basename, extname } from 'node:path';

const ROOT = process.cwd();
const mode = process.argv[2];
if (!['--check', '--migrate', '--api-migrate'].includes(mode)) {
  console.error('Usage: node scripts/normalize-repository.mjs --check|--migrate|--api-migrate');
  process.exit(2);
}

const unnecessary = new Set([
  '.github/workflows/crawl.yml',
  '.github/workflows/tag.yml',
  '.github/workflows/pr-validate.yml',
  '.github/workflows/kebab-case-migration.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'package.json',
  'package-lock.json',
  'PLAN.md',
  'Screenshot-Recommendations.md',
]);
const legacyDirectories = ['crawler/', 'scripts/'];
const keepLegacyScripts = new Set(['scripts/normalize-repository.mjs']);
const specialFiles = new Set(['.gitignore', '.gitattributes', '.gitkeep', '.nojekyll']);
// GitHub recognises this conventional filename; renaming it breaks the PR template.
const githubRequiredNames = new Set(['.github/pull_request_template.md']);
const isGithubTemplate = p => githubRequiredNames.has(p) || p.startsWith('.github/ISSUE_TEMPLATE/');

export function kebabSegment(segment, isFile=false) {
  if (specialFiles.has(segment) || segment === '.github' || /^\[[a-z][a-z0-9-]*\](?:\.[a-z0-9]+)?$/.test(segment)) return segment;
  const extension = isFile ? extname(segment).toLowerCase() : '';
  const stem = extension ? segment.slice(0, -extension.length) : segment;
  let slug = stem.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) slug = 'unicode-' + Array.from(stem).map(c => c.codePointAt(0).toString(16)).join('-');
  slug = slug.slice(0, 140).replace(/-$/g, '');
  return slug + extension;
}

export function kebabPath(path) {
  const segments=path.split('/');
  return segments.map((segment,index)=>kebabSegment(segment,index===segments.length-1)).join('/');
}

function command(args, options={}) {
  const result = spawnSync('git', args, {
    cwd: ROOT, encoding:'utf8', maxBuffer:64*1024*1024,
    ...options,
  });
  if (result.error || result.status !== 0) throw new Error(
    'git '+args.join(' ')+' failed: '+(result.stderr || result.error?.message || result.status));
  return (result.stdout || '').trim();
}

export function addSuffix(path, index) {
  const extension=extname(path), stem=extension?path.slice(0,-extension.length):path;
  return `${stem}-${index}${extension}`;
}

const entries=command(['ls-tree','-r','-z','HEAD']).split('\0').filter(Boolean).map(row=>{
  const tab=row.indexOf('\t');
  const meta=row.slice(0,tab).split(' ');
  return { mode:meta[0], type:meta[1], sha:meta[2], path:row.slice(tab+1) };
});
// Resolve directory names first. If two legacy directories normalize to the
// same slug, disambiguate the directory itself instead of accidentally merging
// products or renaming a required index.html file to index-2.html.
const originalDirectories=new Set();
for(const entry of entries){
  const parts=entry.path.split('/');
  for(let i=1;i<parts.length;i++)originalDirectories.add(parts.slice(0,i).join('/'));
}
const directoryMap=new Map([['','']]);
const usedDirectories=new Set();
for(const oldDirectory of [...originalDirectories].sort((a,b)=>a.split('/').length-b.split('/').length|| (a<b?-1:1))){
  const parent=dirname(oldDirectory)==='.' ? '' : dirname(oldDirectory);
  const parentNew=directoryMap.get(parent);
  if(parentNew===undefined)throw new Error('Missing parent '+parent);
  const prefix=parentNew ? parentNew+'/' : '';
  let candidate=prefix+kebabSegment(basename(oldDirectory));
  if(usedDirectories.has(candidate)){
    let n=2;while(usedDirectories.has(addSuffix(candidate,n)))n++;
    candidate=addSuffix(candidate,n);
  }
  usedDirectories.add(candidate);
  directoryMap.set(oldDirectory,candidate);
}
const mapping=new Map();
const occupied=new Set();
let removed=0, changed=0, colliding=0;
for(const entry of entries){
  const oldPath=entry.path;
  if(oldPath.split('/').some(s=>s==='.DS_Store'||s==='Thumbs.db'||s==='desktop.ini')||
    unnecessary.has(oldPath)||
    (legacyDirectories.some(prefix=>oldPath.startsWith(prefix)) && !keepLegacyScripts.has(oldPath))){removed++;continue;}
  const parent=dirname(oldPath)==='.' ? '' : dirname(oldPath);
  const newParent=directoryMap.get(parent)||'';
  let newPath=oldPath==='screenshot_tags.csv' ? 'data/screenshot-tags.csv' :
    (newParent ? newParent+'/' : '')+kebabSegment(basename(oldPath),true);
  if(occupied.has(newPath)){
    let i=2;while(occupied.has(addSuffix(newPath,i)))i++;
    newPath=addSuffix(newPath,i);
    colliding++;
  }
  occupied.add(newPath);
  mapping.set(oldPath,newPath);
  if(oldPath!==newPath)changed++;
}

const invalidPaths=[...mapping.values()].filter(p=>!p.split('/').every(s=>specialFiles.has(s)||s==='.github'||/^\[[a-z][a-z0-9-]*\](?:\.[a-z0-9]+)?$/.test(s)||/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*$/.test(s)));
if(invalidPaths.length)throw new Error('Invalid output paths:\n'+invalidPaths.slice(0,15).join('\n'));

if(mode==='--check'){
  const bad=entries.filter(e=>!isGithubTemplate(e.path)&&e.path!==kebabPath(e.path));
  const junk=entries.filter(e=>e.path.split('/').includes('.DS_Store'));
  if(bad.length||junk.length){
    console.error(`Paths not normalized: ${bad.length} bad, ${junk.length} junk. Examples:\n`+bad.slice(0,10).map(e=>e.path).join('\n'));
    process.exit(1);
  }
  console.log(`Checked ${entries.length} paths: all kebab-case (except required Git dotfiles).`);
  process.exit(0);
}

if(process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME!=='main')throw new Error('Migration must run on main');
if(!mapping.size)throw new Error('No files to migrate.');

// Build a direct name map per product so filename references and screenshot tags
// move atomically with their associated image blobs.
const filesByParent=new Map();
for(const [oldPath,newPath] of mapping){
  const folder=dirname(oldPath);
  if(!filesByParent.has(folder))filesByParent.set(folder,new Map());
  filesByParent.get(folder).set(basename(oldPath),basename(newPath));
}
const binaryExtensions=/\.(?:png|jpe?g|gif|webp|avif|svg|mp4|webm|mov)$/i;
const metadataPaths=new Set();
for(const entry of entries) if(mapping.has(entry.path) &&
  (/(?:^|\/)index\.html$/.test(entry.path) || /(?:^|\/)tags\.json$/.test(entry.path))) metadataPaths.add(entry.path);

function transformText(oldPath,content){
  const name=basename(oldPath);
  const names=filesByParent.get(dirname(oldPath))||new Map();
  if(oldPath==='README.md')return readFileSync(resolve(ROOT,'scripts/migration-readme.md'),'utf8');
  if(oldPath==='CONTRIBUTING.md')return readFileSync(resolve(ROOT,'scripts/migration-contributing.md'),'utf8');
  if(name==='tags.json'){
    const obj=JSON.parse(content);
    const next={};
    for(const [key,value] of Object.entries(obj)){
      const newKey=names.get(key)||kebabSegment(key,true);
      if(Object.hasOwn(next,newKey))throw new Error(`Duplicate tags key: ${oldPath} ${newKey}`);
      next[newKey]=value;
    }
    return JSON.stringify(next,null,2)+'\n';
  }
  if(name==='index.html'){
    const replacements=[...names].filter(([from,to])=>from!==to&&binaryExtensions.test(from)).sort((a,b)=>b[0].length-a[0].length);
    if(!replacements.length)return content;
    const lookup=new Map(replacements);
    const regex=new RegExp(replacements.map(([from])=>from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
    return content.replace(regex,token=>lookup.get(token));
  }
  if(oldPath==='site/scripts/generate-catalog.mjs'){
    const expected="new Set(['iOS', 'Android', 'Web', 'Email', 'Marketing'])";
    if(!content.includes(expected))throw new Error('Catalogue platform list changed; migration requires review');
    return content.replace(expected,"new Set(['ios', 'android', 'web', 'email', 'marketing'])");
  }
  if(oldPath==='site/scripts/generate-catalog.test.mjs'){
    return content.replaceAll('iOS/Demo', 'ios/demo');
  }
  if(oldPath==='.github/workflows/pages.yml'){
    return content.replaceAll('Android/**','android/**').replaceAll('iOS/**','ios/**')
      .replaceAll('Web/**','web/**').replaceAll('Email/**','email/**').replaceAll('Marketing/**','marketing/**')
      .replace('node --check mcp/server.mjs','node --check mcp/server.mjs\n          node scripts/normalize-repository.mjs --check')
      .replace('            /mcp/\n','            /mcp/\n            /scripts/normalize-repository.mjs\n');
  }
  if(/\.md$/i.test(oldPath)){
    return content.replaceAll('Android/','android/').replaceAll('iOS/','ios/')
      .replaceAll('Web/','web/').replaceAll('Email/','email/').replaceAll('Marketing/','marketing/')
      .replaceAll('CONTRIBUTING.md','contributing.md').replaceAll('README.md','readme.md')
      .replaceAll('CHANGELOG.md','changelog.md')
      .replaceAll('Screenshot-Recommendations.md','screenshot-recommendations.md')
      .replaceAll('screenshot_tags.csv','screenshot-tags.csv');
  }
  return content;
}

const fileRows=[];
const changedContents=new Map();
let changedMetadata=0;
for(const entry of entries){
  const newPath=mapping.get(entry.path);
  if(!newPath)continue;
  let sha=entry.sha;
  const mustEdit=metadataPaths.has(entry.path)||entry.path==='site/scripts/generate-catalog.mjs'||
    entry.path==='site/scripts/generate-catalog.test.mjs'||entry.path==='.github/workflows/pages.yml'||/\.md$/i.test(entry.path);
  if(mustEdit){
    const source=resolve(ROOT,entry.path);
    if(!existsSync(source))throw new Error('Required metadata was not checked out: '+entry.path);
    const before=readFileSync(source,'utf8');
    const after=transformText(entry.path,before);
    if(before!==after){
      sha=command(['hash-object','-w','--stdin'],{input:after}); changedMetadata++;
      changedContents.set(newPath,after);
    }
  }
  fileRows.push({path:newPath,mode:entry.mode,sha});
}

// Build Git trees from the bottom up, using the original blob hashes for images.
// The --missing option permits a partial clone with no screenshot binaries present.
const root={children:new Map()};
for(const file of fileRows){
  const segments=file.path.split('/');let node=root;
  for(const dir of segments.slice(0,-1)){
    let child=node.children.get(dir);
    if(!child){child={children:new Map()};node.children.set(dir,child);}
    if(!child.children)throw new Error('Directory/file collision at '+file.path);
    node=child;
  }
  const name=segments.at(-1);
  if(node.children.has(name))throw new Error('Final path collision at '+file.path);
  node.children.set(name,{sha:file.sha,mode:file.mode,type:'blob',content:changedContents.get(file.path)});
}
let treeCount=0;
function writeTree(node){
  const children=[];
  for(const [name,child] of node.children){
    if(child.children){children.push({name,mode:'040000',type:'tree',sha:writeTree(child)});}
    else children.push({name,...child});
  }
  children.sort((a,b)=> (a.name+(a.type==='tree'?'/':'')) < (b.name+(b.type==='tree'?'/':''))?-1:1);
  const payload=Buffer.concat(children.map(e=>Buffer.from(`${e.mode} ${e.type} ${e.sha}\t${e.name}\0`)));
  const sha=command(['mktree','-z','--missing'],{input:payload});
  treeCount++;
  return sha;
}
const apiRoot = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
const apiToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
let activeRequests=0, createdTrees=0;
const waiters=[];
async function limitedFetch(path,method,body){
  if(activeRequests>=5)await new Promise(resolve=>waiters.push(resolve));
  activeRequests++;
  try{
    const url=apiRoot+path;
    for(let attempt=0;attempt<5;attempt++){
      const response=await fetch(url,{
        method,
        headers:{
          'Authorization':'Bearer '+apiToken,
          'Accept':'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28',
          'Content-Type':'application/json'
        },
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(60000)
      });
      if(response.ok)return await response.json();
      const detail=(await response.text()).slice(0,800);
      if((response.status>=500||response.status===429||response.status===403 && /secondary rate limit/i.test(detail)) && attempt<4){
        const retryAfter=Number(response.headers.get('retry-after'))||0;
        await new Promise(resolve=>setTimeout(resolve,Math.max(retryAfter*1000,1500*(attempt+1)**2)));
        continue;
      }
      throw new Error(`${method} ${path} returned ${response.status}: ${detail}`);
    }
  }finally{
    activeRequests--;
    waiters.shift()?.();
  }
}
async function writeRemoteTree(node){
  const tree=await Promise.all([...node.children].map(async ([name,child])=>{
    if(child.children){
      return {path:name,mode:'040000',type:'tree',sha:await writeRemoteTree(child)};
    }
    if(typeof child.content==='string')return {path:name,mode:child.mode,type:'blob',content:child.content};
    return {path:name,mode:child.mode,type:'blob',sha:child.sha};
  }));
  const obj=await limitedFetch('/git/trees','POST',{tree});
  if(!/^[a-f0-9]{40}$/.test(obj.sha||''))throw new Error('Unexpected tree response');
  createdTrees++;
  if(createdTrees%50===0)console.log(`Published ${createdTrees} directory trees through GitHub API`);
  return obj.sha;
}

if(mode==='--api-migrate'){
  if(!apiToken||!process.env.GITHUB_REPOSITORY)throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY required');
  console.log(`Preparing remote Git trees for ${fileRows.length} files (${changedMetadata} metadata updates) without uploading screenshot blobs...`);
  const remoteTree=await writeRemoteTree(root);
  const localTree=writeTree(root);
  if(remoteTree!==localTree)throw new Error(`Remote tree mismatch: ${remoteTree} !== ${localTree}`);
  console.log(`Verified remote root tree: ${remoteTree} (${createdTrees} directories)`);
  const parent=command(['rev-parse','HEAD']);
  const newCommit=await limitedFetch('/git/commits','POST',{
    message:'refactor: normalize all paths to kebab-case',tree:remoteTree,parents:[parent]
  });
  console.log('Remote commit:',newCommit.sha);
  const ref=await limitedFetch('/git/refs/heads/main','PATCH',{sha:newCommit.sha,force:false});
  if(ref?.object?.sha!==newCommit.sha)throw new Error('Unexpected branch update result');
  console.log('Updated main branch:',newCommit.sha);
  process.exit(0);
}
const newTree=writeTree(root);
if(!newTree||!/^[0-9a-f]{40}$/.test(newTree))throw new Error('Invalid git tree '+newTree);
console.log(`Prepared ${fileRows.length} file paths, ${changed} renames, ${colliding} disambiguated collisions, ${removed} deletions, ${changedMetadata} metadata rewrites, ${treeCount} trees.`);
if(process.env.MIGRATION_DRY_RUN==='1'){
  console.log('Dry run tree: '+newTree);
  process.exit(0);
}
const oldHead=command(['rev-parse','HEAD']);
const commit=command(['commit-tree',newTree,'-p',oldHead,'-m','refactor: normalize all paths to kebab-case']);
console.log('New commit: '+commit);
command(['push','origin',commit+':refs/heads/main']);
console.log('Pushed normalized tree to main.');
