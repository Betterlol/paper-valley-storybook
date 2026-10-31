import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadStationTemplate,foldStation} from '../dist/station-model.js';
import {prepareFolding,setWorldFold,liftWorldPage} from '../dist/folding.js';
import {createBook,createTurningPage,pageHeight,BOOK_LEAF_WIDTH} from '../dist/book-body.js';
import * as T from '../dist/three.module.js';
import {createDiorama, railway, riverCenter, riverHalfWidth} from '../dist/diorama.js';

// Real Three.js geometry, with only the browser's text drawing surface stubbed.
// This verifies construction and placement; it cannot verify GPU appearance.
globalThis.document = {
  createElement: () => ({getContext: () => ({fillRect(){}, strokeRect(){}, fillText(){}})}),
};
const stationTemplate=await loadStationTemplate(await readFile(new URL('../dist/assets/station.glb',import.meta.url)));
for(const [name,hinge] of [['Chimney_stack','Hinge_RoofBack'],['Platform_flower_box','Hinge_Front'],['Canopy_fascia','Hinge_Canopy']]) {
  let object=stationTemplate.getObjectByName(name);
  assert(object,`${name} survives Blender export`);
  while(object&&object.name!==hinge)object=object.parent;
  assert(object,`${name} is attached to its folding joint`);
}
const stationColors=new Map();
stationTemplate.traverse(o=>{if(o.isMesh)stationColors.set(o.material.name,o.material.color.getHex())});
for(const [name,color] of [['roof',0x537b7b],['timber',0x8a7350],['paper',0xe5cfa3]]) {
  assert.equal(stationColors.get(name),color,`Exported ${name} color survives the real GLB loader`);
}
const scene = new T.Scene();
const lists = {trees:[], wheels:[], trains:[], leaves:[], clickable:[], smoke:[]};
const worlds = [false, true].map(autumn => createDiorama({parent:scene, autumn, stationTemplate, ...lists}));
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
  assert(Math.abs(p.x)<7 && p.z>=-4.1 && p.z<1, 'Track fits inside book');
  if (Math.abs(p.x) < 1.7) {
    assert(Math.abs(p.z-.62)<.15 || Math.abs(p.z+3.63)<.15, 'River crossings align with bridge decks');
  }
}
for(let i=0;i<50;i++) {
  const z=-4.5+i*9/49;
  assert(Math.abs(riverCenter(z))+riverHalfWidth(z)<1.5, 'River fits between the banks');
}
// Check true articulation and page ownership, not a whole-world squash.
const station=worlds[0].userData.station;
const openSize=new T.Box3().setFromObject(station).getSize(new T.Vector3());
foldStation(station,1);scene.updateMatrixWorld(true);
const closedBounds=new T.Box3();
station.traverse(m=>{if(m.isMesh){const p=m.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++)closedBounds.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld))}});
const closedSize=closedBounds.getSize(new T.Vector3());
assert(closedBounds.min.y>=station.getWorldPosition(new T.Vector3()).y-.011,'The folded station stays above its mounting platform');
assert(closedSize.y<openSize.y*.6,'Hinged station folds to a substantially lower profile');
foldStation(station,0);
for(const world of worlds)prepareFolding(world,lists.trees,lists.trains,lists.smoke,lists.leaves);
for(const amount of[0,.2,.5,.8,1,0]) {
  setWorldFold(worlds[0],amount,0,true);liftWorldPage(worlds[0],-1,amount*Math.PI);
  scene.updateMatrixWorld(true);
  scene.traverse(o=>{for(const value of o.matrixWorld.elements)assert(Number.isFinite(value),'Fold transforms remain finite')});
}
assert(Math.abs(station.scale.y-1)<1e-8,'Station folds on hinges without vertical scaling');
assert.equal(station.parent.name,'LeftPageCarrier','Station rides its paper leaf');
assert.equal(station.getObjectByName('Hinge_RoofFront').parent.name,'Hinge_Front','Roof is attached to its wall hinge');
assert.equal(station.userData.hinges.length,15);
const book=createBook(scene),turning=createTurningPage(book);
const topSheets=book.children.filter(m=>m.isMesh&&m.material.color?.getHex()===0xf1e4c5);
assert.equal(topSheets.length,2);
assert(topSheets.every(m=>m.geometry.attributes.normal.getY(20)>.5),'Page top faces point upwards');
assert(pageHeight(4)>pageHeight(.1),'The bound pages have a recessed gutter');
for(const t of[0,.25,.5,.75,1]) {
  turning.update(t,-1);
  const a=turning.geometry.attributes.position.array;
  for(const value of a)assert(Number.isFinite(value),'Curved leaf remains finite');
  // Each cross section is integrated at equal arc length and cannot stretch.
  for(let i=1;i<turning.samples.length;i++) {
    const a=turning.samples[i-1],b=turning.samples[i];
    assert(Math.abs(Math.hypot(b[0]-a[0],b[1]-a[1])-BOOK_LEAF_WIDTH/64)<1e-5,'Page curl preserves paper length');
  }
}
console.log('Articulation:',JSON.stringify({openHeight:openSize.y,closedHeight:closedSize.y,hinges:station.userData.hinges.length}));
console.log(JSON.stringify({passed:true, worlds:worlds.length, meshes, vertices, trees:lists.trees.length,
  checks:['finite geometry','scenery bounds','retained animation and click targets','railway continuity','bridge alignment','river bounds']}));
