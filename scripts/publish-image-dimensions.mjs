#!/usr/bin/env node
import {readFileSync,appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const repo=process.env.GITHUB_REPOSITORY;
const token=process.env.GH_TOKEN;
if(!repo||!token)throw new Error('This step must run in an authenticated GitHub Actions job');
const manifest=readFileSync('data/image-dimensions.json','utf8');
const data=JSON.parse(manifest);
const images=data.images||{},names=Object.keys(images);
if(data.version!==1||names.length<9000||names.some(name=>!name.startsWith('design/')))
 throw new Error('Invalid or incomplete verified image dimensions. Refusing to publish.');
for(const value of Object.values(images)){
 if(!Number.isSafeInteger(value.width)||value.width<1||!Number.isSafeInteger(value.height)||value.height<1)
  throw new Error('Invalid image dimensions in audit artifact.');
}
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const tree=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
async function api(path,body){
 const response=await fetch('https://api.github.com/repos/'+repo+'/'+path,{
  method:'POST',headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,
   'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
  body:JSON.stringify(body),signal:AbortSignal.timeout(90000)
 });
 const result=await response.json();
 if(!response.ok)throw new Error(path+' '+response.status+': '+JSON.stringify(result));
 return result;
}
const next=await api('git/trees',{base_tree:tree,tree:[{
 path:'data/image-dimensions.json',mode:'100644',type:'blob',content:manifest
}]});
const commit=await api('git/commits',{
 message:'data: include verified native dimensions for 9608 source images',
 tree:next.sha,parents:[sha]
});
console.log('BASE_SHA='+sha);
console.log('DIMENSIONS_COMMIT_SHA='+commit.sha);
console.log('DIMENSIONS_COUNT='+names.length);
if(process.env.GITHUB_STEP_SUMMARY){
 appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  'Verified '+names.length+' images.\n\nCommit '+commit.sha+' created; branch update handled by repository maintainer.\n');
}
