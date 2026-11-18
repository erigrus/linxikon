import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Lexicon,MODEL_VERSION,SCORING_VERSION,LINK_THRESHOLD,normalize,links,boardPath,averagePathStrength,puzzlePoints,PAIRS,dailyPair,dateKey,formatScore,loadLexicon} from '../engine.js';
const manifest=JSON.parse(readFileSync(new URL('../data/fasttext/manifest.json',import.meta.url)));
const vectorBytes=Buffer.concat(manifest.shards.map(s=>readFileSync(new URL('../data/fasttext/'+s.file,import.meta.url))));
const language=Object.fromEntries(['forms','families','synonyms','calibration'].map(name=>[name,JSON.parse(readFileSync(new URL('../data/relationships/'+name+'.json',import.meta.url)))]));
const lexicon=new Lexicon(manifest,new Int8Array(vectorBytes.buffer,vectorBytes.byteOffset,vectorBytes.byteLength),language);
test('German normalization and vector coverage',()=>{assert.equal(normalize('  BÄUME  '),'bäume');for(const word of ['Wasser','Bäume','Straße','Sonnenlicht','Erdbeere','Himbeere'])assert.ok(lexicon.has(word),word);assert.ok(!lexicon.has('xyzabcxyz'));assert.equal(lexicon.score('xyzabcxyz','wasser'),null);});
test('Cosine uses vector direction, supports negative values, and is symmetric',()=>{
 const vectors=new Int8Array(900);vectors[0]=3;vectors[1]=4;vectors[300]=6;vectors[301]=8;vectors[600]=-3;vectors[601]=-4;
 const model=new Lexicon({version:MODEL_VERSION,dimensions:300,count:3,words:['eins','zwei','drei'],routes:{}},vectors);
 assert.equal(model.cosine('eins','zwei'),1);assert.equal(model.cosine('eins','drei'),-1);assert.equal(model.cosine('zwei','eins'),1);
 assert.throws(()=>new Lexicon({...manifest,count:1},new Int8Array(0)),/Ungültige/);
});
test('Real model distinguishes everyday associations from unrelated controls',()=>{
 for(const [a,b,unrelated] of [['hund','katze','computer'],['erdbeere','himbeere','bahnhof'],['kaffee','tee','flugzeug'],['sonne','mond','schuh'],['meer','ozean','tastatur'],['auto','fahrzeug','banane']]){
  const similar=lexicon.score(a,b),control=lexicon.score(a,unrelated);
  assert.ok(similar!==null&&control!==null,`${a}/${b}/${unrelated}: coverage`);
  assert.ok(similar>control+.15,`${a}/${b}: ${similar} vs ${control}`);
  assert.equal(similar,lexicon.score(b,a));
 }
 const scores=['katze','tier','computer','sonne'].map(w=>lexicon.score('hund',w));assert.ok(new Set(scores).size===4,'Continuous scores replace group constants');
});
test('Every shipped puzzle is solvable with the actual quantized vectors and top-five rule',()=>{
 for(const [a,b] of PAIRS){const route=lexicon.route(a,b);assert.equal(route[0],a);assert.equal(route.at(-1),b);assert.equal(new Set(route.map(w=>lexicon.canonical(w))).size,route.length);assert.ok(route.length>=3&&route.length<40,`${a} → ${b}: ${route.length}`);assert.ok(lexicon.score(a,b)<LINK_THRESHOLD,`${a}/${b} starts disconnected`);for(let i=1;i<route.length;i++)assert.ok(lexicon.score(route[i-1],route[i])>=LINK_THRESHOLD,`${route[i-1]}/${route[i]}`);const words=[a,b,...route.slice(1,-1)];assert.ok(boardPath(words,links(words,lexicon)).length,`${a} → ${b}`);assert.deepEqual(lexicon.route(b,a),[...route].reverse());}
});
test('Only a continuous path wins',()=>{assert.deepEqual(boardPath(['meer','wolke','wasser'],[{a:0,b:2,score:.64}]),[]);assert.deepEqual(boardPath(['meer','wolke','wasser','regen'],[{a:0,b:2},{a:2,b:3},{a:3,b:1}]),[0,2,3,1]);});
test('Top-five pruning drops an edge only when neither endpoint ranks it in its top five',()=>{
 const words=Array.from({length:8},(_,i)=>String(i)),score=(a,b)=>a===b?1: a==='0'||b==='0'?.5+Number(a==='0'?b:a)/100:.9;
 const edges=links(words,{score});assert.ok(!edges.some(e=>e.a===0&&e.b===1));assert.ok(edges.some(e=>e.a===0&&e.b===7));
});
test('Scores show enough precision at the linking boundary',()=>{assert.equal(formatScore(.49949),'49,9 %');assert.equal(formatScore(.4995),'50,0 %');assert.equal(formatScore(null),'–');});
test('Daily selection is deterministic and local date avoids UTC rollover',()=>{assert.deepEqual(dailyPair('2026-11-16'),dailyPair('2026-11-16'));assert.equal(dateKey(new Date(2026,0,2,0,1)),'2026-01-02');});
test('Actual shard loader verifies all data and reports completed progress',async()=>{
 let progress=0;const model=await loadLexicon((loaded,total)=>{assert.ok(loaded<=total);progress=loaded/total;},async url=>{
  const path=new URL('../'+url.split('?')[0],import.meta.url),data=readFileSync(path);
  return {ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>Uint8Array.from(data).buffer};
 });assert.equal(progress,1);assert.equal(model.score('hund','katze'),lexicon.score('hund','katze'));
});
test('Missing and corrupt shards fail rather than falling back to old scores',async()=>{
 const fetchData=async url=>{
  const bytes=readFileSync(new URL('../'+url.split('?')[0],import.meta.url));
  return {ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
 };
 await assert.rejects(loadLexicon(()=>{},async url=>url.endsWith('.i8')||url.includes('.i8?')?{ok:false}:fetchData(url)),/geladen/);
 await assert.rejects(loadLexicon(()=>{},async url=>url.includes('.i8?')?{ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}:fetchData(url)),/Unvollständige/);
 await assert.rejects(loadLexicon(()=>{},async url=>url.includes('.i8?')?{ok:true,arrayBuffer:async()=>new ArrayBuffer(manifest.shards.find(s=>url.includes(s.file)).rows*300)}:fetchData(url)),/Prüfsumme/);
 await assert.rejects(loadLexicon(()=>{},async url=>url.includes('forms.json?')?{ok:false}:fetchData(url)),/Sprachdaten/);
 await assert.rejects(loadLexicon(()=>{},async url=>url.includes('forms.json?')?{ok:true,arrayBuffer:async()=>new ArrayBuffer(readFileSync(new URL('../data/relationships/forms.json',import.meta.url)).length)}:fetchData(url)),/Prüfsumme/);
});

test('User examples and independent positive/negative controls match expected playability',()=>{
 const gold=JSON.parse(readFileSync(new URL('./fixtures/relationship-quality.json',import.meta.url)));
 for(const [a,b] of gold.positive){assert.ok(lexicon.has(a)&&lexicon.has(b),a+'/'+b+' vocabulary');assert.ok(lexicon.score(a,b)>=LINK_THRESHOLD,`${a}/${b}: ${lexicon.score(a,b)}`);}
 for(const [a,b] of gold.negative){assert.ok(lexicon.has(a)&&lexicon.has(b),a+'/'+b+' vocabulary');assert.ok(lexicon.score(a,b)<LINK_THRESHOLD,`${a}/${b}: ${lexicon.score(a,b)}`);}
});
test('Inflected forms share dictionary concepts and recover absent lemma vectors',()=>{
 assert.equal(lexicon.canonical('Vitamin'),lexicon.canonical('Vitamine'));
 assert.equal(lexicon.canonical('Baum'),lexicon.canonical('Bäume'));
 assert.equal(lexicon.canonical('Haus'),lexicon.canonical('Häuser'));
 assert.equal(lexicon.score('Vitamin','Obst'),lexicon.score('Vitamine','Obst'));
 assert.ok(lexicon.has('Nährstoff'));assert.equal(lexicon.canonical('Nährstoff'),lexicon.canonical('Nährstoffe'));
 assert.notEqual(lexicon.canonical('Buch'),lexicon.canonical('Buche'));
 assert.notEqual(lexicon.canonical('Arbeit'),lexicon.canonical('arbeiten'));
});
test('Connections explain dictionary and context evidence, without pretending they are raw cosine',()=>{
 const family=lexicon.relation('Arbeit','überarbeitet');assert.equal(family.reason,'family');assert.ok(family.score>=LINK_THRESHOLD);assert.ok(family.cosine<0);
 const context=lexicon.relation('Vitamin','Obst');assert.equal(context.reason,'context');assert.ok(context.score>=LINK_THRESHOLD);
 assert.equal(lexicon.relation('Vitamin','Vitamine').reason,'form');
 assert.equal(lexicon.relation('xyzabcxyz','Obst').score,null);
});
test('Pruned visual graph retains bridges between dense semantic clusters',()=>{
 const words=Array.from({length:12},(_,i)=>String(i));
 const group=i=>i===0||(i>=2&&i<=6)?0:1;
 const score=(a,b)=>group(+a)===group(+b)?.9:([+a,+b].sort((x,y)=>x-y).join(':')==='6:7'?.55:0);
 const edges=links(words,{score});assert.ok(edges.some(e=>e.a===6&&e.b===7));assert.ok(boardPath(words,edges).length);
});

test('Connection strength rewards equal efficiency but cannot outweigh a word or attempt', () => {
 assert.equal(puzzlePoints(3, 8, .8), 89.79);
 assert.ok(puzzlePoints(3, 8, .8) > puzzlePoints(3, 8, .6));
 for (let attempts = 1; attempts < 48; attempts++) {
  for (let intermediateWords = 0; intermediateWords <= attempts; intermediateWords++) {
   const better = puzzlePoints(intermediateWords, attempts, LINK_THRESHOLD);
   assert.ok(better > puzzlePoints(intermediateWords, attempts + 1, 1));
   if (intermediateWords < attempts) {
    assert.ok(better > puzzlePoints(intermediateWords + 1, attempts, 1));
   }
  }
 }
 assert.equal(puzzlePoints(0, 0, 1), 100);
});

test('The shortest path uses the stronger chain when multiple paths have the same length', () => {
 const words = ['start', 'ziel', 'schwach', 'stark', 'umweg', 'länger'];
 const edges = [
  {a: 0, b: 2, score: .6}, {a: 2, b: 1, score: .6},
  {a: 0, b: 3, score: .8}, {a: 3, b: 1, score: .9},
  {a: 0, b: 4, score: .99}, {a: 4, b: 5, score: .99}, {a: 5, b: 1, score: .99},
 ];
 const path = boardPath(words, edges);
 assert.deepEqual(path, [0, 3, 1]);
 assert.ok(Math.abs(averagePathStrength(path, edges) - .85) < 1e-12);
});
