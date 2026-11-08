#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const catalogue=JSON.parse(readFileSync(resolve(root,'site/public/catalog.json'),'utf8'));
const report=JSON.parse(readFileSync(resolve(root,'site/public/dataset-report.json'),'utf8'));
let errors=[],screenCount=0,tagCount=0,dimensioned=0,unknown=0,bytes=0;
const seen=new Set();
for(const product of catalogue.products){
 if(!product.id||seen.has(product.id))errors.push('Duplicate/invalid product ID '+product.id);
 seen.add(product.id);
 if(!/^(ios|android|web|email|marketing):[a-z0-9-]+$/.test(product.id))
  errors.push('Invalid ID '+product.id);
 if(!Array.isArray(product.screenshots)||!product.screenshots.length)
  errors.push('Empty screenshots: '+product.id);
 if(product.category==='Masonry Layout'||product.category==='Dark Mode')
  errors.push('Design tags must not be product categories: '+product.id);
 for(const shot of product.screenshots){
  screenCount++;
  if(!shot.url.includes('/design/'+product.platform+'/'+product.slug+'/'))
    errors.push('Invalid screenshot path '+product.id+' '+shot.name);
  if(shot.width!==null&&(!Number.isSafeInteger(shot.width)||shot.width<=0))
    errors.push('Invalid width '+product.id+' '+shot.name);
  if(shot.height!==null&&(!Number.isSafeInteger(shot.height)||shot.height<=0))
    errors.push('Invalid height '+product.id+' '+shot.name);
  if((shot.width===null)!==(shot.height===null))
    errors.push('Only one dimension known: '+product.id+' '+shot.name);
  if(shot.width&&shot.height)dimensioned++;
  if(shot.sizeBytes!==null&&(!Number.isSafeInteger(shot.sizeBytes)||shot.sizeBytes<1))
    errors.push('Invalid bytes: '+product.id+' '+shot.name);
  bytes+=shot.sizeBytes||0;
  const groups=shot.tagGroups||{};
  if(!['screen','element','flow','style','unreviewed'].every(key=>Array.isArray(groups[key])))
   errors.push('Missing tag taxonomy: '+product.id+' '+shot.name);
  if(shot.tags.length)tagCount++;
  unknown+=(groups.unreviewed||[]).length;
 }
}
if(catalogue.version!==2)errors.push('Expected v2 catalogue');
if(screenCount!==report.screenshots||seen.size!==report.products)
 errors.push('Published report does not match catalog data');
console.log(JSON.stringify({products:seen.size,screenshots:screenCount,tagged:tagCount,
 dimensioned,unreviewedTagInstances:unknown,sourceBytes:bytes,errors:errors.slice(0,20)},null,2));
if(errors.length)process.exit(1);
