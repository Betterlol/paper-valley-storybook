import * as T from './three.module.js';
import {smooth} from './paper-style.js';
import {foldStation} from './station-model.js';

// A leaf owns its scenery. Static merged meshes that span the gutter are split
// into triangles before they are attached to the left and right page carriers.
function splitMesh(source) {
  const g=source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone();
  g.applyMatrix4(source.matrix);
  const position=g.getAttribute('position'), parts=[[],[]];
  for(let i=0;i<position.count;i+=3) {
    const x=(position.getX(i)+position.getX(i+1)+position.getX(i+2))/3;
    parts[x<0?0:1].push(i,i+1,i+2);
  }
  const result=parts.map(indices=>{
    if(!indices.length)return null;
    const geo=new T.BufferGeometry();
    for(const [name,attribute] of Object.entries(g.attributes)) {
      const values=new Float32Array(indices.length*attribute.itemSize);
      indices.forEach((index,i)=>{for(let j=0;j<attribute.itemSize;j++)values[i*attribute.itemSize+j]=attribute.array[index*attribute.itemSize+j]});
      geo.setAttribute(name,new T.BufferAttribute(values,attribute.itemSize));
    }
    geo.computeBoundingSphere();const m=new T.Mesh(geo,source.material);m.castShadow=source.castShadow;m.receiveShadow=source.receiveShadow;return m;
  });
  g.dispose();return result;
}
export function prepareFolding(world,trees,trains,smoke,water) {
  world.updateMatrixWorld(true);
  const original=[...world.children],pages=[],shells=[];
  for(const side of[-1,1]) {
    const page=new T.Group();page.name=side<0?'LeftPageCarrier':'RightPageCarrier';
    const shell=new T.Group();shell.name='CollapsibleBackground';page.add(shell);world.add(page);
    pages.push(page);shells.push(shell);
  }
  const transient=new Set([
    ...trains.flatMap(t=>t.cars),...smoke.map(s=>s.mesh),...water,
  ]);
  const treeSet=new Set(trees);
  const station=world.userData.station;
  const inverse=world.matrixWorld.clone().invert(),center=new T.Vector3();
  for(const object of original) {
    if(transient.has(object)){object.userData.transient=true;continue}
    const articulated=treeSet.has(object)||object===station;
    if(object.isMesh&&!object.isInstancedMesh&&!object.children.length&&!object.material.transparent) {
      const parts=splitMesh(object);object.removeFromParent();parts.forEach((m,i)=>{if(m)shells[i].add(m)});continue;
    }
    const bounds=new T.Box3().setFromObject(object);
    if(bounds.isEmpty()){object.removeFromParent();continue}
    bounds.getCenter(center).applyMatrix4(inverse);
    const index=center.x<0?0:1;
    (articulated?pages[index]:shells[index]).add(object);
    if(articulated){object.userData.anchorY=object.position.y;object.userData.anchorX=object.position.x;}
  }
  world.userData.folding={pages,shells,station,trees:trees.filter(t=>t.parent===pages[0]||t.parent===pages[1]),transient:[...transient].filter(m=>m.parent===world)};
}
export function setWorldFold(world,amount,wind=0,planted=false) {
  const fold=world.userData.folding;if(!fold)return;
  const background=smooth(.15,.95,amount),treeFold=smooth(.38,1,amount);
  fold.shells.forEach(shell=>shell.scale.y=1-background*.985);
  foldStation(fold.station,amount);
  fold.station.position.x=fold.station.userData.anchorX;
  fold.station.rotation.z=0;
  fold.station.position.y=T.MathUtils.lerp(fold.station.userData.anchorY,.025,background);
  for(let i=0;i<fold.trees.length;i++) {
    const tree=fold.trees[i];
    const base=tree.userData.hero&&tree.userData.base<1?(planted?.56:.38):tree.userData.restScale;
    tree.scale.set(base,base,base*(1-treeFold*.97));
    tree.rotation.x=-Math.PI/2*treeFold;
    tree.rotation.z=Math.sin(wind*.7+i)*.012*(1-treeFold);
    tree.position.x=tree.userData.anchorX;
    tree.position.y=T.MathUtils.lerp(tree.userData.anchorY,.035,background);
  }
  fold.transient.forEach(object=>object.visible=amount<.08);
  world.userData.fold=amount;
}
export function liftWorldPage(world,side,angle) {
  const fold=world.userData.folding;
  fold.pages.forEach((page,i)=>{
    page.rotation.z=(i===0?-1:1)*(i===(side<0?0:1)?angle:0);
  });
}

// Articulated foreground pieces follow the actual curved leaf, including its
// local tangent. A rigid carrier alone would let the curled sheet swallow them.
export function followTurningPage(world,side,turning,progress) {
  const f=world.userData.folding,page=f.pages[side<0?0:1];
  page.updateMatrix();const inverse=page.matrix.clone().invert();
  for(const object of[f.station,...f.trees]) {
    if(object.parent!==page)continue;
    const pose=turning.poseAt(Math.abs(object.userData.anchorX),object.position.z);
    const bow=Math.cos(object.position.z/10.12*Math.PI)*Math.sin(progress*Math.PI)*.06;
    const point=new T.Vector3(pose.x,pose.y-.39+.035+bow,object.position.z).applyMatrix4(inverse);
    object.position.copy(point);
    object.rotation.z+=side*pose.angle-page.rotation.z;
  }
}
