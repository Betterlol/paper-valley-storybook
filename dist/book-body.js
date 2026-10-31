import * as T from './three.module.js';
import {paper,outline,smooth} from './paper-style.js';

export const BOOK_LEAF_WIDTH=8.60;

export function pageHeight(x) {
  const u=Math.abs(x)/(BOOK_LEAF_WIDTH+.04);
  return .25+.125*(1-Math.exp(-u*9))+.045*Math.sin(u*Math.PI);
}
function mesh(parent,geometry,color) {
  const m=new T.Mesh(geometry,paper(color));m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
function box(p,c,x,y,z,w,h,d) {
  const m=mesh(p,new T.BoxGeometry(w,h,d),c);m.position.set(x,y,z);return m;
}
function tube(p,points,color,r=.008) {
  return mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),points.length*2,r,4,false),color);
}
// Closed page block: top, bottom, fore edge and gutter all have real thickness.
function pageBlock(side,base,thickness,width,depth,color,bulge) {
  const n=54,positions=[],indices=[];
  for(let layer=0;layer<2;layer++)for(let row=0;row<2;row++)for(let i=0;i<=n;i++) {
    const x=side*(.035+i/n*width),z=(row?1:-1)*depth/2;
    const top=base+bulge*(pageHeight(x)-.25);
    positions.push(x,top-(layer?thickness:0),z);
  }
  const stride=n+1;
  function quad(a,b,c,d){indices.push(a,b,c,a,c,d)}
  for(let i=0;i<n;i++) {
    quad(i,i+1,stride+i+1,stride+i);
    quad(stride*2+i,stride*3+i,stride*3+i+1,stride*2+i+1);
    quad(i,stride*2+i,stride*2+i+1,i+1);
    quad(stride+i,stride+i+1,stride*3+i+1,stride*3+i);
  }
  quad(0,stride,stride*3,stride*2);
  quad(n,stride*2+n,stride*3+n,stride+n);
  if(side>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  const uv=[];for(let i=0;i<positions.length;i+=3)uv.push(positions[i]/8,positions[i+2]/10);
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  return {geometry,color};
}
export function createBook(parent) {
  const root=new T.Group();root.position.x=1.3;root.name='BoundStorybook';parent.add(root);
  for(const side of[-1,1]) {
    const cover=pageBlock(side,-.29,.17,BOOK_LEAF_WIDTH+.26,10.63,0x67383f,.17);mesh(root,cover.geometry,cover.color);
    const lining=pageBlock(side,-.10,.12,BOOK_LEAF_WIDTH+.13,10.44,0xb89663,.55);mesh(root,lining.geometry,lining.color);
    for(let i=0;i<24;i++) {
      const block=pageBlock(side,-.075+i*.0137,.0138,BOOK_LEAF_WIDTH-.02+(i%3)*.016,10.14+(i%4)*.008,i%4?0xdfcdaa:0xc7b99d,1);
      mesh(root,block.geometry,block.color);
    }
    const top=pageBlock(side,.25,.023,BOOK_LEAF_WIDTH,10.12,0xf1e4c5,1);mesh(root,top.geometry,top.color);
    // Narrow printed frames follow the page curvature, not a flat overlay.
    for(const z of[-4.86,4.86]) {
      const pts=[];for(let i=0;i<=40;i++){const x=side*(.28+i/40*(BOOK_LEAF_WIDTH-.58));pts.push([x,pageHeight(x)+.007,z])}
      tube(root,pts,0xcab58b,.006);
    }
    for(const z of[-5.16,5.16]) {
      tube(root,[[side*.13,-.285,z],[side*3.5,-.27,z],[side*(BOOK_LEAF_WIDTH+.02),-.282,z]],0xb08b55,.012);
    }
    // Brass corner caps and embossed binding tools.
    for(const z of[-5.15,5.15]) {
      box(root,0xb79960,side*(BOOK_LEAF_WIDTH-.04),-.22,z,.5,.055,.13);
      box(root,0xb79960,side*(BOOK_LEAF_WIDTH+.14),-.22,z-Math.sign(z)*.16,.11,.055,.42);
    }
  }
  const spine=mesh(root,new T.CylinderGeometry(.245,.245,10.65,20),0x59313b);
  spine.rotation.x=Math.PI/2;spine.position.y=-.22;
  tube(root,[[0,.255,-5.05],[0,.23,0],[0,.255,5.05]],0x9d8260,.025);
  // A curved satin bookmark hangs over the fore edge and down to the desk.
  const path=new T.CatmullRomCurve3([new T.Vector3(.19,.26,1),new T.Vector3(.20,.29,4.8),new T.Vector3(.3,.12,5.3),new T.Vector3(.65,-.46,6.0)]);
  const ribbon=new T.BufferGeometry(),positions=[],uv=[],indices=[];
  for(let i=0;i<=40;i++) {
    const pt=path.getPoint(i/40);positions.push(pt.x-.14,pt.y,pt.z,pt.x+.14,pt.y,pt.z);uv.push(0,i/8,1,i/8);
    if(i<40){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}
  }
  ribbon.setAttribute('position',new T.Float32BufferAttribute(positions,3));ribbon.setAttribute('uv',new T.Float32BufferAttribute(uv,2));ribbon.setIndex(indices);ribbon.computeVertexNormals();
  const ribbonMaterial=paper(0x9c4f50).clone();ribbonMaterial.side=T.DoubleSide;
  const bookmark=new T.Mesh(ribbon,ribbonMaterial);root.add(bookmark);
  return root;
}

export function createTurningPage(book) {
  const columns=64,rows=8,w=BOOK_LEAF_WIDTH,d=10.12,positions=[],uv=[],indices=[];
  const stride=columns+1,surface=(rows+1)*stride;
  for(let layer=0;layer<2;layer++)for(let row=0;row<=rows;row++)for(let i=0;i<=columns;i++) {
    positions.push(i/columns*w,0,(row/rows-.5)*d);uv.push(i/columns,row/rows);
  }
  for(let layer=0;layer<2;layer++)for(let row=0;row<rows;row++)for(let col=0;col<columns;col++) {
    const a=layer*surface+row*stride+col,b=a+1,c=a+stride,e=c+1;
    if(!layer)indices.push(a,c,b,b,c,e);else indices.push(a,b,c,b,e,c);
  }
  function edge(a,b){indices.push(a,b,b+surface,a,b+surface,a+surface)}
  for(let col=0;col<columns;col++){edge(col,col+1);edge(rows*stride+col+1,rows*stride+col)}
  for(let row=0;row<rows;row++){edge((row+1)*stride,row*stride);edge(row*stride+columns,(row+1)*stride+columns)}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  const material=paper(0xf2e4c3).clone();material.side=T.DoubleSide;
  const page=new T.Mesh(geometry,material);page.castShadow=page.receiveShadow=true;page.visible=false;page.name='TurningCardstock';book.add(page);
  const point=new T.Vector3(), samples=[];
  function update(t,side) {
    const angle=Math.PI*smooth(0,1,t),curl=Math.sin(Math.PI*t)*.14;
    let x=0,y=.39;samples.length=0;
    for(let col=0;col<=columns;col++) {
      const u=col/columns;
      if(col){const tangent=angle+curl*Math.sin((u-.5/columns)*Math.PI);x+=Math.cos(tangent)*w/columns;y+=Math.sin(tangent)*w/columns}
      samples.push([side*(x+.035),y,angle+curl*Math.sin(u*Math.PI)]);
      for(let layer=0;layer<2;layer++)for(let row=0;row<=rows;row++) {
        const i=layer*surface+row*stride+col;
        const bow=Math.sin(row/rows*Math.PI)*Math.sin(Math.PI*t)*.06;
        geometry.attributes.position.setXYZ(i,side*(x+.035),y+(layer?-.024:0)+bow,(row/rows-.5)*d);
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }
  function poseAt(radius,z=0) {
    const u=T.MathUtils.clamp(radius/w,0,1)*columns,i=Math.min(columns-1,Math.floor(u)),t=u-i;
    const a=samples[i],b=samples[i+1];
    return {x:T.MathUtils.lerp(a[0],b[0],t),y:T.MathUtils.lerp(a[1],b[1],t),angle:T.MathUtils.lerp(a[2],b[2],t)};
  }
  return {mesh:page,update,geometry,samples,poseAt};
}
