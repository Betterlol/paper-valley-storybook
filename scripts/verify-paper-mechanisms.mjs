import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/three.module.js';
import {loadStationTemplate} from '../dist/station-model.js';
import {createDiorama} from '../dist/diorama.js';
import {prepareFolding,setWorldFold,splitMesh,liftWorldPage,followTurningPage} from '../dist/folding.js';
import {createTurningPage} from '../dist/book-body.js';
import {smooth} from '../dist/paper-style.js';

// A crossing triangle must keep its area and UVs while acquiring a straight seam.
const geometry=new T.BufferGeometry();
geometry.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,1,0,0,1,0,2],3));
geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1],2));
geometry.computeVertexNormals();
const source=new T.Mesh(geometry);source.updateMatrix();
const parts=splitMesh(source);
let area=0;
parts.forEach((mesh,side)=>{
  assert(mesh,'Both leaves receive part of a crossing triangle');
  const positions=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i);
    assert(side===0?x<=1e-7:x>=-1e-7,'Triangles never protrude past their page at the gutter');
    if(Math.abs(x)<1e-7)assert(Math.abs(uv.getX(i)-.5)<1e-7,'UVs interpolate across the cut');
  }
  for(let i=0;i<positions.count;i+=3) {
    const a=new T.Vector3().fromBufferAttribute(positions,i);
    const b=new T.Vector3().fromBufferAttribute(positions,i+1);
    const c=new T.Vector3().fromBufferAttribute(positions,i+2);
    area+=b.sub(a).cross(c.sub(a)).length()/2;
  }
});
assert(Math.abs(area-2)<1e-7,'Clipping preserves total surface area');

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const template=await loadStationTemplate(await readFile(new URL('../dist/assets/station.glb',import.meta.url)));
for(const autumn of [false,true]) {
  const lists={trees:[],wheels:[],trains:[],leaves:[],clickable:[],smoke:[]};
  const world=createDiorama({parent:new T.Scene(),autumn,stationTemplate:template,...lists});
  prepareFolding(world,lists.trees,lists.trains,lists.smoke,lists.leaves);
  const panels=world.userData.folding.panels;
  assert.equal(panels.length,6,'Three mountain layers have independent left and right paper panels');
  const rest=panels.map(panel=>panel.quaternion.clone());
  const heights=panels.map(panel=>new T.Box3().setFromObject(panel).getSize(new T.Vector3()).y);
  for(const amount of [0,.3,.7,1]) {
    setWorldFold(world,amount);
    world.updateMatrixWorld(true);
    for(const panel of panels) {
      assert.equal(panel.scale.y,1,'Mountains fold without vertical compression');
      assert.equal(panel.parent.name,panel.name.endsWith('left')?'LeftPageCarrier':'RightPageCarrier','Mountain belongs to the correct paper leaf');
      for(const value of panel.matrixWorld.elements)assert(Number.isFinite(value));
    }
  }
  panels.forEach((panel,i)=>assert(new T.Box3().setFromObject(panel).getSize(new T.Vector3()).y<heights[i]*.1,'Mountain paper lies flat'));
  setWorldFold(world,0);
  panels.forEach((panel,i)=>assert(panel.quaternion.angleTo(rest[i])<1e-7,'Mountain rest pose is reversible'));
  const turning=createTurningPage(world.parent);
  for(const side of [-1,1])for(const progress of [.2,.4,.6,.8]) {
    setWorldFold(world,1);
    liftWorldPage(world,side,Math.PI*smooth(0,1,progress));
    turning.update(progress,side);
    followTurningPage(world,side,turning,progress);
    world.updateMatrixWorld(true);
    for(const object of [...panels,...world.userData.folding.trees]) {
      if(object.parent!==world.userData.folding.pages[side<0?0:1])continue;
      const pose=turning.poseAt(Math.abs(object.userData.anchorX));
      const expected=new T.Vector3(Math.sin(side*pose.angle),-Math.cos(side*pose.angle),0);
      if(!object.userData.paperHinge)expected.negate();
      const normal=new T.Vector3(0,0,1).transformDirection(object.matrixWorld);
      assert(normal.angleTo(expected)<1e-6,'Folded paper normals follow the curved leaf tangent on both sides');
    }
    liftWorldPage(world,side,0);setWorldFold(world,0);
  }
}
console.log('Paper mechanisms passed: exact gutter clipping, interpolated UVs, preserved area, six reversible mountain hinges in both seasons.');
