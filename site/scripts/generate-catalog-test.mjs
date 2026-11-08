import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kebab, frontmatter, urlFor, createCatalog } from './generate-catalog.mjs';
test('paths slug to kebab case',()=>assert.equal(kebab('Tést & Shop App'),'test-and-shop-app'));
test('frontmatter metadata',()=>assert.deepEqual(frontmatter('---\ngallery-directory: Linear\ntags: [Dashboard, Dark Mode]\n---'),{name:'Linear',tags:['Dashboard','Dark Mode']}));
test('filename URLs preserve spaces',()=>assert.match(urlFor('Web/Linear/Screen Shot.png'),/Screen%20Shot\.png$/));
test('imports screenshot tags',()=>{
  const data=createCatalog(['ios/demo/index.html','ios/demo/tags.json','ios/demo/screen.png'],p=>p.endsWith('.json')?'{"screen.png":["Login"]}':'---\ngallery-directory: Demo\ntags: [Finance]\n---');
  assert.equal(data.products[0].screenshots[0].tags[0],'Login');
  assert.equal(data.products[0].path,'apps/ios/demo');
});
