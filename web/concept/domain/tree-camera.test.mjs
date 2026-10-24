import test from 'node:test'
import assert from 'node:assert/strict'
import { zoomAt, pinchGeometry } from './tree-camera.ts'

test('pinch keeps the form under the fingers while its midpoint moves', () => {
  const camera = { scale: 1, left: 200, top: 300 }
  const next = zoomAt(camera, {x:100,y:120}, {x:130,y:140}, 2, {width:2000,height:2000}, {width:390,height:400})
  assert.equal((next.left+130)/next.scale, (camera.left+100)/camera.scale)
  assert.equal((next.top+140)/next.scale, (camera.top+120)/camera.scale)
  assert.deepEqual(camera,{scale:1,left:200,top:300})
})
test('zooming a fitted centered diagram keeps its center anchored, and pan stops at content bounds', () => {
  const next=zoomAt({scale:.2,left:0,top:0},{x:200,y:100},{x:200,y:100},1,{width:1000,height:1000},{width:400,height:400})
  assert.equal(next.left,300)
  assert.equal(next.top,400)
  const pan=zoomAt(next,{x:0,y:0},{x:-9999,y:9999},1,{width:1000,height:1000},{width:400,height:400})
  assert.equal(pan.left,600); assert.equal(pan.top,0)
})
test('one-finger drag and two-finger pinch use continuous midpoint geometry',()=>{
  assert.deepEqual(pinchGeometry([{x:40,y:60}]),{center:{x:40,y:60},distance:0})
  assert.deepEqual(pinchGeometry([{x:10,y:20},{x:110,y:20}]),{center:{x:60,y:20},distance:100})
})
