import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateStorage,readStorage,writeStorage} from '../storage.js';
function memory(entries={}){
  const data=new Map(Object.entries(entries));
  return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value))};
}

test('Rename migrates rounds, settings and statistics without removing legacy entries',()=>{
  const round={words:['hund','computer','katze'],hints:1,finished:false};
  const store=memory({'linxikon:fasttext-de-abtt3-v1:2026-11-17':JSON.stringify(round),'linxikon:fasttext-de-abtt3-v1:practice':JSON.stringify(round),'linxikon:fasttext-de-abtt3-v1:stats':'{"games":8,"wins":5}','linxikon:settings':'{"dark":true}','linxikon:seenHelp':'true','other-app:settings':'unchanged'});
  assert.equal(migrateStorage(store),true);
  assert.deepEqual(readStorage('semantio:fasttext-de-abtt3-v1:2026-11-17',null,store),round);
  assert.deepEqual(readStorage('semantio:fasttext-de-abtt3-v1:practice',null,store),round);
  assert.deepEqual(readStorage('semantio:fasttext-de-abtt3-v1:stats',null,store),{games:8,wins:5});
  assert.deepEqual(readStorage('semantio:settings',null,store),{dark:true});assert.equal(readStorage('semantio:seenHelp',false,store),true);
  assert.equal(store.getItem('linxikon:settings'),'{"dark":true}');assert.equal(store.getItem('other-app:settings'),'unchanged');assert.equal(store.getItem('semantio:other-app:settings'),null);
});
test('Repeated migrations preserve newer Semantio progress',()=>{
  const store=memory({'linxikon:settings':'{"dark":false}','semantio:settings':'{"dark":true}'});
  assert.ok(migrateStorage(store));assert.ok(migrateStorage(store));assert.deepEqual(readStorage('semantio:settings',null,store),{dark:true});
  assert.ok(writeStorage('semantio:settings',{dark:false,sharePath:true},store));migrateStorage(store);
  assert.deepEqual(readStorage('semantio:settings',null,store),{dark:false,sharePath:true});
});
test('Full or blocked storage retains readable legacy saves and does not crash',()=>{
  const store=memory({'linxikon:settings':'{"dark":true}'});store.setItem=()=>{throw new Error('Quota exceeded');};
  assert.equal(migrateStorage(store),false);assert.deepEqual(readStorage('semantio:settings',{},store),{dark:true});assert.equal(writeStorage('semantio:settings',{},store),false);
  const blocked={get length(){throw Error('Blocked');},getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');}};
  assert.equal(migrateStorage(blocked),false);assert.deepEqual(readStorage('semantio:settings',{},blocked),{});assert.equal(writeStorage('semantio:settings',{},blocked),false);
});
test('Broken or absent saves fall back to defaults',()=>{
  const store=memory({'semantio:settings':'{broken'});assert.deepEqual(readStorage('semantio:settings',{},store),{});assert.equal(readStorage('semantio:missing',false,store),false);
});
