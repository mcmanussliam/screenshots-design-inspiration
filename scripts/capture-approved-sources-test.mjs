import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSource,allowedByRobots} from './capture-approved-sources.mjs';
const example={id:'bootstrap-ui-examples',platform:'web',slug:'bootstrap-examples',
 allowedHost:'getbootstrap.com',allowedPrefix:'/docs/5.3/examples/',license:'CC-BY-3.0',
 licenseEvidence:'https://github.com/twbs/bootstrap',credit:'Bootstrap Authors',
 owner:'Bootstrap Authors',viewport:{width:1440,height:900,scale:1},
 screens:[{filename:'dashboard.png',url:'https://getbootstrap.com/docs/5.3/examples/dashboard/',tags:['Dashboard','Table']}]};
test('approved HTTPS source with known tags',()=>assert.equal(validateSource(example),true));
test('rejects unapproved host',()=>assert.throws(()=>validateSource({...example,screens:[{...example.screens[0],url:'https://example.com/docs/5.3/examples/dashboard/'}]})));
test('rejects invented tags',()=>assert.throws(()=>validateSource({...example,screens:[{...example.screens[0],tags:['Fake Label'] }]})));
test('rejects path traversal',()=>assert.throws(()=>validateSource({...example,screens:[{...example.screens[0],filename:'../outside.png'}]})));
test('respects robots exclusions and exceptions',()=>{
 const robots='User-agent: *\nDisallow: /private/\nAllow: /private/public/\n';
 assert.equal(allowedByRobots(robots,'/private/secret'),false);
 assert.equal(allowedByRobots(robots,'/private/public/page'),true);
 assert.equal(allowedByRobots(robots,'/docs/home'),true);
});
