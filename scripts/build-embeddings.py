"""Build browser vectors from Meta fastText cc.de.300.vec.gz.

Requires numpy and wordfreq==3.1.1. Usage: python scripts/build-embeddings.py /path/to/cc.de.300.vec.gz
The OpenThesaurus-derived word filter remains CC BY-SA 4.0; vector values
are derived from Meta fastText (CC BY-SA 3.0). No hand-authored scores.
"""
import argparse, gzip, hashlib, json, pathlib, re, collections, io, time
import numpy as np
from wordfreq import top_n_list

root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('--limit',type=int,default=600000);p.add_argument('--cache',default=str(root/'.cache/selected-vectors.npz'));p.add_argument('--growing',action='store_true');p.add_argument('--diagnostics');args=p.parse_args()
old=json.loads((root/'data/lexicon.json').read_text())
base_words={w for group in old['synonyms']+old['associations'] for w in group}
allowed=set(base_words)
allowed.update(w for w in top_n_list('de',50000) if re.fullmatch('[a-zäöüß]{3,24}',w))
filter_hash=hashlib.sha256('\n'.join(sorted(allowed)).encode()).hexdigest()
cache=pathlib.Path(args.cache)
cache.parent.mkdir(parents=True,exist_ok=True)
cached=None
if cache.exists():
 with np.load(cache) as d:
  if 'filter_hash' in d and 'limit' in d and str(d['filter_hash'])==filter_hash and int(d['limit'])==args.limit:
   cached=(d['words'].tolist(),d['forms'].tolist(),d['vectors'])
if cached is not None:
 words,forms,raw=cached;print('Reusing extracted vectors:',len(words),flush=True)
else:
 words=[];forms=[];vectors=[];seen=set()
 class GrowingReader:
  def __init__(self,path):self.file=open(path,'rb');self.deadline=time.monotonic()+1800
  def read(self,n=-1):
   while True:
    result=self.file.read(n)
    if result:return result
    if time.monotonic()>self.deadline:raise TimeoutError('Source download did not complete')
    time.sleep(.2)
 source=io.TextIOWrapper(gzip.GzipFile(fileobj=GrowingReader(args.source)),encoding='utf-8') if args.growing else gzip.open(args.source,'rt',encoding='utf-8')
 with source as f:
  assert f.readline().strip()=='2000000 300'
  for rank,line in enumerate(f):
   if rank>=args.limit:break
   form,_,values=line.rstrip().partition(' ');word=form.lower()
   if word in allowed and word not in seen:
    vector=np.fromstring(values,sep=' ',dtype=np.float32)
    if len(vector)==300 and np.isfinite(vector).all():seen.add(word);words.append(word);forms.append(form);vectors.append(vector)
   if rank and rank%100000==0:print('Scanned',rank,'rows;',len(words),'words selected',flush=True)
 raw=np.asarray(vectors,dtype=np.float32);np.savez_compressed(cache,words=words,forms=forms,vectors=raw,filter_hash=filter_hash,limit=args.limit)
 print('Extracted',len(words),'words',flush=True)
# ABTT: fit on first 15,500 accepted words in model frequency order.
reference=raw[:15500].astype(np.float64);mean=reference.mean(axis=0);centered=reference-mean
_,axes=np.linalg.eigh(centered.T@centered);components=axes[:,-3:]
vectors=raw.astype(np.float64)-mean;vectors-= (vectors@components)@components.T
vectors/=np.linalg.norm(vectors,axis=1,keepdims=True)
# Per-vector signed int8 quantization. Runtime divides dot product by norms.
scales=np.abs(vectors).max(axis=1,keepdims=True)/127
quantized=np.rint(vectors/scales).astype(np.int8)
restored=quantized.astype(np.float64);restored/=np.linalg.norm(restored,axis=1,keepdims=True)
errors=np.abs(np.sum(vectors[:-1]*vectors[1:],axis=1)-np.sum(restored[:-1]*restored[1:],axis=1))
print('Adjacent-pair quantization error max:',float(errors.max()),flush=True)
# A small frequent-word routing graph supplies hints; every hop is measured.
# This graph is separate from scoring: any supported pair is scored on demand.
index={w:i for i,w in enumerate(words)}
engine=(root/'engine.js').read_text();pairs=json.loads(re.search(r'export const PAIRS=(\[.*?\]);',engine).group(1).replace("'",'"'))
extra=set(w for pair in pairs for w in pair)
routeids=sorted(set([i for i,w in enumerate(words) if w in base_words and len(w)>=4][:12000])|{index[w] for w in extra})
r=restored[routeids].astype(np.float32)
adj=[]
for start in range(0,len(routeids),256):
 scores=r[start:start+256]@r.T
 for offset,row in enumerate(scores):
  current=start+offset
  candidates=np.flatnonzero(row>=.305);candidates=candidates[candidates!=current]
  adj.append(candidates.tolist())
routeindex={words[k]:i for i,k in enumerate(routeids)};routes={}
for a,b in pairs:
 assert a in index and b in index,(a,b,'missing vector')
 assert restored[index[a]]@restored[index[b]]<.2995,(a,b,'already linked')
 start,end=routeindex[a],routeindex[b];q=collections.deque([start]);parents={start:None}
 while q and end not in parents:
  current=q.popleft()
  for nxt in adj[current]:
   if nxt not in parents:parents[nxt]=current;q.append(nxt)
 assert end in parents,(a,b,'no route')
 path=[];current=end
 while current is not None:path.insert(0,words[routeids[current]]);current=parents[current]
 routes[a+'|'+b]=path;print(' → '.join(path),flush=True)
# Emit manageable shard files; each carries the same 300 source dimensions.
out=root/'data/fasttext';out.mkdir(exist_ok=True)
for file in out.glob('vectors-*.i8'):file.unlink()
shards=[];offset=0
for start in range(0,len(words),4096):
 block=quantized[start:start+4096];name=f'vectors-{len(shards):02d}.i8';blob=block.tobytes();(out/name).write_bytes(blob)
 shards.append({'file':name,'rows':len(block),'sha256':hashlib.sha256(blob).hexdigest()})
manifest={'version':'fasttext-de-abtt3-v1','dimensions':300,'linkThreshold':.2995,'count':len(words),'source':'Meta fastText cc.de.300','sourceUrl':'https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.de.300.vec.gz','sourceRowsScanned':args.limit,'referenceWords':min(15500,len(words)),'removedComponents':3,'quantization':'per-row signed int8; cosine normalized at runtime','maxAdjacentPairError':float(errors.max()),'vectorLicense':'CC BY-SA 3.0','wordListLicense':'CC BY-SA 4.0 (OpenThesaurus), CC BY-SA 4.0 (wordfreq frequency data)','wordfreqVersion':'3.1.1','filterSha256':filter_hash,'shards':shards,'words':words,'routes':routes}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
print('Built',len(words),'vectors in',len(shards),'shards.',flush=True)
if args.diagnostics:
 np.savez_compressed(args.diagnostics,words=words,vectors=vectors,quantized=quantized,mean=mean,components=components)
