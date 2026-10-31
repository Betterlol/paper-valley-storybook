import * as T from './three.module.js';

// A single print palette and ink weight for the book, Blender asset and scenery.
const ramp = new T.DataTexture(new Uint8Array([64,139,207,255]),4,1,T.RedFormat);
ramp.minFilter=ramp.magFilter=T.NearestFilter;ramp.needsUpdate=true;
const pixels=new Uint8Array(64*64*4);
for(let i=0;i<4096;i++) {
  const fibre=250+((i*37^(i>>3)*19)%6);
  pixels.set([fibre,fibre,fibre,255],i*4);
}
const grain=new T.DataTexture(pixels,64,64,T.RGBAFormat);
grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(2,2);grain.needsUpdate=true;
const cache=new Map();
export function paper(color) {
  if(!cache.has(color))cache.set(color,new T.MeshToonMaterial({color,map:grain,gradientMap:ramp}));
  return cache.get(color);
}
export const ink=new T.LineBasicMaterial({color:0x62574a,transparent:true,opacity:.24});
export function outline(mesh,angle=38) {
  const lines=new T.LineSegments(new T.EdgesGeometry(mesh.geometry,angle),ink);
  mesh.add(lines);return lines;
}
export const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
