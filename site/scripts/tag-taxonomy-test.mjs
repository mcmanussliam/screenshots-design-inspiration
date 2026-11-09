import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyTags,tagDescription,taxonomy} from './tag-taxonomy.mjs';
test('legacy labels use the documented correct facet',()=>{
 const t=classifyTags(['Verification','Kanban Board','Status Dot','Time Picker','Dialog','Dark Mode']);
 assert.deepEqual(t.screen,['Verification','Kanban Board']);
 assert.deepEqual(t.element,['Status Dot','Time Picker','Dialog']);
 assert.deepEqual(t.style,['Dark Mode']);
 assert.equal(t.unreviewed.length,0);
});
test('synonyms and duplicates are normalised deterministically',()=>{
 const t=classifyTags(['Log In','Login','Sign in','my account and profile']);
 assert.deepEqual(t.screen,['Login','My Account & Profile']);
});
test('meaningless tags are dropped but unknown specific tags need review',()=>{
 const t=classifyTags(['Misc','N/A','Random Custom Tag']);
 assert.deepEqual(t.unreviewed,['Random Custom Tag']);
 assert.equal(t.screen.length,0);
});
test('quality definitions are available to contributors',()=>{
 assert.match(tagDescription('Verification'),/verif/i);
 assert.ok(taxonomy.element.includes('Time Picker'));
});
