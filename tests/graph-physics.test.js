import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GraphPhysics,crossingCount,edgeCurve,curvePath,pointAt,routeBend} from '../graph-physics.js';
const words=n=>Array.from({length:n},(_,i)=>'wort'+i);

test('A new word preserves positions and physically kicks its neighbours',()=>{
  const world=new GraphPhysics();world.setData(words(3),[{a:0,b:2,score:.7}],undefined,{impulse:false});world.settle();
  const before=world.nodes.map(n=>({x:n.x,y:n.y}));
  world.setData(words(4),[{a:0,b:2,score:.7},{a:2,b:3,score:.6}]);
  world.nodes.slice(0,3).forEach((n,i)=>assert.deepEqual({x:n.x,y:n.y},before[i]));
  assert.ok(world.nodes[2].vx**2+world.nodes[2].vy**2>0);
  world.step();assert.ok(Math.hypot(world.nodes[2].x-before[2].x,world.nodes[2].y-before[2].y)>.05);
});

test('Springs overshoot gently and damp back to rest',()=>{
  const world=new GraphPhysics();world.setData(words(2),[],undefined,{impulse:false});world.settle(400);
  const equilibrium=world.nodes[0].x;world.nodes[0].vx=7;
  const displacements=[];
  for(let i=0;i<300;i++){world.step();displacements.push(world.nodes[0].x-equilibrium);}
  assert.ok(Math.max(...displacements)>2);assert.ok(Math.min(...displacements)<-.1);
  assert.ok(Math.abs(displacements.at(-1))<.1);assert.ok(Math.abs(world.nodes[0].vx)<.01);
});

test('Rectangular word cards separate, including when spawned at identical coordinates',()=>{
  const world=new GraphPhysics(800,700);world.setData(words(10),[],()=>140,{impulse:false});
  for(const n of world.nodes.slice(2)){n.x=400;n.y=350;}
  world.settle(650);
  for(let i=0;i<world.nodes.length;i++)for(let j=i+1;j<world.nodes.length;j++){
    const a=world.nodes[i],b=world.nodes[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2,`${i}/${j} overlap`);
  }
});

test('Crossing planner uncrosses an X by moving springs rather than teleporting words',()=>{
  const world=new GraphPhysics(800,600),edges=[{a:2,b:3},{a:4,b:5}];
  world.setData(words(6),edges,()=>100,{impulse:false});
  [[240,160],[560,440],[240,440],[560,160]].forEach(([x,y],i)=>Object.assign(world.nodes[i+2],{x,y}));
  const before=world.nodes.map(n=>({x:n.x,y:n.y}));assert.equal(crossingCount(world.nodes,edges),1);
  world.untangle();world.nodes.forEach((n,i)=>assert.deepEqual({x:n.x,y:n.y},before[i]));
  assert.ok(world.nodes.some(n=>n.guide));world.settle(400);
  assert.equal(crossingCount(world.nodes,edges),0);
});

test('Curves leave card boundaries and route around an intervening word',()=>{
  const a={id:0,x:100,y:220,width:100,height:48},b={id:1,x:700,y:220,width:100,height:48};
  const obstacle={id:2,x:400,y:220,width:160,height:60};
  const bend=routeBend(a,b,[a,b,obstacle]);assert.ok(Math.abs(bend)>30);
  const curve=edgeCurve(a,b,bend);
  assert.ok(curve.p0.x>=a.x+a.width/2);assert.ok(curve.p3.x<=b.x-b.width/2);
  for(let i=1;i<40;i++){const p=pointAt(curve,i/40);assert.ok(Math.abs(p.x-obstacle.x)>obstacle.width/2||Math.abs(p.y-obstacle.y)>obstacle.height/2+4);}
  const first=pointAt(edgeCurve(a,b,bend,10),.5),second=pointAt(edgeCurve(a,b,bend,-10),.5);
  assert.ok(Math.hypot(first.x-second.x,first.y-second.y)>1);
});

test('Dragging remains bounded, then releases into the simulation',()=>{
  const world=new GraphPhysics(520,460);world.setData(words(4),[{a:0,b:2},{a:2,b:3}],undefined,{impulse:false});
  world.dragStart(2);world.dragTo(2,-500,900);const n=world.nodes[2];const position={x:n.x,y:n.y};
  world.step();assert.deepEqual({x:n.x,y:n.y},position);assert.ok(n.x>=n.width/2&&n.y<world.height);
  world.dragEnd(2);world.step();assert.equal(n.pinned,false);assert.notDeepEqual({x:n.x,y:n.y},position);
});

test('Dense 50-word boards remain finite and inside bounds through impulses and resize',()=>{
  const world=new GraphPhysics(800,1050),edges=[];
  for(let i=0;i<50;i++)for(let j=1;j<=2;j++)edges.push({a:i,b:(i+j)%50,score:.5});
  world.setData(words(50),edges,w=>110+w.length*3);
  for(let step=0;step<200;step++)world.step(step%3===0?2:1);
  world.resize(520,1750);world.pulse(49);world.settle(180);
  for(const n of world.nodes){assert.ok([n.x,n.y,n.vx,n.vy].every(Number.isFinite));assert.ok(n.x>=n.width/2&&n.x<=world.width-n.width/2);assert.ok(n.y>=24&&n.y<=world.height-24);}
  for(const e of edges){const path=curvePath(edgeCurve(world.nodes[e.a],world.nodes[e.b],10,3));assert.ok(!/NaN|Infinity/.test(path));}
});


test('Expanding the board preserves existing coordinates while the new space opens',()=>{
  const world=new GraphPhysics(520,460);world.setData(words(12),[],undefined,{impulse:false});world.settle(200);
  const before=world.nodes.map(n=>({x:n.x,y:n.y}));world.setData(words(13),[]);world.resize(520,570,{scale:false});
  world.nodes.slice(0,12).forEach((n,i)=>assert.deepEqual({x:n.x,y:n.y},before[i]));
});
