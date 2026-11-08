import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureImage} from './scan-image-dimensions.mjs';
test('reads real PNG IHDR dimensions without image decoding',()=>{
 const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
 b.write('IHDR',12);b.writeUInt32BE(1170,16);b.writeUInt32BE(2532,20);
 assert.deepEqual(measureImage(b),{width:1170,height:2532});
});
test('reads GIF dimensions from header',()=>{
 const b=Buffer.alloc(24);b.write('GIF89a');b.writeUInt16LE(640,6);b.writeUInt16LE(480,8);
 assert.deepEqual(measureImage(b),{width:640,height:480});
});
test('reads JPEG SOF dimensions',()=>{
 const b=Buffer.from([255,216,255,192,0,17,8,0,200,1,44,3,1,17,0,2,17,1,3,17,1,255,217]);
 assert.deepEqual(measureImage(b),{width:300,height:200});
});
test('invalid image metadata is rejected',()=>assert.equal(measureImage(Buffer.from('not image')),null));
