import assert from 'node:assert/strict';
import * as T from '../dist/three.module.js';
import {createDiorama, railway, riverCenter, riverHalfWidth} from '../dist/diorama.js';

// Real Three.js geometry, with only the browser's text drawing surface stubbed.
// This verifies construction and placement; it cannot verify GPU appearance.
globalThis.document = {
  createElement: () => ({getContext: () => ({fillRect(){}, strokeRect(){}, fillText(){}})}),
};
const scene = new T.Scene();
const lists = {trees:[], wheels:[], trains:[], leaves:[], clickable:[], smoke:[]};
const worlds = [false, true].map(autumn => createDiorama({parent:scene, autumn, ...lists}));
scene.updateMatrixWorld(true);
let meshes = 0, vertices = 0;
scene.traverse(object => {
  if (!object.isMesh) return;
  meshes++;
  const position = object.geometry.getAttribute('position');
  assert(position?.count > 0, 'Every mesh must have vertices');
  for (const v of position.array) assert(Number.isFinite(v), 'No invalid geometry coordinates');
  vertices += position.count;
  object.geometry.computeBoundingBox();
  const bounds = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
  assert(bounds.min.y > -.1 && bounds.max.y < 8, 'Scenery stays above the book and within its intended height');
});
assert.equal(worlds.length, 2);
assert.equal(lists.trains.length, 2);
assert(lists.clickable.length > 0);
assert(lists.clickable.every(m => m.parent), 'Raycast targets survive static batching');
assert(lists.leaves.every(m => m.parent), 'Animated river ripples survive static batching');
assert(lists.smoke.every(({mesh}) => mesh.parent), 'Smoke remains independently animated');
for (let i=0; i<500; i++) {
  const p=railway.getPointAt(i/500), t=railway.getTangentAt(i/500);
  assert(Math.abs(p.y-1.66) < 1e-6, 'Train follows a level track');
  assert(Math.abs(t.length()-1) < 1e-6, 'Track orientation is well defined');
  assert(Math.abs(p.x)<6 && p.z>=-4.1 && p.z<1, 'Track fits inside book');
  if (Math.abs(p.x) < 1.7) {
    assert(Math.abs(p.z-.62)<.15 || Math.abs(p.z+3.63)<.15, 'River crossings align with bridge decks');
  }
}
for(let i=0;i<50;i++) {
  const z=-4.5+i*9/49;
  assert(Math.abs(riverCenter(z))+riverHalfWidth(z)<1.5, 'River fits between the banks');
}
console.log(JSON.stringify({passed:true, worlds:worlds.length, meshes, vertices, trees:lists.trees.length,
  checks:['finite geometry','scenery bounds','retained animation and click targets','railway continuity','bridge alignment','river bounds']}));
