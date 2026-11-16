export const normalize = word => word.trim().toLocaleLowerCase('de-DE').normalize('NFC');
export class Lexicon {
  constructor(data) {
    this.groups = [...data.synonyms, ...data.associations];
    this.index = new Map(); this.display = new Map(); this.cache = new Map();
    this.groups.forEach((words,id) => words.forEach(word => {
      if (!this.index.has(word)) this.index.set(word, []);
      this.index.get(word).push(id);
    }));
    this.synonymCount = data.synonyms.length;
  }
  has(word) { return this.index.has(normalize(word)); }
  score(a,b) {
    a=normalize(a); b=normalize(b);
    if(a===b) return 1;
    const key=[a,b].sort().join('|');
    if(this.cache.has(key)) return this.cache.get(key);
    const right=new Set(this.index.get(b)||[]);
    let score=0;
    for(const id of this.index.get(a)||[]) if(right.has(id)) score=Math.max(score,id<this.synonymCount ? .86 : .64);
    this.cache.set(key,score); return score;
  }
  neighbors(word) {
    const found=new Set();
    for(const id of this.index.get(word)||[]) for(const w of this.groups[id]) if(w!==word) found.add(w);
    return [...found];
  }
  route(start,end) {
    const queue=[start], parent=new Map([[start,null]]);
    for(let i=0;i<queue.length;i++) {
      const w=queue[i]; if(w===end) { const path=[]; for(let p=end;p!==null;p=parent.get(p))path.unshift(p); return path; }
      for(const next of this.neighbors(w)) if(!parent.has(next)){parent.set(next,w);queue.push(next);}
    }
    return [];
  }
}
export function links(words,lexicon) {
  const all=[];
  for(let i=0;i<words.length;i++) for(let j=i+1;j<words.length;j++) {
    const score=lexicon.score(words[i],words[j]); if(score>=.3995)all.push({a:i,b:j,score});
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
