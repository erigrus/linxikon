// Deterministic spring physics and obstacle-aware geometry, independent of the DOM.
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const side = (a, b, p) => (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
export function segmentsCross(a, b, c, d) {
  return side(a,b,c)*side(a,b,d)<-1e-5 && side(c,d,a)*side(c,d,b)<-1e-5;
}
export function crossingCount(nodes, edges) {
  let count=0;
  for(let i=0;i<edges.length;i++) for(let j=i+1;j<edges.length;j++) {
    const a=edges[i], b=edges[j];
    if(a.a===b.a||a.a===b.b||a.b===b.a||a.b===b.b)continue;
    if(segmentsCross(nodes[a.a],nodes[a.b],nodes[b.a],nodes[b.b]))count++;
  }
  return count;
}
export function pointAt(curve, t) {
  const u=1-t, {p0,p1,p2,p3}=curve;
  return {x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,
    y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y};
}
function exitCard(node, toward) {
  const dx=toward.x-node.x,dy=toward.y-node.y;
  const t=Math.min((node.width/2+4)/Math.max(.001,Math.abs(dx)),(node.height/2+4)/Math.max(.001,Math.abs(dy)));
  return {x:node.x+dx*t,y:node.y+dy*t};
}
export function edgeCurve(a,b,bend=0,wobble=0) {
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),nx=-dy/d,ny=dx/d;
  const p1={x:a.x+dx/3+nx*(bend+wobble),y:a.y+dy/3+ny*(bend+wobble)};
  const p2={x:b.x-dx/3+nx*(bend-wobble*.7),y:b.y-dy/3+ny*(bend-wobble*.7)};
  return {p0:exitCard(a,p1),p1,p2,p3:exitCard(b,p2)};
}
export function curvePath(curve) {
  const {p0,p1,p2,p3}=curve, f=p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  return `M ${f(p0)} C ${f(p1)}, ${f(p2)}, ${f(p3)}`;
}
// Route curved edges around cards. The previous lane wins ties to avoid flicker.
export function routeBend(a,b,nodes,previous=0,otherEdges=[],bounds=null) {
  const distance=Math.hypot(b.x-a.x,b.y-a.y), maxBend=Math.min(180,distance*.65);
  const candidates=[previous,0,24,-24,55,-55,95,-95,145,-145,maxBend,-maxBend];
  let best=previous,bestCost=Infinity;
  for(const bend of candidates) {
    if(Math.abs(bend)>maxBend+1)continue;
    const curve=edgeCurve(a,b,bend), samples=Array.from({length:15},(_,i)=>pointAt(curve,i/14));
    let cost=Math.abs(bend)*.055+Math.abs(bend-previous)*.018;
    if(bounds)for(const p of samples)if(p.x<8||p.y<8||p.x>bounds.width-8||p.y>bounds.height-8)cost+=500;
    for(const node of nodes) {
      if(node===a||node===b)continue;
      const hw=node.width/2+10,hh=node.height/2+10;
      for(const p of samples) {
        const x=hw-Math.abs(p.x-node.x),y=hh-Math.abs(p.y-node.y);
        if(x>0&&y>0)cost+=120+Math.min(x,y)*8;
      }
    }
    // Discourage running along an unrelated edge; actual crossings are also
    // addressed by the layout planner below, since some graphs are non-planar.
    for(const e of otherEdges) {
      if(e.a===a.id||e.b===a.id||e.a===b.id||e.b===b.id)continue;
      const c=nodes[e.a],d=nodes[e.b];if(!c||!d)continue;
      for(let k=1;k<samples.length;k++)if(segmentsCross(samples[k-1],samples[k],c,d))cost+=12;
    }
    if(cost<bestCost){bestCost=cost;best=bend;}
  }
  return best;
}

export class GraphPhysics {
  constructor(width=800,height=470){this.width=width;this.height=height;this.nodes=[];this.edges=[];this.heat=0;this.ticks=0;this.motion=0;}
  home(i){return {x:this.width*(i===0?.17:.83),y:this.height*(i===0?.22:.76)};}
  bound(node){
    const x=clamp(node.x,node.width/2+15,this.width-node.width/2-15),y=clamp(node.y,42,this.height-52);
    if(node.vx*(x-node.x)<0)node.vx*=-.35;
    if(node.vy*(y-node.y)<0)node.vy*=-.35;
    node.x=x;node.y=y;
  }
  resize(width,height,{scale=true}={}){
    if(width===this.width&&height===this.height)return;
    for(const n of this.nodes){if(scale){n.x*=width/this.width;n.y*=height/this.height;}n.guide=null;}
    this.width=width;this.height=height;this.nodes.forEach(n=>this.bound(n));this.wake(.7);
  }
  setData(words,edges,widthForWord=word=>Math.max(96,word.length*9+30),{impulse=true}={}){
    const oldCount=this.nodes.length;
    this.edges=edges.map(e=>({...e}));
    for(let i=oldCount;i<words.length;i++){
      const connected=edges.filter(e=>e.a===i||e.b===i).map(e=>this.nodes[e.a===i?e.b:e.a]).filter(Boolean);
      let p;
      if(i<2)p=this.home(i);
      else if(connected.length){
        const angle=i*2.399963; p={x:connected.reduce((s,n)=>s+n.x,0)/connected.length+Math.cos(angle)*95,y:connected.reduce((s,n)=>s+n.y,0)/connected.length+Math.sin(angle)*85};
      } else {const angle=i*2.399963;p={x:this.width/2+Math.cos(angle)*this.width*.27,y:this.height/2+Math.sin(angle)*this.height*.28};}
      const n={id:i,word:words[i],x:p.x,y:p.y,vx:0,vy:0,width:Math.min(this.width-40,widthForWord(words[i])),height:48,angle:0,av:0,pinned:false,guide:null};
      this.bound(n);this.nodes.push(n);
      if(i>=2&&impulse)this.pulse(i);
    }
    if(this.nodes.length!==oldCount)this.wake(1);
  }
  wake(heat=1){this.heat=Math.max(this.heat,heat);this.ticks=0;}
  pulse(index){
    const source=this.nodes[index];
    for(const n of this.nodes){
      if(n===source||n.pinned)continue;
      let dx=n.x-source.x,dy=n.y-source.y,d=Math.max(1,Math.hypot(dx,dy));
      if(d<2){dx=Math.cos(n.id*2.4);dy=Math.sin(n.id*2.4);d=1;}
      const strength=4.2*Math.exp(-d/240);
      n.vx+=dx/d*strength;n.vy+=dy/d*strength;n.av+=(n.id%2?1:-1)*1.6;
    }
    source.vx=Math.cos(index*2.4)*2;source.vy=-3;source.av=-2.5;this.wake(1);
  }
  dragStart(index){const n=this.nodes[index];n.pinned=true;n.vx=n.vy=0;n.guide=null;this.wake(1);}
  dragTo(index,x,y){const n=this.nodes[index];n.vx=clamp((x-n.x)*.32,-7,7);n.vy=clamp((y-n.y)*.32,-7,7);n.x=x;n.y=y;this.bound(n);this.wake(1);}
  dragEnd(index){this.nodes[index].pinned=false;this.wake(1);}
  // Search endpoint swaps on a copy, then guide the real springs toward the
  // better layout. No node teleports and word IDs/edges never change.
  untangle(){
    if(this.nodes.length<4||this.edges.length<2)return;
    const plan=this.nodes.map(n=>({...n}));let count=crossingCount(plan,this.edges);
    if(!count)return;
    const changed=new Set();
    for(let pass=0;pass<(this.nodes.length>20?2:4);pass++){
      let best=null,bestCount=count,bestLength=Infinity,examined=0;
      outer:for(let i=0;i<this.edges.length;i++)for(let j=i+1;j<this.edges.length;j++){
        const e=this.edges[i],f=this.edges[j];
        if(e.a===f.a||e.a===f.b||e.b===f.a||e.b===f.b||!segmentsCross(plan[e.a],plan[e.b],plan[f.a],plan[f.b]))continue;
        if(++examined>4)break outer;
        for(const a of [e.a,e.b])for(const b of [f.a,f.b]){
          if(a<2||b<2||plan[a].pinned||plan[b].pinned)continue;
          const x=plan[a].x,y=plan[a].y;plan[a].x=plan[b].x;plan[a].y=plan[b].y;plan[b].x=x;plan[b].y=y;
          const proposed=crossingCount(plan,this.edges);
          const length=this.edges.reduce((s,k)=>s+Math.hypot(plan[k.a].x-plan[k.b].x,plan[k.a].y-plan[k.b].y),0);
          if(proposed<bestCount||(proposed===bestCount&&proposed<count&&length<bestLength)){best={a,b};bestCount=proposed;bestLength=length;}
          plan[b].x=plan[a].x;plan[b].y=plan[a].y;plan[a].x=x;plan[a].y=y;
        }
        // One crossing per pass keeps the planner bounded on dense boards.
        if(best)break outer;
      }
      if(!best)break;
      const a=plan[best.a],b=plan[best.b];[a.x,b.x]=[b.x,a.x];[a.y,b.y]=[b.y,a.y];
      changed.add(best.a);changed.add(best.b);count=bestCount;if(!count)break;
    }
    for(const i of changed)this.nodes[i].guide={x:plan[i].x,y:plan[i].y,ttl:180};
  }
  step(dt=1){
    dt=clamp(dt,.25,2);this.ticks++;this.heat*=Math.pow(.988,dt);
    const force=this.nodes.map(()=>({x:0,y:0}));
    for(let i=0;i<this.nodes.length;i++)for(let j=i+1;j<this.nodes.length;j++){
      const a=this.nodes[i],b=this.nodes[j];let dx=b.x-a.x,dy=b.y-a.y;
      let d=Math.hypot(dx,dy);if(d<.1){dx=Math.cos((i+j)*2.4);dy=Math.sin((i+j)*2.4);d=1;}
      const charge=2400/(d*d+100);let fx=dx/d*charge,fy=dy/d*charge;
      const ox=(a.width+b.width)/2+18-Math.abs(dx),oy=(a.height+b.height)/2+22-Math.abs(dy);
      if(ox>0&&oy>0){if(ox<oy)fx+=(dx>=0?1:-1)*ox*.13;else fy+=(dy>=0?1:-1)*oy*.13;}
      force[i].x-=fx;force[i].y-=fy;force[j].x+=fx;force[j].y+=fy;
    }
    for(const e of this.edges){
      const a=this.nodes[e.a],b=this.nodes[e.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy));
      const rest=62+(a.width+b.width)*.48, f=(d-rest)*.0095;
      force[e.a].x+=dx/d*f;force[e.a].y+=dy/d*f;force[e.b].x-=dx/d*f;force[e.b].y-=dy/d*f;
      // Push unrelated cards out of the path of a connection.
      for(const n of this.nodes){
        if(n===a||n===b)continue;
        const t=((n.x-a.x)*dx+(n.y-a.y)*dy)/(d*d);if(t<.08||t>.92)continue;
        const px=a.x+t*dx,py=a.y+t*dy,nx=n.x-px,ny=n.y-py,distance=Math.hypot(nx,ny);
        const clearance=n.height/2+13;
        if(distance<clearance){const sign=(n.id+e.a)%2?1:-1, ux=distance>.1?nx/distance:-dy/d*sign,uy=distance>.1?ny/distance:dx/d*sign;
          force[n.id].x+=ux*(clearance-distance)*.035;force[n.id].y+=uy*(clearance-distance)*.035;}
      }
    }
    if(this.ticks%48===0&&this.heat>.05)this.untangle();
    let motion=0;
    for(const n of this.nodes){
      if(n.pinned)continue;
      const f=force[n.id];
      if(n.id<2){const h=this.home(n.id);f.x+=(h.x-n.x)*.065;f.y+=(h.y-n.y)*.065;}
      else {f.x+=(this.width/2-n.x)*.0007;f.y+=(this.height/2-n.y)*.0007;}
      if(n.guide){f.x+=(n.guide.x-n.x)*.045;f.y+=(n.guide.y-n.y)*.045;if(--n.guide.ttl<=0)n.guide=null;}
      n.vx=clamp((n.vx+clamp(f.x,-4,4)*dt)*Math.pow(.86,dt),-8,8);
      n.vy=clamp((n.vy+clamp(f.y,-4,4)*dt)*Math.pow(.86,dt),-8,8);
      n.x+=n.vx*dt;n.y+=n.vy*dt;this.bound(n);
      const desired=clamp(n.vx*.65,-4,4);n.av=(n.av+(desired-n.angle)*.055)*.78;n.angle+=n.av*dt;
      motion+=n.vx*n.vx+n.vy*n.vy;
    }
    this.motion=motion/Math.max(1,this.nodes.length);
    return this.motion;
  }
  settle(steps=260){for(let i=0;i<steps;i++)this.step();for(const n of this.nodes)n.vx=n.vy=n.angle=n.av=0;this.heat=0;}
  shuffle(){
    for(const n of this.nodes){if(n.id<2||n.pinned)continue;const angle=n.id*2.399963+this.ticks*.023;n.guide={x:this.width/2+Math.cos(angle)*this.width*.28,y:this.height/2+Math.sin(angle)*this.height*.3,ttl:55};n.vx+=Math.cos(angle)*3;n.vy+=Math.sin(angle)*3;}
    this.wake(1);
  }
}
