import * as T from './three.module.js';
import {paper,outline} from './paper-style.js';

function mesh(parent,geometry,color,x=0,y=0,z=0) {
  const object=new T.Mesh(geometry,paper(color));object.position.set(x,y,z);
  object.castShadow=object.receiveShadow=true;parent.add(object);return object;
}
function box(parent,color,x,y,z,w,h,d) {return mesh(parent,new T.BoxGeometry(w,h,d),color,x,y,z)}
function cutout(parent,points,color,depth=.035) {
  const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  return mesh(parent,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),color);
}

// Each half has its own ground hinge. The low central silhouette opens the valley.
export function createMountainLayers(parent) {
  const profiles=[
    [[0,.30],[.9,.65],[1.8,1.1],[2.8,2.1],[3.7,1.65],[4.8,2.95],[5.5,2.15],[6.4,2.5],[7,.9]],
    [[0,.22],[1.0,.55],[2.0,.9],[3.0,1.65],[4.0,1.3],[5.0,2.25],[6.0,1.55],[7,1.25]],
    [[0,.12],[1.1,.32],[2.1,.55],[3.0,1.0],[4.1,.78],[5.2,1.6],[6.1,1.1],[7,.75]],
  ];
  const colors=[0x9cb9c6,0x779cab,0x5c8290];
  for(let layer=0;layer<3;layer++)for(const side of [-1,1]) {
    const panel=new T.Group();panel.name=`MountainPaper_${layer}_${side<0?'left':'right'}`;
    panel.position.set(side*3.5,1.66,-4.62+layer*.18);
    panel.userData.dynamic=true;
    panel.userData.paperHinge={angle:Math.PI/2,start:.08+layer*.06,end:.65+layer*.07};parent.add(panel);
    const profile=profiles[layer].map(([x,y])=>[side*x-side*3.5,y*(side<0?1:.88)]);
    const points=[[-side*3.5,0],...profile,[side*3.5,0]];
    const body=cutout(panel,points,colors[layer]);outline(body,45);
    // Printed facets and small snow caps stay attached to the paper silhouette.
    for(let i=2;i<profile.length-1;i++) {
      const a=profile[i-1],peak=profile[i],b=profile[i+1];
      if(peak[1]<=a[1]||peak[1]<=b[1])continue;
      const facet=cutout(panel,[peak,[b[0],Math.max(.1,b[1]-.2)],[peak[0]-side*.20,.06]],layer===0?0x89a7b7:layer===1?0x688b9b:0x4c7181,.003);facet.position.z=.037;
      if(layer===0) {
        const cap=cutout(panel,[[peak[0]-side*.38,peak[1]-.48],peak,[peak[0]+side*.42,peak[1]-.52],[peak[0]+side*.06,peak[1]-.34]],0xe4e8df,.004);cap.position.z=.043;
      }
    }
  }
}

// These opaque details are merged by the diorama's existing material batching.
export function createValleyDetails(parent,autumn,riverCenter,riverHalfWidth) {
  const masonry=[0xc6bca0,0xb4af9a,0xd1c6ac,0xa8a58f];
  // A staggered retaining wall gives the station terrace a constructed edge.
  for(let row=0;row<4;row++)for(let i=0;i<12;i++) {
    const x=-5.64+i*.24+(row%2)*.10;
    box(parent,masonry[(i+row)%4],x,.75+row*.17,2.455,.225,.153,.035);
  }
  for(let i=0;i<13;i++)box(parent,0xddceb0,-5.67+i*.24,1.39,2.45,.235,.06,.16);
  // Individual stones stay outside the open arch instead of filling its hole.
  for(const [z,small] of [[.62,false],[-3.63,true]]) {
    const half=small?1.7:1.83,radius=small?1.06:1.12;
    for(const face of [-.391,.391])for(let row=0;row<8;row++)for(let i=0;i<12;i++) {
      const x=-half+.14+i*(2*half-.28)/11+(row%2)*.035,y=.24+row*.165;
      const nearest=Math.max(0,Math.abs(x)-.14);
      if(nearest<radius&&y-.07<.32+Math.sqrt(radius*radius-nearest*nearest))continue;
      box(parent,masonry[(i+row)%4],x,y,z+face,.265,.148,.025);
    }
  }
  // Paper-cut rock facets break up the even contour layers at the water's edge.
  for(const side of [-1,1])for(let i=0;i<16;i++) {
    const z=-4.15+i*.54,x=riverCenter(z)+side*(riverHalfWidth(z)+.28);
    const rock=mesh(parent,new T.IcosahedronGeometry(.16+(i%3)*.035,0),masonry[i%4],x,.38,z);
    rock.scale.set(.8,1.25+(i%4)*.2,1.55);rock.rotation.y=i*.8;
  }
  // Bushes and flowers grow in groups along the path, terrace and mill garden.
  const beds=[[-5.7,2.8],[-4.9,2.7],[-2.5,2.7],[-6.2,3.7],[-4.5,4.1],[2.15,3.4],[3.0,3.65],[6.1,3.8],[6.3,2.4],[4.1,4.05]];
  beds.forEach(([x,z],bed)=>{
    for(let i=0;i<7;i++) {
      const a=i*2.39996,spread=.12+Math.sqrt(i)*.09;
      const xx=x+Math.cos(a)*spread,zz=z+Math.sin(a)*spread;
      const bush=mesh(parent,new T.IcosahedronGeometry(.13+(i%3)*.025,0),autumn?[0x9c965d,0xada363,0x7f8a59][i%3]:[0x748858,0x91a565,0x617b57][i%3],xx,.72,zz);
      bush.scale.set(1,.65,1);
      const color=autumn?[0xdba04c,0xe7c27c,0xb76e49][(bed+i)%3]:[0xe9bbad,0xf1dbb0,0xd5a0a5][(bed+i)%3];
      for(let petal=0;petal<3;petal++) {
        const bloom=mesh(parent,new T.IcosahedronGeometry(.042,0),color,xx+Math.cos(petal*2.1)*.055,.84+(i%2)*.035,zz+Math.sin(petal*2.1)*.055);bloom.scale.y=.45;
      }
    }
  });
  // Narrow blue channels and translucent-looking shallows are printed paper layers.
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=64;i++) {
    const z=-4.5+i*9/64,x=riverCenter(z)+Math.sin(z*1.6)*.09,w=riverHalfWidth(z)*(.37+.08*Math.sin(z*2));
    positions.push(x-w,.124,z,x+w,.124,z);uv.push(0,i/64,1,i/64);
    if(i<64){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}
  }
  const channel=new T.BufferGeometry();channel.setAttribute('position',new T.Float32BufferAttribute(positions,3));channel.setAttribute('uv',new T.Float32BufferAttribute(uv,2));channel.setIndex(indices);channel.computeVertexNormals();
  const current=mesh(parent,channel,autumn?0x4a8394:0x3b8199);current.castShadow=false;
}
