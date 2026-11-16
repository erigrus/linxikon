"""Rebuild the German lexicon from the OpenThesaurus export (CC BY-SA 4.0)."""
import json,re,zipfile,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
groups=[]
with zipfile.ZipFile(sys.argv[1]) as z:
 for line in z.read('openthesaurus.txt').decode('utf-8-sig').splitlines():
  if line.startswith('#'):continue
  words=[]
  for term in line.split(';'):
   term=re.sub(r'\([^)]*\)','',term).strip().lower()
   if re.fullmatch('[a-zäöüß]{3,24}',term) and term not in words:words.append(term)
  if len(words)>1:groups.append(words)
 (root/'data/OPENTHESAURUS-LICENSE.txt').write_bytes(z.read('LICENSE.txt'))
themes=[l.lower().split() for l in (root/'data/associations.txt').read_text().splitlines() if l]
(root/'data/lexicon.json').write_text(json.dumps({'synonyms':groups,'associations':themes},ensure_ascii=False,separators=(',',':')))
print(len(groups),'synonym groups;',len(set(w for g in groups+themes for w in g)),'words')
