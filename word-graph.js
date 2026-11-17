import {GraphPhysics,clamp,edgeCurve,curvePath,pointAt,routeBend} from './graph-physics.js?v=4';
const NS='http://www.w3.org/2000/svg';
function svg(tag,attrs={},text){const el=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;return el;}
const title=word=>word.charAt(0).toLocaleUpperCase('de-DE')+word.slice(1);
const edgeKey=e=>`${Math.min(e.a,e.b)}:${Math.max(e.a,e.b)}`;

export class WordGraph {
  constructor(element,{onSelect,formatScore}){
    this.svg=element;this.onSelect=onSelect;this.formatScore=formatScore;
    this.world=new GraphPhysics();this.nodeViews=[];this.edgeViews=new Map();this.selected=null;this.winning=[];this.frame=null;this.lastTime=0;this.simTime=0;this.routeCursor=0;this.visible=true;
    this.motionQuery=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');this.reduced=!!this.motionQuery?.matches;
    this.edgesLayer=svg('g',{class:'graph-edges','aria-hidden':'true'});
    this.emptyLayer=svg('g',{'aria-hidden':'true'});
    this.labelsLayer=svg('g',{class:'graph-labels','aria-hidden':'true'});
    this.nodesLayer=svg('g',{class:'graph-nodes'});
    element.replaceChildren(this.emptyLayer,this.edgesLayer,this.labelsLayer,this.nodesLayer);
    this.emptyPath=svg('path',{class:'empty-line',fill:'none'});this.emptyQuestion=svg('text',{'text-anchor':'middle',class:'question-mark'},'?');this.emptyLayer.append(this.emptyPath,this.emptyQuestion);
    this.visibilityListener=()=>this.run();document.addEventListener('visibilitychange',this.visibilityListener);
    this.motionListener=()=>{this.reduced=!!this.motionQuery.matches;if(this.reduced){this.stop();for(const view of this.nodeViews)view.body.classList.remove('node-pop');for(const view of this.edgeViews.values())view.path.classList.remove('edge-enter');this.world.settle();this.routeAll();this.paint(performance.now());}else this.run();};
    this.motionQuery?.addEventListener?.('change',this.motionListener);
    if(globalThis.ResizeObserver){this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element.parentElement);}
    if(globalThis.IntersectionObserver){this.intersectionObserver=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.run();},{rootMargin:'80px'});this.intersectionObserver.observe(element);}
    this.resize();
  }
  reset(){this.stop();this.world=new GraphPhysics(this.world.width,this.world.height);this.nodeViews=[];this.edgeViews.clear();this.nodesLayer.replaceChildren();this.edgesLayer.replaceChildren();this.labelsLayer.replaceChildren();this.selected=null;this.winning=[];this.lastTime=0;this.simTime=0;this.routeCursor=0;}
  resize(){
    const pixels=this.svg.parentElement?.clientWidth||800,narrow=pixels<540;
    const width=narrow?520:800,columns=narrow?3:6;
    const height=Math.max(narrow?460:470,Math.ceil(this.world.nodes.length/columns)*92+110);
    this.world.resize(width,height,{scale:width!==this.world.width});
    this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const cssHeight=Math.max(narrow?310:420,pixels/width*height);
    this.svg.style.height=`${Math.round(cssHeight)}px`;
    if(this.world.nodes.length){if(this.reduced)this.world.settle();this.routeAll();this.paint(performance.now());this.run();}
  }
  update({words,edges,winning=[],selected=null}){
    const initial=this.world.nodes.length===0,oldCount=this.world.nodes.length;
    this.selected=selected;this.winning=winning;this.simTime=0;
    this.world.setData(words,edges,undefined,{impulse:!initial&&!this.reduced});
    for(let i=oldCount;i<words.length;i++)this.addNode(i,!initial);
    const keys=new Set(edges.map(edgeKey));
    for(const [key,view] of this.edgeViews)if(!keys.has(key)){view.path.remove();view.label.remove();this.edgeViews.delete(key);}
    for(const edge of edges){
      const key=edgeKey(edge);
      if(!this.edgeViews.has(key)){
        const path=svg('path',{class:'edge'+(!initial&&!this.reduced?' edge-enter':''),fill:'none',pathLength:'1'});
        path.addEventListener('animationend',()=>path.classList.remove('edge-enter'),{once:true});
        const label=svg('text',{'text-anchor':'middle',class:'edge-label'});
        this.edgesLayer.append(path);this.labelsLayer.append(label);
        this.edgeViews.set(key,{path,label,bend:0,bendVelocity:0,target:0,phase:edge.a*1.7+edge.b*2.9,...edge});
      }else Object.assign(this.edgeViews.get(key),edge);
    }
    this.resize();
    if(initial||this.reduced)this.world.settle(initial?180:260);
    this.styleSelection();this.routeAll();this.paint(performance.now());if(!initial&&words.length>oldCount)this.reveal(words.length-1);this.run();
  }
  reveal(index){
    const board=this.svg.parentElement,height=board?.clientHeight;
    if(!height||board.scrollHeight<=height)return;
    const scale=parseFloat(this.svg.style.height)/this.world.height;
    const y=this.world.nodes[index].y*scale,margin=44;
    if(y<board.scrollTop+margin||y>board.scrollTop+height-margin){
      const top=clamp(y-height*.5,0,board.scrollHeight-height);
      board.scrollTo?.({top,behavior:this.reduced?'auto':'smooth'});
    }
  }
  addNode(index,pop){
    const n=this.world.nodes[index],g=svg('g',{class:'node',tabindex:'0',role:'button','aria-label':`${title(n.word)}, Beziehungen anzeigen`});
    const hit=svg('path',{class:'node-hit',d:`M ${-n.width/2-4} -36 h ${n.width+8} v 72 h ${-n.width-8} Z`});
    const motion=svg('g',{class:'node-motion'}),body=svg('g',{class:'node-body'+(pop&&!this.reduced?' node-pop':'')});
    body.addEventListener('animationend',()=>body.classList.remove('node-pop'),{once:true});
    const card=svg('rect',{x:-n.width/2,y:-24,width:n.width,height:48,rx:13});
    body.append(card,svg('text',{'text-anchor':'middle','dominant-baseline':'central'},title(n.word)));motion.append(body);g.append(hit,motion);
    let pointer=null,suppressClickUntil=0;
    const end=e=>{
      if(!pointer||e.pointerId!==pointer.id)return;
      if(this.nodeViews[index]?.g!==g){pointer=null;return;}
      if(pointer.moved){suppressClickUntil=performance.now()+350;this.world.dragEnd(index);if(this.reduced){this.world.settle(180);this.routeAll();this.paint(performance.now());}}
      pointer=null;try{g.releasePointerCapture(e.pointerId);}catch{}this.run();
    };
    g.addEventListener('pointerdown',e=>{
      if(e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
      pointer={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
      try{g.setPointerCapture(e.pointerId);}catch{}
      g.focus?.({preventScroll:true});
    });
    g.addEventListener('pointermove',e=>{
      if(!pointer||e.pointerId!==pointer.id)return;
      if(!pointer.moved){if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<4)return;pointer.moved=true;this.simTime=0;this.world.dragStart(index);}
      const pt=this.pointerPoint(e);this.world.dragTo(index,pt.x,pt.y);
      if(this.reduced){this.world.nodes[index].angle=0;this.routeAll();this.paint(performance.now());}else this.run();
    });
    g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);g.addEventListener('lostpointercapture',end);
    g.addEventListener('click',()=>{if(performance.now()>=suppressClickUntil)this.onSelect(index);});
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.onSelect(index);}});
    this.nodesLayer.append(g);this.nodeViews.push({g,motion,body});
  }
  pointerPoint(event){
    const matrix=this.svg.getScreenCTM?.();
    if(matrix&&globalThis.DOMPoint)return new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    const rect=this.svg.getBoundingClientRect();return {x:(event.clientX-rect.left)/Math.max(1,rect.width)*this.world.width,y:(event.clientY-rect.top)/Math.max(1,rect.height)*this.world.height};
  }
  styleSelection(){
    const path=new Set(this.winning.slice(1).map((id,i)=>edgeKey({a:this.winning[i],b:id})));
    this.nodeViews.forEach((view,i)=>{view.g.classList.toggle('start',i===0);view.g.classList.toggle('end',i===1);view.g.classList.toggle('selected',this.selected===i);view.g.classList.toggle('solved',this.winning.includes(i));view.g.setAttribute('aria-pressed',String(this.selected===i));});
    for(const [key,view] of this.edgeViews){
      const focused=this.selected===view.a||this.selected===view.b,win=path.has(key);
      view.path.classList.toggle('winning',win);view.path.classList.toggle('focused',focused);
      view.label.textContent=this.formatScore(view.score);view.label.style.display=focused||win?'':'none';
    }
    this.emptyLayer.style.display=this.world.nodes.length===2&&!this.world.edges.length?'':'none';
  }
  select(index){this.selected=index;this.styleSelection();this.paint(performance.now());}
  routeAll(){
    const nodes=this.world.nodes;
    for(const view of this.edgeViews.values()){
      view.target=routeBend(nodes[view.a],nodes[view.b],nodes,view.target,this.world.edges.slice(0,24),this.world);
      if(this.reduced)view.bend=view.target;
    }
  }
  paint(time,dt=0){
    const seconds=time/1000,alive=this.reduced?0:1;
    const nodes=this.world.nodes.map(n=>({...n,x:n.x+Math.sin(seconds*.8+n.id*2.4)*.65*alive,y:n.y+Math.sin(seconds*.95+n.id*1.7)*.8*alive}));
    nodes.forEach((n,i)=>{
      const view=this.nodeViews[i];if(!view)return;
      view.g.setAttribute('transform',`translate(${n.x.toFixed(2)} ${n.y.toFixed(2)})`);
      view.motion.setAttribute('transform',`rotate(${(this.reduced?0:n.angle+Math.sin(seconds+n.id)*.22).toFixed(2)})`);
    });
    for(const view of this.edgeViews.values()){
      if(dt){view.bendVelocity=(view.bendVelocity+(view.target-view.bend)*.055*dt)*Math.pow(.79,dt);view.bend+=view.bendVelocity*dt;}
      const pulse=this.reduced?0:Math.sin(seconds*4.2+view.phase)*(1.4+this.world.heat*12)+Math.sin(seconds*2.1+view.phase)*this.world.heat*3;
      const curve=edgeCurve(nodes[view.a],nodes[view.b],view.bend,pulse);
      view.path.setAttribute('d',curvePath(curve));
      const label=pointAt(curve,.5);view.label.setAttribute('x',label.x.toFixed(2));view.label.setAttribute('y',(label.y-9).toFixed(2));
    }
    if(nodes.length===2){const a=nodes[0],b=nodes[1];this.emptyPath.setAttribute('d',curvePath(edgeCurve(a,b,24)));const p=pointAt(edgeCurve(a,b,24),.5);this.emptyQuestion.setAttribute('x',p.x);this.emptyQuestion.setAttribute('y',p.y-12);}
  }
  run(){
    if(this.reduced||document.hidden||!this.visible||!this.world.nodes.length){this.stop();return;}
    if(this.frame!==null)return;
    this.lastTime=0;
    this.frame=requestAnimationFrame(t=>this.animate(t));
  }
  animate(time){
    this.frame=null;
    if(this.reduced||document.hidden||!this.visible)return;
    const elapsed=this.lastTime?time-this.lastTime:16.667;
    const active=this.world.heat>.008&&this.simTime<900;
    if(!active&&elapsed<32){this.frame=requestAnimationFrame(t=>this.animate(t));return;}
    this.lastTime=time;const dt=clamp(elapsed/16.667,.3,2);
    if(active){this.world.step(dt);this.simTime++;}
    else if(this.world.nodes.some(n=>n.pinned))this.world.step(dt);
    if(active&&this.edgeViews.size){
      const views=[...this.edgeViews.values()];
      for(let k=0;k<Math.min(2,views.length);k++){
        const view=views[this.routeCursor++%views.length];
        view.target=routeBend(this.world.nodes[view.a],this.world.nodes[view.b],this.world.nodes,view.target,this.world.edges.slice(0,24),this.world);
      }
    }
    this.paint(time,dt);this.frame=requestAnimationFrame(t=>this.animate(t));
  }
  stop(){if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.lastTime=0;}
  shuffle(){this.world.shuffle();this.simTime=0;if(this.reduced){this.world.settle();this.routeAll();this.paint(performance.now());}this.run();}
  destroy(){this.stop();this.resizeObserver?.disconnect();this.intersectionObserver?.disconnect();document.removeEventListener('visibilitychange',this.visibilityListener);this.motionQuery?.removeEventListener?.('change',this.motionListener);}
}
