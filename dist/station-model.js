import * as T from './three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {paper,outline,smooth} from './paper-style.js';

export async function loadStationTemplate(bytes) {
  if(!bytes) {
    const response=await fetch(new URL('./assets/station.glb',import.meta.url));
    if(!response.ok)throw new Error(`Station asset: ${response.status}`);
    bytes=await response.arrayBuffer();
  }
  const buffer=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  return (await new GLTFLoader().parseAsync(buffer,'')).scene;
}
const hingeSpecs=[
  ['Hinge_RoofFront','x',-2.15,.02,.38],
  ['Hinge_RoofBack','x',2.15,.04,.40],
  ['Hinge_Canopy','x',-Math.PI/2,0,.26],
  ['Hinge_Left','z',-Math.PI/2,.30,.70],
  ['Hinge_Right','z',Math.PI/2,.34,.74],
  ['Hinge_Front','x',-Math.PI/2,.44,.95],
  ['Hinge_Back','x',Math.PI/2,.48,1],
  ...Array.from({length:4},(_,i)=>[`Hinge_Bracket_${i}`,'x',-Math.PI/4,0,.15]),
  ...Array.from({length:4},(_,i)=>[`Hinge_Post_${i}`,'x',-Math.PI/2,0,.24]),
];
export function createStationRig(template) {
  if(!template)throw new Error('The Blender station template must be loaded before building the diorama.');
  const root=template.clone(true);root.name='FoldingValleyStation';root.userData.dynamic=true;
  root.traverse(o=>{
    if(!o.isMesh)return;
    const color=o.material.color?.getHex()??0xdfcaa3;
    o.material=paper(color);o.castShadow=o.receiveShadow=true;
    if(/Wall_Cardstock|Roof_sheet|End_wall|End_gable|Clock_gable|Canopy_sheet/.test(o.name))outline(o,40);
  });
  // Batch details within each hinge; never merge across an articulation joint.
  const parents=[];root.traverse(o=>{if(!o.isMesh&&!o.isLine)parents.push(o)});
  root.updateMatrixWorld(true);
  for(const parent of parents) {
    const bins=new Map();
    for(const child of parent.children)if(child.isMesh) {
      if(!bins.has(child.material))bins.set(child.material,[]);bins.get(child.material).push(child);
    }
    for(const [material,objects] of bins) {
      if(objects.length<2)continue;
      const parts=objects.map(object=>{
        object.updateMatrix();
        const source=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
        source.applyMatrix4(object.matrix);
        const g=new T.BufferGeometry();
        for(const name of['position','normal'])g.setAttribute(name,source.getAttribute(name).clone());
        const p=source.getAttribute('position');
        if(source.getAttribute('uv'))g.setAttribute('uv',source.getAttribute('uv').clone());
        else {const uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i);uv[i*2+1]=p.getY(i)}g.setAttribute('uv',new T.BufferAttribute(uv,2))}
        for(const child of [...object.children])parent.attach(child);
        object.removeFromParent();source.dispose();return g;
      });
      const merged=new T.Mesh(mergeGeometries(parts),material);merged.castShadow=merged.receiveShadow=true;parent.add(merged);parts.forEach(g=>g.dispose());
    }
  }
  root.userData.hinges=hingeSpecs.map(([name,axis,angle,start,end])=>{
    const node=root.getObjectByName(name);if(!node)throw new Error(`Missing Blender hinge ${name}`);
    return {node,axis:new T.Vector3(axis==='x'?1:0,0,axis==='z'?1:0),angle,start,end,rest:node.quaternion.clone()};
  });
  return root;
}
const rotation=new T.Quaternion();
export function foldStation(root,amount) {
  for(const hinge of root.userData.hinges) {
    rotation.setFromAxisAngle(hinge.axis,hinge.angle*smooth(hinge.start,hinge.end,amount));
    hinge.node.quaternion.copy(hinge.rest).multiply(rotation);
  }
  root.userData.fold=amount;
}
