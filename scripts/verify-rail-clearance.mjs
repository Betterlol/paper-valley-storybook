import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/three.module.js';
import {createDiorama,railway} from '../dist/diorama.js';
import {loadStationTemplate} from '../dist/station-model.js';

// Sweep the carriage envelope against the actual rendered static triangles.
// This includes terrain tops, building walls, station details and vegetation.
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const template=await loadStationTemplate(await readFile(new URL('../dist/assets/station.glb',import.meta.url)));
const envelope=new T.Box3(new T.Vector3(-.36,1.68,-.215),new T.Vector3(.46,2.33,.215));
const cellSize=.75;
for(const autumn of [false,true]) {
  const lists={trees:[],wheels:[],trains:[],leaves:[],clickable:[],smoke:[]};
  const world=createDiorama({parent:new T.Scene(),autumn,stationTemplate:template,...lists});
  world.updateMatrixWorld(true);
  const inverse=world.matrixWorld.clone().invert();
  // If a future train grows, the sweep must grow with it instead of silently passing.
  for(const car of lists.trains.flatMap(train=>train.cars)) {
    const toCar=car.matrixWorld.clone().invert();
    car.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const transform=new T.Matrix4().multiplyMatrices(toCar,mesh.matrixWorld),positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++) {
        const vertex=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(transform);
        vertex.y+=railway.getPointAt(0).y+.065;
        assert(envelope.containsPoint(vertex),'The sweep envelope contains the real train geometry, including wheels, roof and locomotive lamp');
      }
    });
  }
  const moving=new Set([...lists.trains.flatMap(train=>train.cars),...lists.smoke.map(smoke=>smoke.mesh),...lists.leaves]);
  const cells=new Map();
  world.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material.transparent||mesh.isInstancedMesh)return;
    for(let ancestor=mesh;ancestor&&ancestor!==world;ancestor=ancestor.parent)if(moving.has(ancestor))return;
    const geometry=mesh.geometry,index=geometry.index,positions=geometry.attributes.position;
    const transform=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
    for(let i=0;i<(index?.count??positions.count);i+=3) {
      const triangle=new T.Triangle(...[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(transform)));
      const bounds=new T.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]);
      if(bounds.max.y<envelope.min.y||bounds.min.y>envelope.max.y)continue;
      const entry={triangle,label:mesh.name||mesh.material.color?.getHexString()||'mesh'};
      for(let x=Math.floor(bounds.min.x/cellSize);x<=Math.floor(bounds.max.x/cellSize);x++)for(let z=Math.floor(bounds.min.z/cellSize);z<=Math.floor(bounds.max.z/cellSize);z++) {
        const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(entry);
      }
    }
  });
  const collisions=[];
  for(let step=0;step<1200;step++) {
    const u=step/1200,point=railway.getPointAt(u),tangent=railway.getTangentAt(u),candidates=new Set();
    for(let x=Math.floor((point.x-.6)/cellSize);x<=Math.floor((point.x+.6)/cellSize);x++)for(let z=Math.floor((point.z-.6)/cellSize);z<=Math.floor((point.z+.6)/cellSize);z++) {
      for(const candidate of cells.get(`${x},${z}`)??[])candidates.add(candidate);
    }
    const local=vertex=>{const x=vertex.x-point.x,z=vertex.z-point.z;return new T.Vector3(x*tangent.x+z*tangent.z,vertex.y,-x*tangent.z+z*tangent.x)};
    for(const {triangle,label} of candidates) {
      if(envelope.intersectsTriangle(new T.Triangle(local(triangle.a),local(triangle.b),local(triangle.c)))) {
        collisions.push({u:+u.toFixed(4),x:+point.x.toFixed(2),z:+point.z.toFixed(2),obstacle:label});break;
      }
    }
  }
  assert.equal(collisions.length,0,`${autumn?'Autumn':'Spring'} train clearance intersects scenery: ${JSON.stringify(collisions.filter((entry,i)=>i===0||entry.obstacle!==collisions[i-1].obstacle).slice(0,30))} (${collisions.length}/1200 positions)`);
}
console.log('Rail clearance passed: 1,200 complete carriage-envelope samples per season against actual scenery triangles.');
