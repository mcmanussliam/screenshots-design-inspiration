import {test} from 'node:test';
import assert from 'node:assert/strict';
import {kebab,frontmatter,urlFor,createCatalog,reportCatalog} from './generate-catalog.mjs';
import {classifyTags} from './tag-taxonomy.mjs';
test('slug names use kebab-case',()=>assert.equal(kebab('Tést & Shop App'),'test-and-shop-app'));
test('YAML frontmatter retains original app name and design labels',()=>{
 assert.deepEqual(frontmatter('---\ngallery-directory: Airbnb\ntags: [Masonry Layout, Dark Mode]\n---'),{name:'Airbnb',tags:['Masonry Layout','Dark Mode']});
});
test('raw URLs contain the design directory',()=>assert.match(urlFor('design/ios/airbnb/screen.png'),/\/design\/ios\/airbnb\/screen\.png$/));
test('taxonomy splits screen types from components and styles',()=>{
 const out=classifyTags(['Log In','Text Input','Dark Mode','Unknown Feature','Log In']);
 assert.deepEqual(out.screen,['Login']);assert.deepEqual(out.element,['Text Field']);
 assert.deepEqual(out.style,['Dark Mode']);assert.deepEqual(out.unreviewed,['Unknown Feature']);
});
test('catalogue includes image byte size and verified dimensions when supplied',()=>{
 const paths=[
  {path:'design/ios/demo/index.html',sizeBytes:25},
  {path:'design/ios/demo/tags.json',sizeBytes:30},
  {path:'design/ios/demo/01-login.png',sizeBytes:1000},
  {path:'design/ios/demo/02-home.png',sizeBytes:2000},
  {path:'design/ios/demo/preview.mp4',sizeBytes:12000}
 ];
 const reader=p=>p==='data/image-dimensions.json'?JSON.stringify({images:{'design/ios/demo/01-login.png':{width:1080,height:1920}}}):
  p==='data/product-metadata.json'?JSON.stringify({products:{'ios:demo':{category:'Productivity',description:'Demo app'}}}):
  p==='data/source-provenance.json'?JSON.stringify({products:{'ios:demo':{
   source:'https://example.org',owner:'Example',license:'CC0-1.0',captureDate:'2026-11-09',
   screens:[{file:'01-login.png',source:'https://example.org/demo',sha256:'a'.repeat(64)}]
  }}}):
  p.endsWith('tags.json')?'{"01-login.png":["Log In","Text Field"],"02-home.png":["Home"]}':
  '---\ngallery-directory: Demo\ntags: [Dark Mode]\n---';
 const data=createCatalog(paths,reader),p=data.products[0],r=reportCatalog(data);
 assert.equal(p.category,'Productivity');assert.equal(p.description,'Demo app');
 assert.equal(p.screenshots[0].width,1080);assert.equal(p.screenshots[0].height,1920);
 assert.equal(p.screenshots[0].sizeBytes,1000);assert.equal(p.screenshots[1].width,null);
 assert.equal(p.source.license,'CC0-1.0');
 assert.equal(p.screenshots[0].reviewStatus,'source-documented');
 assert.equal(p.screenshots[0].sourceUrl,'https://example.org/demo');
 assert.equal(p.screenshots[1].reviewStatus,'legacy-unverified');
 assert.equal(r.sourceDocumentedScreens,1);
 assert.deepEqual(p.screenshots[0].tagGroups.screen,['Login']);
 assert.deepEqual(p.screenshots[0].tagGroups.element,['Text Field']);
 assert.equal(p.videos.length,1);assert.equal(r.withDimensions,1);
 assert.equal(r.withScreenTags,2);
});
test('unverified dimensions stay null, not guessed from aspect ratio',()=>{
 const data=createCatalog(['design/web/example/index.html','design/web/example/a.jpg'],()=> '');
 assert.equal(data.products[0].screenshots[0].width,null);
 assert.equal(data.products[0].screenshots[0].orientation,'unknown');
 assert.equal(data.products[0].category,'Website');
});

test('nested design screenshots remain in their parent product, not silently excluded',()=>{
 const files=['design/web/bloomberg-terminal/index.html',
  'design/web/bloomberg-terminal/industry-dashboards/screen-01.png'];
 const d=createCatalog(files,()=> '');
 assert.equal(d.products.length,1);
 assert.equal(d.products[0].screenshots.length,1);
 assert.match(d.products[0].screenshots[0].url,/industry-dashboards\\/screen-01\\.png$/);
});
test('migrated image paths retain verified native dimensions',()=>{
 const files=[{path:'design/marketing/fellow-app/index.html',sizeBytes:20},
 {path:'design/marketing/fellow-app/screen.png',sizeBytes:400}];
 const reader=(path)=>path==='data/image-path-migrations.json'?
  '{"files":{"design/marketing/fellow-app/screen.png":"design/marketing/screen.png"}}':
  path==='data/image-dimensions.json'?
  '{"images":{"design/marketing/screen.png":{"width":1280,"height":720}}}':'';
 const d=createCatalog(files,reader);
 assert.equal(d.products[0].screenshots[0].width,1280);
 assert.equal(d.products[0].screenshots[0].height,720);
});
