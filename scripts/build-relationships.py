"""Build German inflection/family links and local context cutoffs.

python scripts/build-relationships.py --lemmas /path/lemmatization-de.txt \
  --families /path/derivcelex-v2.txt --source-forms /path/selected.npz
Requires numpy. Uses existing, shipped, quantized vectors (no retraining).
"""
import argparse, collections, hashlib, json, pathlib, re
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--lemmas',required=True);p.add_argument('--families',required=True);p.add_argument('--source-forms',required=True);args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];out=root/'data/relationships';out.mkdir(exist_ok=True)
model=json.loads((root/'data/fasttext/manifest.json').read_text());words=model['words'];index={w:i for i,w in enumerate(words)}
v=np.concatenate([np.frombuffer((root/'data/fasttext'/s['file']).read_bytes(),dtype=np.int8).reshape(-1,300) for s in model['shards']]).astype(np.float32)
v/=np.linalg.norm(v,axis=1,keepdims=True)
valid=lambda w:bool(re.fullmatch('[a-zäöüß]{3,24}',w))
with np.load(args.source_forms) as source:
 assert source['words'].tolist()==words, 'Source spelling order must match shipped vectors'
 spellings=source['forms'].tolist()
# Only dictionary-attested inflections; vector agreement guards homographs such
# as Buche -> Buch. No substring or prefix stripping is used.
candidates=collections.defaultdict(set)
for line in pathlib.Path(args.lemmas).read_text(encoding='utf-8-sig').splitlines():
 fields=line.strip().split('\t')
 if len(fields)!=2:continue
 lemma_original,form_original=fields
 lemma,form=lemma_original.lower(),form_original.lower()
 if form in index and form_original==spellings[index[form]] and lemma_original[0].isupper()==form_original[0].isupper() and lemma!=form and valid(lemma):candidates[form].add(lemma)
canonical={w:w for w in words}
for word,lemmas in candidates.items():
 i=index[word];ranked=[]
 for lemma in lemmas:
  if lemma in index:
   score=float(v[i]@v[index[lemma]])
   if score>=.35:ranked.append((score,lemma))
  elif len(lemmas)==1:ranked.append((.35,lemma))
 if ranked:canonical[word]=max(ranked)[1]
def resolve(word):
 seen=set()
 while word in canonical and canonical[word]!=word:
  if word in seen:return min(seen,key=lambda w:index.get(w,len(words)))
  seen.add(word);word=canonical[word]
 return word
canonical={w:resolve(w) for w in words}
groups=collections.defaultdict(list)
for word in words:groups[canonical[word]].append(index[word])
# Require corroboration between members even when the lemma has no vector.
formgroups=[]
for lemma,members in groups.items():
 anchor=index.get(lemma,members[0]);members=[i for i in members if i==anchor or float(v[i]@v[anchor])>=.35]
 if len(members)>1 or lemma not in index:
  formgroups.append([lemma,*members])
# Any excluded/ambiguous inflection keeps its own identity.
canonical={w:w for w in words}
for lemma,*members in formgroups:
 for i in members:canonical[words[i]]=lemma
known=set(canonical.values())|set(words)
familygroups=[]
for line in pathlib.Path(args.families).read_text().splitlines():
 terms=[]
 for token in line.split()[1:]:
  lemma=token.rsplit('_',1)[0].lower();lemma=canonical.get(lemma,lemma)
  if lemma in known and lemma not in terms:terms.append(lemma)
 if len(terms)>1:familygroups.append(terms)
old=json.loads((root/'data/lexicon.json').read_text());syngroups=[]
for group in old['synonyms']:
 group=list(dict.fromkeys(canonical.get(w,w) for w in group if w in known))
 if len(group)>1:syngroups.append(group)
# A frequent, de-inflected reference vocabulary prevents inflection-rich words
# from receiving a different notion of closeness merely due to neighbour count.
base={w for g in old['synonyms']+old['associations'] for w in g}
reference=[];seen=set()
for i,w in enumerate(words):
 lemma=canonical[w]
 if lemma in seen or (w not in base and lemma not in base):continue
 seen.add(lemma);reference.append(index.get(lemma,i))
 if len(reference)==12000:break
ref=v[reference];cutoffs=[]
for start in range(0,len(words),256):
 scores=v[start:start+256]@ref.T
 local=np.partition(scores,-120,axis=1)[:,-120]
 cutoffs.extend(float(x) for x in np.clip(local,.22,.30))
 if start%10240==0:print('Calibrated',start,'/',len(words),flush=True)
files={
 'forms.json':{'groups':formgroups,'license':'ODbL-1.0','source':'michmech/lemmatization-lists, German'},
 'families.json':{'groups':familygroups,'license':'CC-BY-SA-3.0','source':'DErivCELEX v2, IMS Stuttgart'},
 'synonyms.json':{'groups':syngroups,'license':'CC-BY-SA-4.0','source':'OpenThesaurus, filtered export 2026-11-15'},
 'calibration.json':{'cutoffs':[round(x,6) for x in cutoffs],'referenceCount':len(reference),'neighbour':120,'minimum':.22,'maximum':.30,'license':'CC-BY-SA-3.0','source':'Derived from Meta fastText cc.de.300'}
}
entries=[]
for name,data in files.items():
 blob=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode();(out/name).write_bytes(blob)
 entries.append({'file':name,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()})
manifest={'version':'de-relations-v2','modelVersion':model['version'],'count':len(words),'vocabularySha256':hashlib.sha256(json.dumps(words,ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),'files':entries,'provenance':{'lemmasSha256':hashlib.sha256(pathlib.Path(args.lemmas).read_bytes()).hexdigest(),'familiesSha256':hashlib.sha256(pathlib.Path(args.families).read_bytes()).hexdigest(),'sourceFormsSha256':hashlib.sha256(pathlib.Path(args.source_forms).read_bytes()).hexdigest()}}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
print('Built:',len(formgroups),'form groups;',len(familygroups),'families;',len(syngroups),'synonym groups;',len(cutoffs),'local cutoffs.',flush=True)
for w in ['vitamin','vitamine','überarbeitet','überarbeiten','arbeit','buche','buch']:print(w,'->',canonical.get(w),flush=True)
