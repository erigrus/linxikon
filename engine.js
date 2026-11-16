export const normalize = word => word.trim().toLocaleLowerCase('de-DE').normalize('NFC');
export const MODEL_VERSION = 'fasttext-de-abtt3-v1';
export const LINK_THRESHOLD = .2995;
const percent = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1});
export const formatScore = score => score === null ? '–' : percent.format(score * 100) + ' %';
export class Lexicon {
  constructor(manifest, vectors) {
    if (manifest.version !== MODEL_VERSION || manifest.dimensions !== 300 ||
        manifest.count !== manifest.words.length || !(vectors instanceof Int8Array) ||
        vectors.length !== manifest.count * manifest.dimensions) {
      throw new Error('Ungültige oder unvollständige Wortvektoren');
    }
    this.words = manifest.words;
    this.dimensions = manifest.dimensions;
    this.index = new Map(this.words.map((word, i) => [word, i]));
    if (this.index.size !== manifest.count) throw new Error('Doppelte Wörter im Modell');
    this.vectors = vectors;
    this.norms = new Float64Array(manifest.count);
    this.routes = manifest.routes;
    this.cache = new Map();
    for (let row = 0; row < manifest.count; row++) {
      let sum = 0, offset = row * this.dimensions;
      for (let k = 0; k < this.dimensions; k++) sum += vectors[offset+k] ** 2;
      if (!sum) throw new Error('Leerer Wortvektor');
      this.norms[row] = Math.sqrt(sum);
    }
  }
  has(word) { return this.index.has(normalize(word)); }
  score(a, b) {
    const i = this.index.get(normalize(a)), j = this.index.get(normalize(b));
    if (i === undefined || j === undefined) return null;
    if (i === j) return 1;
    const key = i < j ? i + ':' + j : j + ':' + i;
    if (this.cache.has(key)) return this.cache.get(key);
    let dot = 0, x = i * this.dimensions, y = j * this.dimensions;
    for (let k = 0; k < this.dimensions; k++) dot += this.vectors[x+k] * this.vectors[y+k];
    const score = Math.max(-1, Math.min(1, dot / (this.norms[i] * this.norms[j])));
    if (this.cache.size >= 8192) this.cache.clear();
    this.cache.set(key, score);
    return score;
  }
  route(start, end) {
    start = normalize(start); end = normalize(end);
    const path = this.routes[start + '|' + end];
    if (path) return [...path];
    const reverse = this.routes[end + '|' + start];
    if (reverse) return [...reverse].reverse();
    const score = this.score(start, end);
    return score !== null && score >= LINK_THRESHOLD ? [start, end] : [];
  }
}

// Load versioned shards with bounded concurrency. A failed shard never starts a game.
export async function loadLexicon(onProgress = () => {}, fetcher = fetch) {
  const response = await fetcher('./data/fasttext/manifest.json', {cache: 'no-cache'});
  if (!response.ok) throw new Error('Wortmodell nicht erreichbar');
  const manifest = await response.json();
  if (manifest.version !== MODEL_VERSION || manifest.dimensions !== 300 ||
      !Number.isSafeInteger(manifest.count) || manifest.count < 1 || manifest.count > 200000 ||
      !Array.isArray(manifest.shards) || manifest.shards.length > 100 ||
      manifest.shards.some(s => !/^vectors-\d{2}\.i8$/.test(s.file) || !Number.isSafeInteger(s.rows) || s.rows < 1) ||
      manifest.shards.reduce((n, s) => n + s.rows, 0) !== manifest.count) {
    throw new Error('Unbekannte Modellversion');
  }
  const vectors = new Int8Array(manifest.count * manifest.dimensions);
  const offsets = []; let cursor = 0;
  manifest.shards.forEach(shard => { offsets.push(cursor); cursor += shard.rows * manifest.dimensions; });
  let next = 0, loaded = 0;
  onProgress(0, vectors.byteLength);
  async function worker() {
    while (next < manifest.shards.length) {
      const i = next++, shard = manifest.shards[i];
      const result = await fetcher('./data/fasttext/' + shard.file + '?sha=' + shard.sha256);
      if (!result.ok) throw new Error('Wortvektoren konnten nicht geladen werden');
      const bytes = await result.arrayBuffer();
      if (bytes.byteLength !== shard.rows * manifest.dimensions) throw new Error('Unvollständige Wortvektoren');
      if (globalThis.crypto?.subtle) {
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        const actual = [...hash].map(n => n.toString(16).padStart(2, '0')).join('');
        if (actual !== shard.sha256) throw new Error('Prüfsumme der Wortvektoren stimmt nicht');
      }
      vectors.set(new Int8Array(bytes), offsets[i]);
      loaded += bytes.byteLength; onProgress(loaded, vectors.byteLength);
    }
  }
  await Promise.all(Array.from({length: Math.min(4, manifest.shards.length)}, worker));
  return new Lexicon(manifest, vectors);
}
export function links(words,lexicon) {
  const all=[];
  for(let i=0;i<words.length;i++) for(let j=i+1;j<words.length;j++) {
    const score=lexicon.score(words[i],words[j]); if(score>=LINK_THRESHOLD)all.push({a:i,b:j,score});
  }
  const selected=new Set();
  words.forEach((_,i)=>all.filter(e=>e.a===i||e.b===i).sort((a,b)=>b.score-a.score||a.a-b.a||a.b-b.b).slice(0,5).forEach(e=>selected.add(e)));
  return [...selected];
}
export function boardPath(words,edges) {
  const parent=new Map([[0,null]]),q=[0];
  for(let i=0;i<q.length;i++){
    const w=q[i]; if(w===1){const path=[];for(let p=1;p!==null;p=parent.get(p))path.unshift(p);return path;}
    for(const e of edges){const n=e.a===w?e.b:e.b===w?e.a:null;if(n!==null&&!parent.has(n)){parent.set(n,w);q.push(n);}}
  }
  return [];
}
export function dateKey(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export const PAIRS=[['sonne','buch'],['meer','musik'],['wald','geld'],['eis','liebe'],['hund','computer'],['blume','zug'],['feuer','schule'],['mond','käse'],['berg','brief'],['fisch','könig'],['kaffee','fahrrad'],['brot','stern'],['schlüssel','regen'],['musik','garten'],['papier','meer'],['nacht','fußball'],['gold','vogel'],['schnee','kino'],['apfel','uhr'],['schiff','herz'],['lexikon','brücke'],['traum','salz'],['theater','honig'],['schuh','wolke'],['kleidung','wörterbuch'],['telefon','berg'],['gesundheit','schloss'],['bank','mond']];
export function dailyPair(key) { const day=Math.floor(Date.parse(key+'T00:00:00Z')/86400000);return [...PAIRS[((day%PAIRS.length)+PAIRS.length)%PAIRS.length]]; }
