import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Exercise the actual application frame loop and event handlers with real scene
// geometry. Only GPU rendering, text drawing and browser event delivery are stubbed.
const project=fileURLToPath(new URL('../',import.meta.url));
const elements=new Map();
globalThis.document={
  createElement(){return {getContext(){return {fillRect(){},strokeRect(){},fillText(){}}}}},
  querySelector(selector){
    if(!elements.has(selector))elements.set(selector,{style:{},classList:{add(){},remove(){}},addEventListener(){},remove(){},setPointerCapture(){}});
    return elements.get(selector);
  },
  addEventListener(){},
};
globalThis.window={addEventListener(){}};
globalThis.innerWidth=1440;globalThis.innerHeight=900;globalThis.devicePixelRatio=1;
globalThis.requestAnimationFrame=()=>{};
globalThis.setTimeout=()=>0;
let src=fs.readFileSync(path.join(project,'dist/app.js'),'utf8');
src=src.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${pathToFileURL(path.join(project,'dist',p)).href}'`);
src=src.replace('await loadStationTemplate()',`await loadStationTemplate(await (await import('node:fs/promises')).readFile(${JSON.stringify(path.join(project,'dist/assets/station.glb'))}))`);
const begin=src.indexOf('let renderer;'),end=src.indexOf('const scene=');
src=src.slice(0,begin)+`const renderer={shadowMap:{},setPixelRatio(){},setSize(){},setClearColor(){},render(){}};`+src.slice(end);
src+=`
const assert=(v,m)=>{if(!v)throw Error(m)};
let tick=0;
function advance(frames){for(let i=0;i<frames;i++){tick+=40;frame(tick)}}
water();assert(planted,'planting');advance(1);
const heroSpring=trees.find(tree=>tree.userData.hero&&tree.userData.base<1);
const heroAutumn=trees.find(tree=>tree.userData.hero&&tree.userData.base>=1);
assert(heroSpring.position.x===heroAutumn.position.x&&heroSpring.position.z===heroAutumn.position.z,'The same tree stays at the same geographic anchor across time');
assert(droplets.filter(drop=>drop.visible).length>0,'Watering has visible droplets');
assert(droplets.every(drop=>Math.abs(drop.position.x-heroSpring.position.x)<.3&&Math.abs(drop.position.z-heroSpring.position.z)<.3),'Watering follows the relocated sapling');
turn(1);
advance(75);
assert(flip,'A staged turn is still in progress while the station folds');
assert(worlds[0].userData.station.userData.fold>.95,'Station closes before leaf rises');
assert(worlds[0].userData.station.scale.y===1,'Station is not vertically squashed');
scene.updateMatrixWorld(true);
const stationPoint=book.worldToLocal(worlds[0].userData.station.getWorldPosition(new T.Vector3()));
const paperPose=turningPage.poseAt(4.05);
assert(stationPoint.y>=paperPose.y&&stationPoint.y<paperPose.y+.12,'Station stays above the curled leaf');
advance(110);
assert(page===1&&!flip,'forward turn completes');
assert(worlds[1].visible&&!worlds[0].visible,'only destination page remains visible');
assert(Math.abs(worlds[1].userData.fold)<1e-8,'destination fully unfolds');
readLetter();assert(delivered,'letter ending');turn(0);advance(185);
assert(page===0&&!flip,'reverse turn completes');
assert(planted,'planting persists');
assert(!document.querySelector('#water').disabled,'controls restored after turn');
for(const [width,height] of [[390,844],[320,1200]]) {
  globalThis.innerWidth=width;globalThis.innerHeight=height;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();reset();cameraUpdate();camera.updateMatrixWorld(true);
  assert(scene.fog.near>camera.position.distanceTo(orbit.target)+5,'Adaptive fog keeps the portrait book visible');
  for(const x of [-7.56,7.56])for(const z of [-5.32,5.32]) {
    const corner=new T.Vector3(x,-.3,z);book.localToWorld(corner);corner.project(camera);
    assert(Math.abs(corner.x)<.98,'The complete book fits a portrait phone viewport: corner '+[x,z]+' projects to '+corner.x);
    assert(corner.z>-1&&corner.z<1,'Distant portrait framing stays inside the camera clipping planes');
  }
}
globalThis.innerWidth=1440;globalThis.innerHeight=900;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();reset();cameraUpdate();
console.log(JSON.stringify({passed:true,checks:['planting and relocated watering','roof and wall stage','paper ownership','forward unfold','letter ending','reverse unfold','persistent state','restored controls','portrait framing and fog']}));
`;
if(process.env.PAPER_VALLEY_EXPORT)src+=`
${process.env.PAPER_VALLEY_POSE==='fold'?'turn(1);advance(70);':''}
scene.updateMatrixWorld(true);
const dump=[];
scene.traverse(m=>{
  if(!m.isMesh||m.material.transparent)return;let p=m;while(p){if(!p.visible)return;p=p.parent}
  const position=m.geometry.attributes.position;
  const addMesh=(matrix,color)=>{
    const vertices=[],point=new T.Vector3();
    for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(matrix);vertices.push(point.x,point.y,point.z)}
    dump.push({vertices,indices:m.geometry.index?Array.from(m.geometry.index.array):null,color});
  };
  if(m.isInstancedMesh){for(let i=0;i<m.count;i++){const matrix=new T.Matrix4();m.getMatrixAt(i,matrix);const color=new T.Color();m.getColorAt(i,color);addMesh(m.matrixWorld.clone().multiply(matrix),color.getHex())}}
  else addMesh(m.matrixWorld,m.material.color?.getHex()??0xe3d5ba);
});
(await import('node:fs')).writeFileSync(${JSON.stringify(process.env.PAPER_VALLEY_EXPORT)},JSON.stringify({meshes:dump,camera:camera.position.toArray(),target:orbit.target.toArray()}));
`;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'paper-valley-check-'));
try{const file=path.join(temp,'runtime.mjs');fs.writeFileSync(file,src);await import(pathToFileURL(file).href)}finally{fs.rmSync(temp,{recursive:true,force:true})}
