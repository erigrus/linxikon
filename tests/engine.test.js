import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Lexicon,MODEL_VERSION,LINK_THRESHOLD,normalize,links,boardPath,PAIRS,dailyPair,dateKey,formatScore,loadLexicon} from '../engine.js';
const manifest=JSON.parse(readFileSync(new URL('../data/fasttext/manifest.json',import.meta.url)));
const vectorBytes=Buffer.concat(manifest.shards.map(s=>readFileSync(new URL('../data/fasttext/'+s.file,import.meta.url))));
const lexicon=new Lexicon(manifest,new Int8Array(vectorBytes.buffer,vectorBytes.byteOffset,vectorBytes.byteLength));
test('German normalization and vector coverage',()=>{assert.equal(normalize('  BÄUME  '),'bäume');for(const word of ['Wasser','Bäume','Straße','Sonnenlicht','Erdbeere','Himbeere'])assert.ok(lexicon.has(word),word);assert.ok(!lexicon.has('xyzabcxyz'));assert.equal(lexicon.score('xyzabcxyz','wasser'),null);});
test('Cosine uses vector direction, supports negative values, and is symmetric',()=>{
 const vectors=new Int8Array(900);vectors[0]=3;vectors[1]=4;vectors[300]=6;vectors[301]=8;vectors[600]=-3;vectors[601]=-4;
 const model=new Lexicon({version:MODEL_VERSION,dimensions:300,count:3,words:['eins','zwei','drei'],routes:{}},vectors);
 assert.equal(model.score('eins','zwei'),1);assert.equal(model.score('eins','drei'),-1);assert.equal(model.score('zwei','eins'),1);
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
 for(const [a,b] of PAIRS){const route=lexicon.route(a,b);assert.ok(route.length>=3&&route.length<40,`${a} → ${b}: ${route.length}`);assert.ok(lexicon.score(a,b)<LINK_THRESHOLD,`${a}/${b} starts disconnected`);for(let i=1;i<route.length;i++)assert.ok(lexicon.score(route[i-1],route[i])>=LINK_THRESHOLD,`${route[i-1]}/${route[i]}`);const words=[a,b,...route.slice(1,-1)];assert.ok(boardPath(words,links(words,lexicon)).length,`${a} → ${b}`);assert.deepEqual(lexicon.route(b,a),[...route].reverse());}
});
test('Only a continuous path wins',()=>{assert.deepEqual(boardPath(['meer','wolke','wasser'],[{a:0,b:2,score:.64}]),[]);assert.deepEqual(boardPath(['meer','wolke','wasser','regen'],[{a:0,b:2},{a:2,b:3},{a:3,b:1}]),[0,2,3,1]);});
test('Top-five pruning drops an edge only when neither endpoint ranks it in its top five',()=>{
 const words=Array.from({length:8},(_,i)=>String(i)),score=(a,b)=>a===b?1: a==='0'||b==='0'?.5+Number(a==='0'?b:a)/100:.9;
 const edges=links(words,{score});assert.ok(!edges.some(e=>e.a===0&&e.b===1));assert.ok(edges.some(e=>e.a===0&&e.b===7));
});
test('Scores show enough precision at the linking boundary',()=>{assert.equal(formatScore(.29949),'29,9 %');assert.equal(formatScore(.2995),'30,0 %');assert.equal(formatScore(null),'–');});
test('Daily selection is deterministic and local date avoids UTC rollover',()=>{assert.deepEqual(dailyPair('2026-11-16'),dailyPair('2026-11-16'));assert.equal(dateKey(new Date(2026,0,2,0,1)),'2026-01-02');});
test('Actual shard loader verifies all data and reports completed progress',async()=>{
 let progress=0;const model=await loadLexicon((loaded,total)=>{assert.ok(loaded<=total);progress=loaded/total;},async url=>{
  const path=new URL('../'+url.split('?')[0],import.meta.url),data=readFileSync(path);
  return {ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>Uint8Array.from(data).buffer};
 });assert.equal(progress,1);assert.equal(model.score('hund','katze'),lexicon.score('hund','katze'));
});
test('Missing and corrupt shards fail instead of falling back to old fixed scores',async()=>{
 await assert.rejects(loadLexicon(()=>{},async url=>url.includes('manifest')?{ok:true,json:async()=>manifest}:{ok:false}),/geladen/);
 await assert.rejects(loadLexicon(()=>{},async url=>url.includes('manifest')?{ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),/Unvollständige/);
 await assert.rejects(loadLexicon(()=>{},async url=>url.includes('manifest')?{ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(manifest.shards.find(s=>url.includes(s.file)).rows*300)}),/Prüfsumme/);
});
