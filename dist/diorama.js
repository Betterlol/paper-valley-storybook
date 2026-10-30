import * as T from './three.module.js';

// All dimensions are in book-local units. Geometry stays deterministic across
// seasons so the village remains recognisable when a page is turned.
export const riverCenter = z => Math.sin(z * .72) * .28 - .08;
export const riverHalfWidth = z => .82 + .17 * Math.cos(z * .9);
const RAIL_HEIGHT = 1.66;
const track = new T.CatmullRomCurve3([
  [-5.35, RAIL_HEIGHT, -.15], [-3.8, RAIL_HEIGHT, .62],
  [0, RAIL_HEIGHT, .62], [3.7, RAIL_HEIGHT, .54],
  [5.45, RAIL_HEIGHT, -.7], [5.38, RAIL_HEIGHT, -2.8],
  [3.3, RAIL_HEIGHT, -3.63], [0, RAIL_HEIGHT, -3.63],
  [-3.8, RAIL_HEIGHT, -3.55], [-5.55, RAIL_HEIGHT, -2.35],
].map(p => new T.Vector3(...p)), true, 'centripetal');
export const railway = track;

let randomSeed;
function random() {
  randomSeed = (1664525 * randomSeed + 1013904223) >>> 0;
  return randomSeed / 4294967296;
}
const gradient = new T.DataTexture(new Uint8Array([86, 166, 224, 255]), 4, 1, T.RedFormat);
gradient.minFilter = gradient.magFilter = T.NearestFilter;
gradient.needsUpdate = true;
const grainBytes = new Uint8Array(64 * 64 * 4);
for (let i = 0; i < 64 * 64; i++) {
  // Fine fibres, low contrast enough to disappear from the overview.
  const v = 242 + ((i * 37 ^ (i >> 3) * 19) % 14);
  grainBytes.set([v, v, v, 255], i * 4);
}
const grain = new T.DataTexture(grainBytes, 64, 64, T.RGBAFormat);
grain.wrapS = grain.wrapT = T.RepeatWrapping;
grain.repeat.set(3, 3);
grain.needsUpdate = true;
const materials = new Map();
function paper(color) {
  if (!materials.has(color)) materials.set(color, new T.MeshToonMaterial({ color, gradientMap: gradient, map: grain }));
  return materials.get(color);
}
const ink = new T.LineBasicMaterial({color: 0x534d48, transparent: true, opacity: .27});
function add(parent, geometry, color, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geometry, paper(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(p, c, x, y, z, w, h, d) { return add(p, new T.BoxGeometry(w, h, d), c, x, y, z); }
function cylinder(p, c, x, y, z, r, h, n = 8, top = r) {
  return add(p, new T.CylinderGeometry(top, r, h, n), c, x, y, z);
}
function group(p, x = 0, y = 0, z = 0) {
  const g = new T.Group(); g.position.set(x, y, z); p.add(g); return g;
}
function edges(m, angle = 35) {
  m.add(new T.LineSegments(new T.EdgesGeometry(m.geometry, angle), ink));
  return m;
}
function beam(p, a, b, width, color) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b);
  const m = box(p, color, 0, 0, 0, width, start.distanceTo(end), width);
  m.position.copy(start).add(end).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize());
  return m;
}
function polygon(p, points, bottom, depth, color, outline = false) {
  const shape = new T.Shape();
  points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 3});
  geometry.rotateX(-Math.PI / 2);
  const m = add(p, geometry, color, 0, bottom, 0);
  if (outline) edges(m, 42);
  return m;
}
function curve(p, points, color, radius = .012) {
  return add(p, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 20, radius, 4, false), color);
}
const shadowBytes = new Uint8Array(32 * 32 * 4);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const r = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
  shadowBytes.set([54, 49, 53, Math.round(Math.max(0, 1 - r) ** 2 * 110)], (y * 32 + x) * 4);
}
const shadowTexture = new T.DataTexture(shadowBytes, 32, 32); shadowTexture.needsUpdate = true;
const shadowMaterial = new T.MeshBasicMaterial({map: shadowTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1});
function contact(p, x, y, z, w, d) {
  const m = new T.Mesh(new T.PlaneGeometry(w, d), shadowMaterial);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + .008, z); p.add(m);
}

// Layer contours have deliberately different edges: each paper stratum catches
// the light, while the inner edge follows the same river spline.
function bankContour(side, inset, front = 4.35, back = -4.38) {
  const points = [];
  for (let i = 0; i <= 28; i++) {
    const z = front + (back - front) * i / 28;
    const x = riverCenter(z) + side * (riverHalfWidth(z) + inset + .045 * Math.sin(i * 1.9));
    points.push([x, z]);
  }
  for (let i = 0; i <= 12; i++) {
    const z = back + (front - back) * i / 12;
    points.push([side * (6.89 + .09 * Math.sin(i * 2.7)), z]);
  }
  return points;
}
function land(p, autumn) {
  const grass = autumn ? 0xa6a16e : 0x9cab78;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      polygon(p, bankContour(side, .10 + i * .055), .04 + i * .12, .125,
        [0xbaac8e, 0xd2c2a0, 0xb6a88a, 0xd3c5a4, grass][i], i === 4);
    }
    const mid = side < 0
      ? [[-2.08,1.65],[-2.15,.3],[-1.7,-1.25],[-1.85,-3.9],[-6.72,-4.02],[-6.75,1.55],[-5.8,1.85],[-4.3,1.7]]
      : [[1.65,1.25],[2.1,.25],[1.7,-1.5],[1.65,-3.9],[6.75,-4.02],[6.8,1.4],[5.6,1.75],[3.9,1.5]];
    polygon(p, mid, .64, side < 0 ? .71 : .45, 0xb6aa8c);
    polygon(p, mid, side < 0 ? 1.35 : 1.09, .055, grass, true);
    // Two rear ledges establish height without identical rectangular terraces.
    const rear = [[side*2.3,-2.5],[side*3.2,-2.25],[side*4.4,-2.6],[side*6.75,-2.2],[side*6.8,-4.24],[side*2.15,-4.26]];
    polygon(p, rear, 1.4, .38, 0xb4aa91);
    polygon(p, rear, 1.78, .06, autumn ? 0x9a956b : 0x91a17a, true);
    // Thin strata and angular facets on the exposed cliff faces.
    for (let i = 0; i < 13; i++) {
      const z = -3.7 + i * .4;
      const x = riverCenter(z) + side * (riverHalfWidth(z) + .4);
      const g = add(p, new T.DodecahedronGeometry(.16 + random()*.10, 0), i % 2 ? 0xb9b49c : 0xd1c8ab, x, .33, z);
      g.scale.set(.8, 1.5, 1.2);
    }
  }
  return grass;
}
function water(p, autumn, flows) {
  const positions = [], indices = [], uv = [];
  for (let i = 0; i <= 70; i++) {
    const z = -4.56 + i / 70 * 9.12;
    const center = riverCenter(z), width = riverHalfWidth(z) + .16;
    positions.push(center-width,.12,z,center+width,.12,z);
    uv.push(0,i/8,1,i/8);
    if (i < 70) { const k=i*2; indices.push(k,k+2,k+1,k+1,k+2,k+3); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  add(p,geometry,autumn?0x6e9da0:0x69a8af);
  const ripples = new T.InstancedMesh(new T.BoxGeometry(.13,.006,.035), paper(0xffffff), 55);
  ripples.userData.dynamic=true;
  ripples.userData.flows=[];
  ripples.instanceMatrix.setUsage(T.DynamicDrawUsage);
  // The complete water surface is the culling volume, rather than one ripple.
  ripples.frustumCulled=false;
  for (let i=0;i<55;i++) {
    ripples.userData.flows.push({z:random()*8.8-4.4,offset:(random()-.5)*1.3,speed:.10+random()*.17,width:.4+random()});
    ripples.setColorAt(i,new T.Color(i%4?0xafd1c9:0xe9e6cb));
  }
  p.add(ripples);flows.push(ripples);updateRiver(ripples,0);
  // Shallows and small sand bars give the water an actual bank to meet.
  for (let i = 0; i < 46; i++) {
    const z = -4.25 + random()*8.5, side=i%2?1:-1;
    const x=riverCenter(z)+side*(riverHalfWidth(z)+.03);
    const stone=add(p,new T.IcosahedronGeometry(.07+random()*.12),[0xc3c0a9,0xd8cdb0,0xa6aaa0][i%3],x,.18,z);
    stone.scale.set(1.3,.55,.85); stone.rotation.y=random()*4;
  }
}
const rippleTransform=new T.Object3D();
export function updateRiver(surface,dt) {
  surface.userData.flows.forEach((flow,i)=>{
    flow.z+=dt*flow.speed;if(flow.z>4.48)flow.z=-4.48;
    rippleTransform.position.set(riverCenter(flow.z)+flow.offset,.132,flow.z);
    rippleTransform.scale.set(flow.width,1,1);rippleTransform.updateMatrix();
    surface.setMatrixAt(i,rippleTransform.matrix);
  });
  surface.instanceMatrix.needsUpdate=true;
}
function mountains(p) {
  const shades=[0xa6b5ad,0x8faaa6,0x829b99];
  for (let layer=0;layer<3;layer++) {
    const points=[[-7,0]], count=13;
    for(let i=0;i<=count;i++) {
      const x=-7+i/count*14;
      const h=1.4+(layer===0?1.0:.5)+random()*1.25;
      points.push([x,h]);
    }
    points.push([7,0]);
    const shape=new T.Shape(); points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const m=add(p,new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false}),shades[layer],0,1.25,-4.42+layer*.27);
    edges(m,50);
  }
}
function bridge(p, z, small = false) {
  const g=group(p,0,0,z), half=small?1.7:1.83, radius=small?1.06:1.12;
  const spring=.32, underside=1.51;
  // Shape runs clockwise around the outside and back along the arch intrados.
  const shape=new T.Shape();shape.moveTo(-half,.13);shape.lineTo(-half,underside);
  shape.lineTo(half,underside);shape.lineTo(half,.13);shape.lineTo(radius,.13);shape.lineTo(radius,spring);
  shape.absarc(0,spring,radius,0,Math.PI,false);shape.lineTo(-radius,.13);shape.closePath();
  const body=add(g,new T.ExtrudeGeometry(shape,{depth:.70,bevelEnabled:false}),0xc3baa0,0,0,-.35);edges(body,45);
  // Radially cut voussoirs frame the opening on both faces.
  for (const face of [-.37,.37]) for(let i=0;i<13;i++) {
    const a=i/13*Math.PI,b=(i+1)/13*Math.PI,outer=radius+.18;
    const s=new T.Shape();s.moveTo(Math.cos(a)*radius,spring+Math.sin(a)*radius);
    s.lineTo(Math.cos(a)*outer,spring+Math.sin(a)*outer);s.lineTo(Math.cos(b)*outer,spring+Math.sin(b)*outer);
    s.lineTo(Math.cos(b)*radius,spring+Math.sin(b)*radius);s.closePath();
    edges(add(g,new T.ExtrudeGeometry(s,{depth:.035,bevelEnabled:false}),i%2?0xe0d2b2:0xcdbf9e,0,0,face));
  }
  box(g,0xd4c7a6,0,1.56,0,half*2+.12,.10,.81);
  for(const face of [-.41,.41]) {
    box(g,0xe5d5b4,0,1.84,face,half*2+.14,.085,.10);
    for(let i=0;i<=16;i++)box(g,0xa99e86,-half+i*half/8,1.71,face,.045,.23,.045);
    for(let side of [-1,1])box(g,0xc7b99a,side*half,1.73,face,.14,.39,.15);
    // Masonry joints are confined to the piers, not drawn across the opening.
    for(let side of[-1,1])for(let j=0;j<5;j++)box(g,0xa99d84,side*(half+radius)/2,.25+j*.22,face,.43,.012,.012);
  }
}
function railwayModel(p) {
  const N=220;
  const positions=[],indices=[];
  for(let i=0;i<=N;i++) {
    const u=i/N,pt=track.getPointAt(u),t=track.getTangentAt(u);
    const n=new T.Vector3(-t.z,0,t.x).normalize();
    positions.push(pt.x+n.x*.25,1.60,pt.z+n.z*.25,pt.x-n.x*.25,1.60,pt.z-n.z*.25);
    if(i<N){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}
    if(i%2===0) {
      const tie=box(p,0x8e795d,pt.x,1.628,pt.z,.075,.045,.43);
      tie.rotation.y=-Math.atan2(t.z,t.x);
    }
    // Build an embankment under the complete track, excluding the two arches.
    if(i<N&&Math.abs(pt.x)>1.73) {
      const next=track.getPointAt((i+1)/N), length=pt.distanceTo(next)+.025;
      const support=box(p,0xb9ad90,(pt.x+next.x)/2,1.10,(pt.z+next.z)/2,length,1.0,.53);
      support.rotation.y=-Math.atan2(next.z-pt.z,next.x-pt.x);
    }
  }
  const bed=new T.BufferGeometry();bed.setAttribute('position',new T.Float32BufferAttribute(positions,3));bed.setIndex(indices);bed.computeVertexNormals();add(p,bed,0xc1b698);
  for(const offset of[-.105,.105]) {
    const pts=[];
    for(let i=0;i<=N;i++){const pt=track.getPointAt(i/N),t=track.getTangentAt(i/N);pts.push(new T.Vector3(pt.x-t.z*offset,RAIL_HEIGHT,pt.z+t.x*offset))}
    add(p,new T.TubeGeometry(new T.CatmullRomCurve3(pts),N,.018,5,false),0x656c67);
  }
}
function roof(p,w,d,y,color) {
  // Separate thin panels leave visible eaves and a paper ridge seam.
  const rise=w*.34, length=Math.hypot(w/2,rise);
  for(const side of[-1,1]) {
    const panel=box(p,color,side*w/4,y+rise/2,0,length,.065,d);
    panel.rotation.z=-side*Math.atan2(rise,w/2);edges(panel);
    for(let i=0;i<7;i++) {
      const t=(i+.4)/7;
      const seam=box(p,0x587a79,side*w*.5*t,y+rise*(1-t)+.044,0,.012,.014,d-.02);
      seam.rotation.z=panel.rotation.z;
    }
    for(let j=0;j<9;j++)beam(p,[side*.04,y+rise+.045,-d/2+j*d/8],[side*w/2,y+.045,-d/2+j*d/8],.009,0x668481);
  }
  box(p,0x315b60,0,y+rise+.045,0,.07,.065,d+.06);
  return y+rise;
}
function windowFrame(p,x,y,z,w=.22,h=.34) {
  box(p,0x665d4c,x,y,z,w+.07,h+.07,.035);
  box(p,0xe6c783,x,y,z+.022,w,h,.025);
  box(p,0xf1db9f,x-w*.22,y+h*.15,z+.038,w*.22,h*.48,.008);
  box(p,0x6b7668,x,y,z+.045,.024,h,.016);
  box(p,0x6b7668,x,y,z+.045,w,.024,.016);
  box(p,0xead7af,x,y-h/2-.05,z+.04,w+.12,.055,.09);
}
function house(p,x,y,z,s=1,color=0xe2cba0) {
  const g=group(p,x,y,z);g.scale.setScalar(s);
  contact(p,x,y,z,1.3*s,1.2*s);
  edges(box(g,color,0,.46,0,1,.92,.88));
  box(g,0xb6a589,0,.10,0,1.07,.2,.94);
  const peak=roof(g,1.21,1.13,.96,0x547371);
  const tri=new T.Shape();tri.moveTo(-.5,0);tri.lineTo(0,.34);tri.lineTo(.5,0);tri.closePath();
  add(g,new T.ExtrudeGeometry(tri,{depth:.88,bevelEnabled:false}),color,0,.92,-.44);
  for(const xx of[-.29,.29])windowFrame(g,xx,.57,.452,.19,.28);
  box(g,0x695547,0,.27,.468,.20,.52,.04);box(g,0xb5905a,.055,.27,.493,.025,.025,.015);
  for(const xx of[-.47,.47])box(g,0x8d7856,xx,.52,.475,.04,.86,.035);
  box(g,0x8d7856,0,.91,.475,1,.04,.035);
  box(g,0xdbcdaf,.3,peak-.06,-.2,.17,.47,.19);box(g,0x9a8870,.3,peak+.18,-.2,.22,.055,.24);
  return g;
}
const labelCache=new Map();
function label(p,text,x,y,z,w,h,bg='#3c5c58',fg='#f2dfb5') {
  const key=text+bg;
  if(!labelCache.has(key)) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);
    ctx.strokeStyle=fg;ctx.lineWidth=3;ctx.strokeRect(8,8,496,112);
    ctx.font='500 58px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=fg;ctx.fillText(text,256,65);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    labelCache.set(key,new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
  }
  const m=new T.Mesh(new T.PlaneGeometry(w,h),labelCache.get(key));m.position.set(x,y,z);p.add(m);return m;
}
function station(p,autumn) {
  const g=group(p,-4.05,1.41,1.30);
  contact(p,-4.05,1.41,1.3,3.7,1.7);
  edges(box(g,0xe1c38e,0,.61,0,2.65,1.22,.94));
  box(g,0xb8a486,0,.09,0,2.75,.18,1.03);
  const roofGroup=group(g); roofGroup.rotation.y=Math.PI/2;
  roof(roofGroup,1.28,2.93,1.23,0x456e70);
  const gable=new T.Shape();gable.moveTo(-.47,0);gable.lineTo(0,.32);gable.lineTo(.47,0);gable.closePath();
  const gableMesh=add(roofGroup,new T.ExtrudeGeometry(gable,{depth:2.65,bevelEnabled:false}),0xe1c38e,0,1.22,-1.325);
  for(const x of[-1.16,1.16])box(g,0x8d7754,x,.65,.492,.045,1.12,.035);
  box(g,0x8d7754,0,1.09,.495,2.65,.055,.04);
  for(const x of[-.98,-.58,.58,.98])windowFrame(g,x,.71,.488,.24,.43);
  box(g,0x6b5b46,0,.36,.5,.44,.72,.05);
  for(const x of[-.12,.12])windowFrame(g,x,.43,.54,.13,.35);
  // Center gable, clock, fascia and station-name board.
  const tri=new T.Shape();tri.moveTo(-.50,0);tri.lineTo(0,.56);tri.lineTo(.50,0);tri.closePath();
  edges(add(g,new T.ExtrudeGeometry(tri,{depth:.08,bevelEnabled:false}),0xe9d5ac,0,1.21,.51));
  beam(g,[-.55,1.2,.62],[0,1.82,.62],.055,0x406467);beam(g,[0,1.82,.62],[.55,1.2,.62],.055,0x406467);
  const clock=cylinder(g,0x665e4b,0,1.44,.63,.145,.045,24);clock.rotation.x=Math.PI/2;
  const dial=cylinder(g,0xf6e5b9,0,1.44,.659,.117,.008,24);dial.rotation.x=Math.PI/2;
  box(g,0x635b4c,0,1.48,.668,.012,.08,.008);box(g,0x635b4c,.035,1.44,.668,.07,.012,.008);
  // The platform canopy is on the railway side of the building.
  const canopy=box(g,0x4c7170,0,.88,-.83,2.95,.075,.82);canopy.rotation.x=.08;edges(canopy);
  for(const x of[-1.3,-.65,.65,1.3]) {
    box(g,0x8d7450,x,.41,-1.12,.055,.82,.055);
    beam(g,[x,.53,-1.12],[x,.84,-.89],.035,0x8d7450);
  }
  box(g,0xc7b38e,0,-.035,-.15,3.15,.10,2.08);
  for(let i=0;i<24;i++)box(g,0xe9d8b6,-1.47+i*.128,.025,-1.18,.095,.016,.09);
  label(g,'山 谷 车 站',0,1.02,.535,1.08,.22);
  label(g,autumn?'旧 时 光 候 车 室':'VALLEY · 1986',0,.98,-1.25,1.05,.16);
  // Luggage, a red postbox, stacked parcels and a waiting bench.
  for(let i=0;i<3;i++) {
    const x=-1.15+i*.22;
    edges(box(g,[0x9f7350,0x6d8078,0xb89862][i],x,.11,.72,.19,.22,.14));
    box(g,0x695949,x,.235,.72,.08,.025,.035);
  }
  box(g,0xa44f44,1.5,.30,.42,.25,.56,.22);box(g,0xdeb37e,1.5,.43,.538,.14,.035,.015);
  roof(group(g,1.5,0,.42),.30,.29,.59,0x914d43);
  label(g,'〒',1.5,.27,.54,.14,.12,'#a44f44');
  for(const x of[-.9,-.4])box(g,0xba9764,x,.17,-.91,.33,.32,.25);
  bench(g,.61,.025,-.94);
  return g;
}
function bench(p,x,y,z) {
  const g=group(p,x,y,z);
  for(let i=0;i<4;i++)box(g,0x9e7951,0,.25,-.07+i*.065,.85,.045,.052);
  for(let i=0;i<3;i++)box(g,0xab8659,0,.38+i*.075,.16,.85,.05,.035);
  for(const x of[-.32,.32]) {
    box(g,0x59655c,x,.12,.045,.04,.24,.25);
    box(g,0x59655c,x,.37,.16,.035,.47,.035);
    curve(g,[[x,.27,-.07],[x,.4,-.04],[x,.4,.16]],0x59655c,.017);
  }
  return g;
}
function tree(p,x,y,z,scale,autumn,trees,hero=false,cherry=false) {
  const g=group(p,x,y,z);g.scale.setScalar(scale);g.userData.dynamic=true;
  cylinder(g,0x887354,0,.48,0,.10,.96,7,.055);
  const colors=autumn?[0xd1984b,0xe1b967,0xb98045]:cherry?[0xe5b2a8,0xf2cabe,0xd29a95]:[0x91a772,0xb3bd80,0x728c64];
  // Crossed, scalloped cardstock leaves have thickness and a printed central fold.
  const leafShape=new T.Shape();
  for(let j=0;j<18;j++) {
    const a=j/18*Math.PI*2,r=j%2?.39:.46;
    const xx=Math.cos(a)*r,yy=Math.sin(a)*r;
    j?leafShape.lineTo(xx,yy):leafShape.moveTo(xx,yy);
  }
  leafShape.closePath();
  const foliage=new T.ExtrudeGeometry(leafShape,{depth:.025,bevelEnabled:false});
  for(let i=0;i<(hero?12:7);i++) {
    const a=i*2.39996,spread=hero?.65:.43;
    const xx=Math.cos(a)*spread,zz=Math.sin(a)*spread,yy=.96+(i%3)*.28;
    beam(g,[0,.5,0],[xx,yy,zz],.045,0x887354);
    const plate=add(g,foliage,colors[i%3],xx,yy+.18,zz);
    plate.rotation.set(.08*Math.sin(i),a*.7,.12*Math.sin(i*2));plate.scale.set(1.12,.90,1);
    box(plate,colors[(i+1)%3],0,0,.032,.013,.65,.008);
  }
  if(!hero)batchStatic(g);
  contact(p,x,y,z,1.8*scale,1.3*scale);trees.push(g);
  return g;
}
function pine(p,x,y,z,s) {
  const g=group(p,x,y,z);cylinder(g,0x7f7056,0,.3,0,.04,.6,5);
  for(let i=0;i<3;i++)add(g,new T.ConeGeometry(.36-i*.07,.75,5),[0x577e73,0x678c79,0x779a80][i],0,.6+i*.3,0);
  g.scale.setScalar(s);return g;
}
function person(p,x,y,z,old=false) {
  const g=group(p,x,y,z);
  cylinder(g,old?0x777676:0xb86c4d,0,.24,0,.085,.25,7,.065);
  add(g,new T.IcosahedronGeometry(.085,1),0xe4c39a,0,.44,0);
  add(g,new T.SphereGeometry(.088,8,5,0,Math.PI*2,0,Math.PI*.6),old?0xd4d0ba:0x76604a,0,.46,0);
  for(const side of[-1,1])beam(g,[side*.035,.15,0],[side*.045,.015,.025],.037,0x535e5b);
  return g;
}
function lantern(p,x,y,z) {
  cylinder(p,0x58655f,x,y+.53,z,.025,1.06,7);
  cylinder(p,0x667267,x,y+.03,z,.065,.06,8);
  box(p,0xf0ce86,x,y+1.15,z,.12,.19,.12);
  for(const a of[-1,1])for(const b of[-1,1])box(p,0x58655f,x+a*.065,y+1.15,z+b*.065,.012,.22,.012);
  add(p,new T.ConeGeometry(.16,.13,4),0x59685f,x,y+1.31,z);
}
function stairs(p,x,z,width,from,to,count,dir=1) {
  for(let i=0;i<count;i++) {
    const h=from+(to-from)*(i+1)/count;
    const tread=box(p,0xcdbf9f,x,h-.04,z+dir*i*.15,width,.08,.16);
    edges(tread,45);
    box(p,0xb8aa8b,x,(from+h)/2-.05,z+dir*i*.15,width,Math.max(.02,h-from),.15);
  }
}
function fence(p,points,y,color=0x988666) {
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i];
    for(const h of[.18,.36])beam(p,[a[0],y+h,a[1]],[b[0],y+h,b[1]],.032,color);
  }
  for(const [x,z] of points) {box(p,color,x,y+.23,z,.055,.46,.055);add(p,new T.ConeGeometry(.044,.07,4),0xc1b38c,x,y+.485,z)}
}
function gardens(p,autumn) {
  // Paving is laid out as connected paths instead of scattered stones.
  const path=[[-5.8,1.85],[-5,2.2],[-4.4,2.45],[-3.6,2.75],[-3.0,3.25],[-3,3.8]];
  for(let j=1;j<path.length;j++) {
    const a=path[j-1],b=path[j],n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.18);
    for(let i=0;i<n;i++)for(let side=0;side<2;side++) {
      const t=i/n;
      const stone=box(p,side?0xd6c9aa:0xc8bd9f,a[0]+(b[0]-a[0])*t+side*.16,.686,a[1]+(b[1]-a[1])*t,.14,.026,.14);
      stone.rotation.y=.13*Math.sin(i*1.7);
    }
  }
  stairs(p,-5.8,2.20,.68,.67,1.42,7,-1);
  stairs(p,3.4,2.1,.68,.67,1.15,5,-1);
  fence(p,[[-6.55,3.9],[-5.9,3.9],[-5.2,3.9],[-4.9,3.65]],.65);
  fence(p,[[2.1,1.4],[2.7,1.45],[3.1,1.5]],1.15);
  fence(p,[[4.2,1.58],[5.1,1.58],[6.2,1.5]],1.15);
  // Flower beds and grasses share geometries and are merged before rendering.
  for(let i=0;i<165;i++) {
    const side=i%2?1:-1,x=side*(1.8+random()*4.9),z=1.9+random()*2.15;
    if(side<0&&Math.abs(x+3.1)<.5&&z>2.7)continue;
    const h=.10+random()*.12;
    beam(p,[x,.67,z],[x+.02,.67+h,z],.012,0x7b956b);
    if(i%3) {
      const c=autumn?[0xd9ad59,0xc7834f,0xded09b][i%3]:[0xe3c9a1,0xf0dfb1,0xd9aaa2][i%3];
      const petal=add(p,new T.IcosahedronGeometry(.035+random()*.025,0),c,x+.02,.67+h,z);petal.scale.y=.5;
    }
  }
}
function watermill(p,wheels) {
  house(p,2.6,.68,2.55,.83,0xe2d1a7);
  const wheel=group(p,1.95,1.03,2.55);wheel.userData.dynamic=true;
  // Wheel spins around its horizontal axle, facing the river.
  const wheelFace=group(wheel);wheelFace.rotation.y=-Math.PI/2;
  for(const z of[-.08,.08]) {
    const torus=add(wheelFace,new T.TorusGeometry(.39,.027,4,16),0x8f714b,0,0,z);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(wheelFace,[0,0,z],[Math.cos(a)*.39,Math.sin(a)*.39,z],.026,0xa68b5d)}
  }
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const b=box(wheelFace,0xa4895c,Math.cos(a)*.4,Math.sin(a)*.4,0,.15,.065,.22);b.rotation.z=a}
  batchStatic(wheelFace);
  wheels.push(wheelFace);
}
function trainModel(p,autumn,trains,smoke) {
  const cars=[];
  for(let j=0;j<3;j++) {
    const g=group(p);g.userData.dynamic=true;
    const carriage=group(g); // +X is the forward direction for every carriage.
    box(carriage,0x4f5a53,0,.07,0,.59,.08,.32);
    edges(box(carriage,0xa34b43,0,.25,0,.54,.31,.30));
    box(carriage,0xcc9c59,0,.12,0,.57,.025,.32);
    const roof=box(carriage,0x435b58,0,.43,0,.63,.07,.37);edges(roof);
    for(const z of[-.157,.157])for(const x of[-.18,0,.18]) {
      box(carriage,0xedd59a,x,.29,z,.11,.13,.012);
      box(carriage,0x705e48,x,.29,z,.012,.13,.02);
    }
    for(const x of[-.18,.18])for(const z of[-.17,.17]) {
      const wheel=cylinder(carriage,0x48534e,x,.045,z,.085,.035,10);wheel.rotation.x=Math.PI/2;
      const hub=cylinder(carriage,0xab9265,x,.045,z*1.12,.027,.012,8);hub.rotation.x=Math.PI/2;
    }
    if(j===0) {
      box(carriage,0x455d58,.23,.27,0,.29,.24,.27);
      cylinder(carriage,0x485953,.31,.47,0,.052,.20,8,.065);
      box(carriage,0xbd9b61,.40,.16,0,.025,.12,.29);
      const light=cylinder(carriage,0xefdaa0,.42,.28,0,.06,.025,12);light.rotation.z=Math.PI/2;
    }
    batchStatic(g);
    cars.push(g);
  }
  trains.push({cars,autumn,curve:track});
  for(let i=0;i<8;i++) {
    const m=add(p,new T.IcosahedronGeometry(.09,0),0xe7deca);m.userData.dynamic=true;
    smoke.push({mesh:m,car:cars[0],phase:i/8,autumn});
  }
}

// Merge only static opaque meshes with the same material. Trees, moving parts,
// text, contact shadows and raycast targets retain their individual objects.
function batchStatic(root) {
  root.updateMatrixWorld(true);
  const inverse=new T.Matrix4().copy(root.matrixWorld).invert(), bins=new Map();
  root.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||o.material.transparent||Array.isArray(o.material))return;
    let a=o;while(a&&a!==root){if(a.userData.dynamic)return;a=a.parent}
    if(!bins.has(o.material))bins.set(o.material,[]);
    bins.get(o.material).push(o);
  });
  for(const [material,objects] of bins) {
    if(objects.length<3)continue;
    const arrays={position:[],normal:[],uv:[]};
    for(const object of objects) {
      const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,object.matrixWorld));
      for(const name of Object.keys(arrays))arrays[name].push(geometry.attributes[name].array);
      // Preserve outline strokes and nested details in the root coordinate space.
      for(const child of [...object.children])root.attach(child);
      object.removeFromParent();geometry.dispose();
    }
    const geometry=new T.BufferGeometry();
    for(const [name,parts] of Object.entries(arrays)) {
      const joined=new Float32Array(parts.reduce((n,a)=>n+a.length,0));let offset=0;
      for(const part of parts){joined.set(part,offset);offset+=part.length}
      geometry.setAttribute(name,new T.BufferAttribute(joined,name==='uv'?2:3));
    }
    geometry.computeBoundingSphere();const merged=new T.Mesh(geometry,material);
    merged.castShadow=merged.receiveShadow=true;root.add(merged);
  }
}

export function createDiorama({parent,autumn,trees,wheels,trains,leaves,clickable,smoke}) {
  randomSeed=1986;
  const world=group(parent,0,.39,0);
  land(world,autumn);water(world,autumn,leaves);mountains(world);
  railwayModel(world);bridge(world,.62);bridge(world,-3.63,true);
  polygon(world,[[-5.7,.2],[-2.4,.2],[-2.4,1.7],[-3,2.23],[-5.7,2.23]],.64,.73,0xb9ac8e,true);
  station(world,autumn);
  house(world,4.7,1.15,.15,1.04,0xe3cba0);
  house(world,5.9,1.15,-1.15,.77,0xd9c49d);
  house(world,3.4,1.84,-2.8,.72,0xe2d6b7);
  house(world,-4.4,1.84,-2.7,.73,0xdac59c);
  house(world,-6.05,1.84,-3.4,.68,0xd7c7a8);
  house(world,4.5,.68,3.25,.70,0xd4c39a);
  watermill(world,wheels);
  for(let i=0;i<22;i++) {
    const side=i%2?1:-1,x=side*(2.4+random()*4.3),z=-3.9+random()*1.25;
    if(Math.abs(x)>5.9)continue;
    pine(world,x,1.84,z,.65+random()*.45);
  }
  for(const [x,y,z,s,cherry] of [
    [-6.2,.67,3.0,.85,true],[-5.5,.67,3.1,.64,false],[-2.3,.67,2.3,.78,true],
    [5.7,.67,3.7,.94,true],[6.3,1.15,.6,.73,false],[3.5,1.15,-.6,.64,false],
    [-6.3,1.41,.0,.72,false],[2.2,1.15,-1.4,.7,true],[-2.7,1.41,-1.4,.57,false],
  ])tree(world,x,y,z,s,autumn,trees,false,cherry&&!autumn);
  const hero=tree(world,-3.5,.68,3.35,autumn?1.70:.38,autumn,trees,true);
  hero.userData.hero=true;hero.userData.base=autumn?1.7:.38;
  hero.traverse(o=>{if(o.isMesh){o.userData.action=autumn?'letter':'water';clickable.push(o)}});
  bench(world,-4.6,.69,3.6);lantern(world,-2.55,.69,2.7);lantern(world,-5.6,1.43,1.3);lantern(world,3.6,1.15,1.15);
  gardens(world,autumn);
  person(world,-4.7,1.47,.45);person(world,4.25,1.16,1.0);
  const personAtTree=person(world,autumn?-4.6:-3.07,autumn?.96:.68,3.5,autumn);
  personAtTree.userData.dynamic=true;
  if(autumn) {
    // Bent legs and a letter establish the seated reading pose.
    for(const side of[-1,1])beam(personAtTree,[side*.035,.15,0],[side*.035,.15,-.13],.04,0x535e5b);
    const letter=box(personAtTree,0xf2e3bb,.08,.30,-.10,.19,.015,.14);letter.rotation.x=-.45;
    beam(personAtTree,[-.075,.30,0],[.02,.29,-.10],.035,0x777676);
    personAtTree.traverse(o=>{if(o.isMesh){o.userData.action='letter';clickable.push(o)}});
    for(let i=0;i<50;i++) {
      const leaf=add(world,new T.OctahedronGeometry(.045),[0xdca858,0xc8874a,0xe2c078][i%3],-3.5+(random()-.5)*3,.69,3.35+(random()-.5)*2);
      leaf.scale.y=.1;leaf.rotation.y=random()*6;
    }
  } else {
    const can=cylinder(personAtTree,0x789e98,.15,.18,-.04,.07,.12);
    beam(personAtTree,[.16,.19,-.04],[.27,.25,-.08],.025,0x789e98);
    can.userData.action='water';clickable.push(can);
  }
  trainModel(world,autumn,trains,smoke);
  batchStatic(world);
  world.userData.version='0.2.0';
  return world;
}
