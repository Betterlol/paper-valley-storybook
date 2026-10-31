import * as T from './three.module.js';
import {smooth} from './paper-style.js';
import {foldStation} from './station-model.js';

// Clip at the actual gutter, including interpolated normals and texture UVs.
export function splitMesh(source) {
  const g=source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone();
  g.applyMatrix4(source.matrix);
  const attributes=Object.entries(g.attributes),parts=[[],[]];
  let stride=0;
  const layout=attributes.map(([name,attribute])=>{const entry={name,attribute,offset:stride};stride+=attribute.itemSize;return entry});
  const offset=layout.find(entry=>entry.name==='position').offset;
  const vertex=index=>layout.flatMap(({attribute})=>Array.from({length:attribute.itemSize},(_,j)=>attribute.getComponent(index,j)));
  function append(polygon,side) {
    for(let i=1;i<polygon.length-1;i++) {
      const triangle=[polygon[0],polygon[i],polygon[i+1]];
      const a=new T.Vector3(...triangle[0].slice(offset,offset+3));
      const b=new T.Vector3(...triangle[1].slice(offset,offset+3));
      const c=new T.Vector3(...triangle[2].slice(offset,offset+3));
      if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-16)parts[side].push(...triangle.flat());
    }
  }
  for(let i=0;i<g.attributes.position.count;i+=3) {
    const triangle=[vertex(i),vertex(i+1),vertex(i+2)];
    if(triangle.every(v=>v[offset]>=0)){append(triangle,1);continue}
    if(triangle.every(v=>v[offset]<=0)){append(triangle,0);continue}
    for(const side of [0,1]) {
      const sign=side===0?-1:1,polygon=[];
      for(let j=0;j<3;j++) {
        const a=triangle[j],b=triangle[(j+1)%3],inside=a[offset]*sign>=0,nextInside=b[offset]*sign>=0;
        if(inside)polygon.push(a);
        if(inside!==nextInside) {
          const t=-a[offset]/(b[offset]-a[offset]);
          const cut=a.map((value,k)=>T.MathUtils.lerp(value,b[k],t));cut[offset]=0;polygon.push(cut);
        }
      }
      append(polygon,side);
    }
  }
  const result=parts.map(values=>{
    if(!values.length)return null;
    const geo=new T.BufferGeometry();
    const count=values.length/stride;
    for(const {name,attribute,offset} of layout) {
      const array=new Float32Array(count*attribute.itemSize);
      for(let i=0;i<count;i++)for(let j=0;j<attribute.itemSize;j++)array[i*attribute.itemSize+j]=values[i*stride+offset+j];
      geo.setAttribute(name,new T.BufferAttribute(array,attribute.itemSize));
    }
    if(geo.attributes.normal)geo.normalizeNormals();
    geo.computeBoundingSphere();const m=new T.Mesh(geo,source.material);m.castShadow=source.castShadow;m.receiveShadow=source.receiveShadow;return m;
  });
  g.dispose();return result;
}
export function prepareFolding(world,trees,trains,smoke,water) {
  world.updateMatrixWorld(true);
  const original=[...world.children],pages=[],shells=[],panels=[];
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
    const articulated=treeSet.has(object)||object===station||!!object.userData.paperHinge;
    // Apply the leaf's Z tangent rotation outside the local X folding rotation.
    if(treeSet.has(object)||object.userData.paperHinge)object.rotation.reorder('ZXY');
    if(object.userData.paperHinge)panels.push(object);
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
  world.userData.folding={pages,shells,station,panels,trees:trees.filter(t=>t.parent===pages[0]||t.parent===pages[1]),transient:[...transient].filter(m=>m.parent===world)};
}
export function setWorldFold(world,amount,wind=0,planted=false) {
  const fold=world.userData.folding;if(!fold)return;
  const background=smooth(.15,.95,amount),treeFold=smooth(.38,1,amount);
  fold.shells.forEach(shell=>shell.scale.y=1-background*.985);
  for(const panel of fold.panels) {
    const hinge=panel.userData.paperHinge;
    panel.rotation.x=hinge.angle*smooth(hinge.start,hinge.end,amount);
    panel.position.x=panel.userData.anchorX;
    panel.position.y=T.MathUtils.lerp(panel.userData.anchorY,.035,background);
    panel.rotation.z=0;
  }
  foldStation(fold.station,amount);
  fold.station.position.x=fold.station.userData.anchorX;
  fold.station.rotation.z=0;
  fold.station.position.y=T.MathUtils.lerp(fold.station.userData.anchorY,.025,background);
  for(let i=0;i<fold.trees.length;i++) {
    const tree=fold.trees[i];
    const base=tree.userData.hero&&tree.userData.base<1?tree.userData.base+(planted?.16:0):tree.userData.restScale;
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
  for(const object of[f.station,...f.trees,...f.panels]) {
    if(object.parent!==page)continue;
    const pose=turning.poseAt(Math.abs(object.userData.anchorX),object.position.z);
    const bow=Math.cos(object.position.z/10.12*Math.PI)*Math.sin(progress*Math.PI)*.06;
    const point=new T.Vector3(pose.x,pose.y-.39+.035+bow,object.position.z).applyMatrix4(inverse);
    object.position.copy(point);
    object.rotation.z+=side*pose.angle-page.rotation.z;
  }
}
