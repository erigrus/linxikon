export const normalize = word => word.trim().toLocaleLowerCase('de-DE').normalize('NFC');
export const MODEL_VERSION = 'fasttext-de-abtt3-v1';
export const SCORING_VERSION = 'de-relations-v3';
export const PREVIOUS_SCORING_VERSION = 'de-relations-v2';
export const LINK_THRESHOLD = .4995;
const MIN_BASE_COSINE = .21;
const MIN_CONTEXT_COSINE = .25;
export const MAX_PUZZLE_POINTS = 10_000;
export const POINTS_PER_WORD = 100;
export const MAX_SIMILARITY_BONUS = POINTS_PER_WORD - 1;

export function puzzlePoints(intermediateWords, attempts, averageStrength) {
  const efficiencyPoints = MAX_PUZZLE_POINTS - (intermediateWords + attempts) * POINTS_PER_WORD;
  // The bonus is smaller than the cost of a single word or attempt.
  const bonus = Math.round(averageStrength * MAX_SIMILARITY_BONUS);
  return Math.min(MAX_PUZZLE_POINTS, efficiencyPoints + bonus);
}

const percent = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1});
export const formatScore = score => score === null ? '–' : percent.format(score * 100) + ' %';
const pointsFormat = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 0});
export const formatPuzzlePoints = points => pointsFormat.format(points);
const labels={identity:'Gleiches Wort',form:'Gleiche Grundform',family:'Wortfamilie',synonym:'Synonym',context:'Kontextbezug',weak:'Noch zu wenig Nähe',unknown:'Wort fehlt'};
const directTypes = {
  kind: {score: .82, label: 'Oberbegriff'},
  unit: {score: .74, label: 'Maßeinheit'},
  purpose: {score: .74, label: 'Verwendungszweck'},
  ingredient: {score: .76, label: 'Zutat'},
};
function membership(groups){
  const map=new Map();
  groups.forEach((group,id)=>group.forEach(word=>{if(!map.has(word))map.set(word,new Set());map.get(word).add(id);}));
  return map;
}
function shared(map,a,b){const x=map.get(a),y=map.get(b);if(!x||!y)return false;for(const id of x)if(y.has(id))return true;return false;}
function contextStrength(cosine,cutoff){
  cutoff=Math.min(cutoff,.2995);
  if(cosine<=0)return 0;
  return cosine<cutoff?.5*cosine/cutoff:.5+.5*(cosine-cutoff)/(1-cutoff);
}
export class Lexicon {
  constructor(manifest,vectors,language={}) {
    if(manifest.version!==MODEL_VERSION||manifest.dimensions!==300||manifest.count!==manifest.words.length||!(vectors instanceof Int8Array)||vectors.length!==manifest.count*300)throw new Error('Ungültige oder unvollständige Wortvektoren');
    this.words=manifest.words;this.dimensions=300;this.index=new Map(this.words.map((word,i)=>[word,i]));
    if(this.index.size!==manifest.count)throw new Error('Doppelte Wörter im Modell');
    this.vectors=vectors;this.norms=new Float64Array(manifest.count);this.routes=manifest.routes;this.cache=new Map();
    this.names=[...this.words];this.formById=new Int32Array(manifest.count).fill(-1);this.prototypes=[];this.aliases=new Map();
    for(let row=0;row<manifest.count;row++){let sum=0;for(let k=0;k<300;k++)sum+=vectors[row*300+k]**2;if(!sum)throw new Error('Leerer Wortvektor');this.norms[row]=Math.sqrt(sum);}
    for(const [lemma,...members] of language.forms?.groups||[]){
      if(typeof lemma!=='string'||!members.length||members.some(i=>!Number.isInteger(i)||i<0||i>=manifest.count))throw new Error('Ungültige Wortformen');
      const id=this.prototypes.length,base=this.index.get(lemma);
      const prototypes=[...new Set([...(base===undefined?[]:[base]),...members])].slice(0,3);
      this.prototypes.push(prototypes);
      for(const i of members){this.formById[i]=id;this.names[i]=lemma;}
      if(base===undefined)this.aliases.set(lemma,prototypes[0]);
    }
    this.families=membership(language.families?.groups||[]);this.synonyms=membership(language.synonyms?.groups||[]);
    this.direct = new Map();
    for (const [reason, details] of Object.entries(directTypes)) {
      for (const [term, related] of language.direct?.[reason] ?? []) {
        const concept = this.canonical(term);
        for (const word of related) {
          const meaning = this.canonical(word);
          for (const [a, b] of [[concept, meaning], [meaning, concept]]) {
            if (!this.direct.has(a)) this.direct.set(a, new Map());
            const neighbors = this.direct.get(a);
            if ((neighbors.get(b)?.score ?? 0) < details.score) {
              neighbors.set(b, {...details, reason});
            }
          }
        }
      }
    }
    this.cutoffs=language.calibration?.cutoffs||new Array(manifest.count).fill(.30);
    if(this.cutoffs.length!==manifest.count||this.cutoffs.some(x=>!Number.isFinite(x)||x<.219||x>.301))throw new Error('Ungültige Kontextkalibrierung');
  }
  resolve(word){const key=normalize(word);return this.index.get(key)??this.aliases.get(key);}
  has(word){return this.resolve(word)!==undefined||this.direct.has(normalize(word));}
  canonical(word){const id=this.resolve(word);return id===undefined?normalize(word):this.names[id];}
  cosineIds(i,j){
    if(i===j)return 1;
    let dot=0;for(let k=0;k<300;k++)dot+=this.vectors[i*300+k]*this.vectors[j*300+k];
    return Math.max(-1,Math.min(1,dot/(this.norms[i]*this.norms[j])));
  }
  cosine(a,b){const i=this.resolve(a),j=this.resolve(b);return i===undefined||j===undefined?null:this.cosineIds(i,j);}
  relation(a,b,version=SCORING_VERSION){
    const legacy = version === PREVIOUS_SCORING_VERSION;
    const i=this.resolve(a),j=this.resolve(b);
    const nameA=this.canonical(a),nameB=this.canonical(b);
    const direct=legacy?undefined:this.direct.get(nameA)?.get(nameB);
    if(i===undefined||j===undefined){
      if(direct)return {...direct,cosine:null};
      if(!legacy&&this.has(a)&&this.has(b)){
        const reason=nameA===nameB?'identity':'weak';
        return {score:reason==='identity'?1:0,cosine:null,reason,label:labels[reason]};
      }
      return {score:null,cosine:null,reason:'unknown',label:labels.unknown};
    }
    const cosine=this.cosineIds(i,j);
    if(this.names[i]===this.names[j]){const reason=normalize(a)===normalize(b)?'identity':'form';return {score:1,cosine,reason,label:labels[reason]};}
    const key=(legacy?'legacy:':'')+(i<j?i+':'+j:j+':'+i);
    if(this.cache.has(key))return this.cache.get(key);
    let score=0,contextCosine=cosine;
    const left=[...new Set([i,...(this.prototypes[this.formById[i]]||[])])],right=[...new Set([j,...(this.prototypes[this.formById[j]]||[])])];
    for(const x of left)for(const y of right){
      const cutoff=Math.max(this.cutoffs[x],this.cutoffs[y],legacy?0:MIN_CONTEXT_COSINE);
      const value=this.cosineIds(x,y),strength=contextStrength(value,cutoff);
      if(strength>score){score=strength;contextCosine=value;}
    }
    if (!legacy) {
      // A single fortunate inflection must not create a contextual link
      // when the vocabulary's base forms provide too little evidence.
      const base = this.cosineIds(this.resolve(nameA) ?? i, this.resolve(nameB) ?? j);
      if (base < MIN_BASE_COSINE) {
        score = Math.min(score, Math.max(0, base) / MIN_BASE_COSINE * LINK_THRESHOLD);
      }
    }
    let reason=score>=LINK_THRESHOLD?'context':'weak';
    if(shared(this.families,this.names[i],this.names[j])&&score<.72){score=.72;reason='family';}
    if(shared(this.synonyms,this.names[i],this.names[j])&&score<.88){score=.88;reason='synonym';}
    let label=labels[reason];
    if(direct&&score<direct.score){score=direct.score;reason=direct.reason;label=direct.label;}
    const result={score,cosine,contextCosine,reason,label};
    if(this.cache.size>=8192)this.cache.clear();this.cache.set(key,result);return result;
  }
  score(a,b,version){return this.relation(a,b,version).score;}
  route(start,end,version){
    start=normalize(start);end=normalize(end);
    const direct=this.routes[start+'|'+end],backward=this.routes[end+'|'+start];
    const stored=direct||backward,reversed=!direct&&!!backward;
    if(stored){
      // Collapse equivalent spellings and find a valid shortest route through
      // the remaining concepts, so hints never demand a duplicate word form.
      const candidates=[],seen=new Set();
      for(const word of stored){const concept=this.canonical(word);if(seen.has(concept))continue;seen.add(concept);if(concept===this.canonical(stored.at(-1))){candidates.push(stored.at(-1));break;}candidates.push(word);}
      const target=candidates.length-1,queue=[0],parents=new Map([[0,null]]);
      for(let p=0;p<queue.length;p++){
        const i=queue[p];if(i===target){const path=[];for(let j=target;j!==null;j=parents.get(j))path.unshift(candidates[j]);return reversed?path.reverse():path;}
        for(let j=0;j<candidates.length;j++)if(!parents.has(j)&&this.score(candidates[i],candidates[j],version)>=LINK_THRESHOLD){parents.set(j,i);queue.push(j);}
      }
      return [];
    }
    const score=this.score(start,end,version);return score!==null&&score>=LINK_THRESHOLD?[start,end]:[];
  }
}
async function verified(bytes,hash){
  if(globalThis.crypto?.subtle){
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    if([...digest].map(n=>n.toString(16).padStart(2,'0')).join('')!==hash)throw new Error('Prüfsumme der Modelldaten stimmt nicht');
  }
}
// The public vector model and the separately licensed linguistic resources
// must all load successfully. There is no silent fallback to old scoring.
export async function loadLexicon(onProgress=()=>{},fetcher=fetch){
  const responses=await Promise.all([fetcher('./data/fasttext/manifest.json',{cache:'no-cache'}),fetcher('./data/relationships/manifest-v3.json',{cache:'no-cache'})]);
  if(responses.some(r=>!r.ok))throw new Error('Wortmodell nicht erreichbar');
  const [manifest,rules]=await Promise.all(responses.map(r=>r.json()));
  if(manifest.version!==MODEL_VERSION||manifest.dimensions!==300||!Number.isSafeInteger(manifest.count)||manifest.count<1||manifest.count>200000||!Array.isArray(manifest.shards)||manifest.shards.length>100||manifest.shards.some(s=>!/^vectors-\d{2}\.i8$/.test(s.file)||!Number.isSafeInteger(s.rows)||s.rows<1)||manifest.shards.reduce((n,s)=>n+s.rows,0)!==manifest.count)throw new Error('Unbekannte Modellversion');
  const names=['forms.json','families.json','synonyms.json','calibration.json','direct.json'];
  if(rules.version!==SCORING_VERSION||rules.modelVersion!==MODEL_VERSION||rules.count!==manifest.count||!Array.isArray(rules.files)||rules.files.length!==names.length||new Set(rules.files.map(f=>f.file)).size!==names.length||rules.files.some(f=>!names.includes(f.file)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>10000000))throw new Error('Ungültige Sprachdaten');
  await verified(new TextEncoder().encode(JSON.stringify(manifest.words)),rules.vocabularySha256);
  const vectors=new Int8Array(manifest.count*300),language={};let loaded=0,next=0,cursor=0;
  const total=vectors.byteLength+rules.files.reduce((sum,f)=>sum+f.bytes,0);
  onProgress(0,total);const tasks=[];
  for(const shard of manifest.shards){const offset=cursor;cursor+=shard.rows*300;tasks.push(async()=>{
    const response=await fetcher('./data/fasttext/'+shard.file+'?sha='+shard.sha256);if(!response.ok)throw new Error('Wortvektoren konnten nicht geladen werden');
    const bytes=await response.arrayBuffer();if(bytes.byteLength!==shard.rows*300)throw new Error('Unvollständige Wortvektoren');
    await verified(bytes,shard.sha256);vectors.set(new Int8Array(bytes),offset);loaded+=bytes.byteLength;onProgress(loaded,total);
  });}
  for(const file of rules.files)tasks.push(async()=>{
    const response=await fetcher('./data/relationships/'+file.file+'?sha='+file.sha256);if(!response.ok)throw new Error('Sprachdaten konnten nicht geladen werden');
    const bytes=await response.arrayBuffer();if(bytes.byteLength!==file.bytes)throw new Error('Unvollständige Sprachdaten');
    await verified(bytes,file.sha256);language[file.file.replace('.json','')]=JSON.parse(new TextDecoder().decode(bytes));loaded+=bytes.byteLength;onProgress(loaded,total);
  });
  async function worker(){while(next<tasks.length){const task=tasks[next++];await task();}}
  await Promise.all(Array.from({length:4},worker));return new Lexicon(manifest,vectors,language);
}
export function links(words,lexicon,version) {
  const all=[];
  for(let i=0;i<words.length;i++) for(let j=i+1;j<words.length;j++) {
    const score=lexicon.score(words[i],words[j],version); if(score>=LINK_THRESHOLD)all.push({a:i,b:j,score});
  }
  // Preserve reachability when hiding weaker edges in crowded neighbourhoods.
  const selected=new Set(),parent=words.map((_,i)=>i);
  const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  for(const edge of [...all].sort((a,b)=>b.score-a.score)){
    const a=find(edge.a),b=find(edge.b);if(a!==b){parent[a]=b;selected.add(edge);}
  }
  words.forEach((_,i)=>all.filter(e=>e.a===i||e.b===i).sort((a,b)=>b.score-a.score||a.a-b.a||a.b-b.b).slice(0,5).forEach(e=>selected.add(e)));
  return [...selected];
}
export function boardPath(words, edges) {
  if (words.length < 2) return [];
  const neighbors = words.map(() => []);
  for (const {a, b, score = 0} of edges) {
    neighbors[a].push({index: b, score});
    neighbors[b].push({index: a, score});
  }
  const paths = new Map([[0, {parent: null, steps: 0, strength: 0}]]);
  const queue = [0];
  for (const word of queue) {
    const {steps, strength} = paths.get(word);
    if (word === 1) {
      const path = [];
      for (let index = 1; index !== null; index = paths.get(index).parent) path.unshift(index);
      return path;
    }
    for (const {index, score} of neighbors[word]) {
      const known = paths.get(index);
      const next = {parent: word, steps: steps + 1, strength: strength + score};
      // All candidates at this distance are processed before the next layer.
      if (!known) queue.push(index);
      if (!known || (known.steps === next.steps && known.strength < next.strength)) {
        paths.set(index, next);
      }
    }
  }
  return [];
}

export function averagePathStrength(path, edges) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    total += edges.find(edge => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a)).score;
  }
  return total / (path.length - 1);
}
export function dateKey(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export const PAIRS=[['sonne','buch'],['meer','musik'],['wald','geld'],['eis','liebe'],['hund','computer'],['blume','zug'],['feuer','schule'],['mond','käse'],['berg','brief'],['fisch','könig'],['kaffee','fahrrad'],['brot','stern'],['schlüssel','regen'],['musik','garten'],['papier','meer'],['nacht','fußball'],['gold','vogel'],['schnee','kino'],['apfel','uhr'],['schiff','herz'],['lexikon','brücke'],['traum','salz'],['theater','honig'],['schuh','wolke'],['kleidung','wörterbuch'],['telefon','berg'],['gesundheit','schloss'],['bank','mond']];
export function dailyPair(key) { const day=Math.floor(Date.parse(key+'T00:00:00Z')/86400000);return [...PAIRS[((day%PAIRS.length)+PAIRS.length)%PAIRS.length]]; }
