import * as T from './three.module.js';
import { createDiorama, updateRiver } from './diorama.js';
import { createBook, createTurningPage } from './book-body.js';
import { paper, smooth } from './paper-style.js';
import { loadStationTemplate } from './station-model.js';
import { prepareFolding, setWorldFold, liftWorldPage, followTurningPage } from './folding.js';
const stationTemplate = await loadStationTemplate().catch(error=>{
  document.querySelector('#loading').textContent='车站模型加载失败，请刷新页面重试。';
  throw error;
});
const canvas=document.querySelector('canvas');
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false})}catch(error){document.querySelector('#loading').innerHTML='<div class="unsupported"><h2>这个浏览器暂时无法展开三维世界</h2><p>请使用支持 WebGL 2 的 Chrome、Edge 或 Safari，并开启图形加速。</p><p>背景为概念参考图，实际项目为可交互的 Three.js 场景。</p></div>';document.querySelector('#loading').classList.add('fallback');throw error;}renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor(0x252326);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.97;
const scene=new T.Scene();scene.fog=new T.Fog(0x252326,30,70);const camera=new T.PerspectiveCamera(36,innerWidth/innerHeight,.1,100);
scene.add(new T.HemisphereLight(0xc0d6ec,0x615251,.95));const sun=new T.DirectionalLight(0xffdfa9,2.7);sun.position.set(-8,10,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.1,far:50});sun.shadow.bias=-.001;sun.shadow.normalBias=.012;scene.add(sun);const fill=new T.DirectionalLight(0x9abbd4,.8);fill.position.set(7,8,-8);scene.add(fill);
const mat=paper;
function mesh(g,c,p,x=0,y=0,z=0){let o=new T.Mesh(g,mat(c));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
function box(p,c,x,y,z,w,h,d){return mesh(new T.BoxGeometry(w,h,d),c,p,x,y,z)}
function cyl(p,c,x,y,z,r,h,n=8,r2=r){return mesh(new T.CylinderGeometry(r2,r,h,n),c,p,x,y,z)}
function ball(p,c,x,y,z,r,s=1){let o=mesh(new T.IcosahedronGeometry(r,0),c,p,x,y,z);o.scale.y=s;return o}
function group(p,x=0,y=0,z=0){let g=new T.Group();g.position.set(x,y,z);p.add(g);return g}
function line(p,pts,c,r=.02){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(a=>new T.Vector3(...a))),Math.max(8,pts.length*3),r,5,false),c,p)}
let seed=42;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const desk=box(scene,0x2d211d,0,-.75,0,200,.5,200);desk.receiveShadow=true;
const book=createBook(scene);
const props=group(scene,0,0,-1.4);let envelope=box(props,0xe0c8a4,-8.8,-.45,4.5,2.4,.035,1.5);envelope.rotation.y=-.3;let seal=cyl(props,0x8c3c38,-8.8,-.41,4.5,.17,.04,12);line(props,[[-9.9,-.415,4.1],[-8.8,-.415,4.7],[-7.7,-.415,4.1]],0xa48a6d,.012);
// Small brass desk lamp gives the miniature a tangible scale.
const lamp=group(scene,8.8,-.48,-6.4);cyl(lamp,0xa5834b,0,.08,0,.8,.16,24);cyl(lamp,0x987541,0,1.6,0,.07,3,12);cyl(lamp,0xb89555,0,3.13,0,1,.7,24,.42);cyl(lamp,0xffd997,0,2.79,0,.82,.04,24);const glow=new T.PointLight(0xffbc6b,12,15,2);glow.position.set(8.8,2.1,-6.4);scene.add(glow);
const worlds = [], trees = [], wheels = [], trains = [], leaves = [], birds = [], smoke = [];
const clickable = [];
let planted = false, page = 0, flip = null, watering = 0, delivered = false;
for (const autumn of [false, true]) {
  worlds.push(createDiorama({parent: book, autumn, trees, wheels, trains, leaves, clickable, smoke, stationTemplate}));
}
for (const world of worlds) {
  prepareFolding(world,trees,trains,smoke,leaves);
  setWorldFold(world,0);
}
worlds[1].visible = false;

const turningPage=createTurningPage(book);
const birdRoot=group(book);for(let i=0;i<7;i++){let g=group(birdRoot);for(let s of[-1,1]){let wing=box(g,0xf0dec0,s*.10,0,0,.23,.018,.07);wing.rotation.z=s*.35}birds.push(g)}
const ray=new T.Raycaster(),pointer=new T.Vector2();let orbit={yaw:.19,pitch:.62,distance:26.8,target:new T.Vector3(1.5,.9,-.15)},down=null,drag=false;const isMobile=()=>innerWidth<700;
function cameraUpdate() {
  const framing=isMobile()?Math.max(1.3,1.3/camera.aspect):1;
  const d=orbit.distance*framing,t=orbit.target;
  camera.position.set(t.x+Math.sin(orbit.yaw)*Math.cos(orbit.pitch)*d,t.y+Math.sin(orbit.pitch)*d,t.z+Math.cos(orbit.yaw)*Math.cos(orbit.pitch)*d);
  camera.lookAt(t);
  // Keep the book visible when a narrow portrait screen needs a distant camera.
  scene.fog.near=d+9;scene.fog.far=d+47;camera.far=Math.max(100,d+60);
  if(!isMobile())camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.065,0,innerWidth,innerHeight);
  else camera.clearViewOffset();
}
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};drag=false;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!down)return;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)drag=true;if(drag){orbit.yaw-=(e.clientX-down.lastX)*.006;orbit.pitch=T.MathUtils.clamp(orbit.pitch+(e.clientY-down.lastY)*.004,.32,1.3)}down.lastX=e.clientX;down.lastY=e.clientY});canvas.addEventListener('pointerup',e=>{if(!drag){pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);let hit=ray.intersectObjects(clickable).find(h=>{let a=h.object;while(a){if(!a.visible)return false;a=a.parent}return true});if(hit){if(hit.object.userData.action==='water')water();else readLetter()}}down=null});canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.distance=T.MathUtils.clamp(orbit.distance+e.deltaY*.012,8.5,34)},{passive:false});
let toastTimer;function toast(s){let el=document.querySelector('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4300)}
function water(){if(page||flip)return;if(planted){toast('小树记住了这个春天。翻页，看看它的未来。');return}planted=true;watering=3;document.querySelector('#water').textContent='✓ 小树记住了你的春天';toast('一滴水，也许会长成许多年后的荫凉。')}
function readLetter(){if(!page||flip)return;delivered=true;document.querySelector('#chapterTitle').textContent='信终于抵达，春天从未走远';document.querySelector('#chapterText').innerHTML='“如果你回来了，就到树下找我。”<br>那年种下的小树，替我们记住了一切。';toast('“谢谢你，把那年的春天带到了这里。”')}
function updateUI(){document.querySelector('#chapterNo').textContent=page?'02 / 02':'01 / 02';document.querySelector('#chapterTitle').textContent=page?'秋天，许多年以后':'春天，故事刚刚开始';document.querySelector('#chapterText').innerHTML=page?'幼苗已撑起一片金色的天空。<br>轻触树下读信的人，让信抵达终点。':'车站旁的小树，正在等一场雨。<br>轻触树冠，留下一点属于你的春天。';document.querySelector('#water').textContent=page?'✉ 阅读树下的来信':planted?'✓ 小树记住了你的春天':'✧ 浇灌小树';document.querySelector('#season').textContent=page?'AUTUMN · 2026':'SPRING · 1986';document.querySelector('#progress').style.width=page?'100%':'50%';document.querySelector('#prev').disabled=!page;document.querySelector('#next').disabled=!!page;document.querySelector('#next').innerHTML=page?'已抵达秋天 <b>✓</b>':'翻过时光 <b>→</b>'}
function turn(to) {
  if(flip||to===page)return;
  flip={from:page,to,t:0,side:to===1?-1:1};
  turningPage.mesh.visible=false;
  setWorldFold(worlds[to],1,0,planted);worlds[to].visible=false;
  document.querySelector('#prev').disabled=true;
  document.querySelector('#next').disabled=true;
  document.querySelector('#water').disabled=true;
  document.querySelector('#season').textContent='故事正在翻向下一页';
}
document.querySelector('#water').onclick=()=>page?readLetter():water();document.querySelector('#next').onclick=()=>turn(1);document.querySelector('#prev').onclick=()=>turn(0);document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')turn(1);if(e.key==='ArrowLeft')turn(0)});function reset(){orbit.yaw=.19;orbit.pitch=.62;orbit.distance=26.8;orbit.target.set(1.5,.9,-.15);document.querySelector('.intro').style.opacity='1';}document.querySelector('#reset').onclick=reset;document.querySelector('.mark').onclick=e=>{e.preventDefault();reset()};
document.querySelector('#detail').onclick=()=>{
  if(flip)return;
  orbit.yaw=.14;orbit.pitch=.40;orbit.distance=10.5;orbit.target.set(-2.75,2.10,1.2);
  document.querySelector('.intro').style.opacity='.18';
};
let audio=null;document.querySelector('#sound').onclick=()=>{if(audio){audio.ctx.close();audio=null;document.querySelector('#sound').style.color='';return}const ctx=new AudioContext(),master=ctx.createGain();master.gain.value=.04;master.connect(ctx.destination);[261.63,329.63,392,523.25].forEach((f,i)=>{let o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;g.gain.value=.14/(i+1);o.connect(g).connect(master);o.start()});audio={ctx};document.querySelector('#sound').style.color='#e9bc76';toast('轻轻的和弦，陪你翻过时光。')};
const droplets=[];for(let i=0;i<25;i++){let d=ball(book,0xaad1d4,-1,.9,0,.035,1.6);d.visible=false;droplets.push(d)}
let last=0, travel=0;
function frame(ms) {
  const time=ms*.001,dt=Math.max(0,Math.min(time-last,.04));last=time;
  cameraUpdate();
  let stop=0;
  if(flip) {
    flip.t+=dt/6.4;
    const t=Math.min(flip.t,1),leafProgress=T.MathUtils.clamp((t-.40)/.38,0,1);
    const from=worlds[flip.from],to=worlds[flip.to];
    setWorldFold(from,smooth(.08,.40,t),time,planted);
    setWorldFold(to,1-smooth(.74,1,t),time,planted);
    liftWorldPage(from,flip.side,Math.PI*smooth(0,1,leafProgress));
    turningPage.mesh.visible=t>.40&&t<.80;
    turningPage.update(leafProgress,flip.side);
    if(t>.40&&t<.80)followTurningPage(from,flip.side,turningPage,leafProgress);
    from.visible=t<.62;to.visible=t>.59;
    birdRoot.visible=t<.12||t>.96;
    stop=smooth(0,.10,t)*(1-smooth(.96,1,t));
    sun.color.setHex(t>.62&&flip.to?0xffc27f:0xffdfa9);
    if(t===1) {
      from.visible=false;liftWorldPage(from,flip.side,0);
      setWorldFold(from,0,time,planted);setWorldFold(to,0,time,planted);
      page=flip.to;flip=null;turningPage.mesh.visible=false;birdRoot.visible=true;
      document.querySelector('#water').disabled=false;updateUI();
    }
  } else {
    setWorldFold(worlds[page],0,time,planted);
  }
  travel+=dt*.022*(1-stop);
for(const surface of leaves)updateRiver(surface,dt);
wheels.forEach(o=>o.rotation.z-=dt*.48*(1-stop));
trains.forEach(({cars,autumn,curve})=>{
  const head=autumn?.10:travel%1;
  cars.forEach((car,i)=>{
    const u=((head-i*.019)%1+1)%1;
    const pt=curve.getPointAt(u), tangent=curve.getTangentAt(u);
    car.position.copy(pt); car.position.y+=.065;
    car.rotation.y=-Math.atan2(tangent.z,tangent.x);
  });
});
smoke.forEach(({mesh,car,phase,autumn})=>{
  mesh.visible=!autumn&&!flip;
  const t=(time*.33+phase)%1;
  mesh.position.copy(car.position);
  mesh.position.x+=.25-t*.35;
  mesh.position.y+=.55+t*.85;
  mesh.position.z+=Math.sin(time+phase)*.05;
  mesh.scale.setScalar(.3+Math.sin(t*Math.PI)*1.1);
});
birds.forEach((g,i)=>{let a=time*.16+i*.85;g.position.set(Math.cos(a)*5,4.1+Math.sin(time+i)*.13,Math.sin(a)*2);g.rotation.y=-a;g.children.forEach((o,j)=>o.rotation.z=(j?1:-1)*(.25+Math.sin(time*4+i)*.35))});
if(watering>0)watering-=dt;droplets.forEach((d,i)=>{d.visible=watering>0&&!page;if(d.visible)d.position.set(5.05+Math.sin(i*2.3)*.25,1.1+((time*1.2+i*.13)%1)*1.3,3.15+Math.cos(i*2.3)*.25)});renderer.render(scene,camera);requestAnimationFrame(frame)}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});requestAnimationFrame(frame);setTimeout(()=>{document.querySelector('#loading').style.opacity=0;setTimeout(()=>document.querySelector('#loading').remove(),800)},500);
window.storybook={getState:()=>({page,planted,delivered,turning:!!flip,version:'0.4.1'}),turn,water,readLetter};
