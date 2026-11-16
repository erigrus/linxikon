import {loadLexicon, MODEL_VERSION, formatScore, normalize, links, boardPath, dateKey, dailyPair, PAIRS} from './engine.js?v=2';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
let lexicon, state, mode='daily', selected=null, positions=[], edges=[], winning=[], saveAvailable=true;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{saveAvailable=false;}}
const preferences=read('linxikon:settings',{});
document.body.classList.toggle('dark',!!preferences.dark);
const today=dateKey();let activeDate=today;
function feedback(text,error=false){$('feedback').textContent=text;$('feedback').classList.toggle('error',error);}
function svg(tag,attrs={},text){const node=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;}
function title(word){return word.charAt(0).toLocaleUpperCase('de-DE')+word.slice(1);}
const gamePrefix='linxikon:'+MODEL_VERSION+':';
function save(){write(gamePrefix+ (mode==='daily'?activeDate:'practice'),state);}
function fresh(pair){return {words:[...pair],finished:false,won:false,hints:0,recorded:false};}
function validState(value,pair){return value&&Array.isArray(value.words)&&value.words.length>=2&&value.words.length<=50&&value.words.every(w=>typeof w==='string'&&lexicon.has(w))&&new Set(value.words).size===value.words.length&&(!pair||(value.words[0]===pair[0]&&value.words[1]===pair[1]));}
function start(nextMode,newGame=false){
 mode=nextMode;selected=null;
 const pair=mode==='daily'?dailyPair(activeDate):PAIRS[Math.floor(Math.random()*PAIRS.length)];
 const previous=read(gamePrefix+(mode==='daily'?activeDate:'practice'),null);
 state=!newGame&&validState(previous,mode==='daily'?pair:null)?previous:fresh(pair);
 positions=[];edges=links(state.words,lexicon);winning=boardPath(state.words,edges);
 state.won=winning.length>0;state.finished=state.won||state.words.length>=50;
 $('daily').classList.toggle('active',mode==='daily');$('practice').classList.toggle('active',mode==='practice');
 $('puzzle-label').textContent=mode==='daily'?'TAGESRÄTSEL':'ÜBUNGSMODUS';
 $('puzzle-date').textContent=mode==='daily'?new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'long',year:'numeric'}).format(new Date(activeDate+'T12:00:00')):'Platz für neue Gedanken';
 $('start-word').textContent=title(state.words[0]);$('end-word').textContent=title(state.words[1]);
 $('new-practice').hidden=mode!=='practice';$('result').hidden=true;
 feedback('3–24 Buchstaben · Umlaute sind willkommen');render();save();
}
function layout(){
 const n=state.words.length;
 positions=state.words.map((_,i)=>positions[i]|| (i===0?{x:155,y:115}:i===1?{x:645,y:340}:{x:130+((i*157)%540),y:95+((i*97)%280)}));
 // Stable force layout: starting words remain anchored, other words spread around their links.
 for(let iteration=0;iteration<160;iteration++){
  const force=positions.map(()=>({x:0,y:0}));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   let dx=positions[i].x-positions[j].x,dy=positions[i].y-positions[j].y;const d=Math.max(1,Math.hypot(dx,dy));
   if(d<1.1){dx=1;dy=1;}const f=9000/(d*d);force[i].x+=dx/d*f;force[i].y+=dy/d*f;force[j].x-=dx/d*f;force[j].y-=dy/d*f;
  }
  for(const e of edges){const a=positions[e.a],b=positions[e.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-155)*.025;force[e.a].x+=dx/d*f;force[e.a].y+=dy/d*f;force[e.b].x-=dx/d*f;force[e.b].y-=dy/d*f;}
  for(let i=2;i<n;i++){positions[i].x=Math.max(95,Math.min(705,positions[i].x+Math.max(-6,Math.min(6,force[i].x))));positions[i].y=Math.max(55,Math.min(395,positions[i].y+Math.max(-6,Math.min(6,force[i].y))));}
 }
}
function draw(){
 const graph=$('graph');graph.replaceChildren();
 if(state.words.length===2&&!edges.length){graph.append(svg('path',{d:'M 220 115 C 440 115 340 340 580 340',fill:'none',class:'empty-line'}),svg('text',{x:400,y:235,'text-anchor':'middle',class:'question-mark'},'?'));}
 const winningPairs=new Set(winning.slice(1).map((id,i)=>[winning[i],id].sort((a,b)=>a-b).join('-')));
 for(const e of edges){const a=positions[e.a],b=positions[e.b];const isWin=winningPairs.has([e.a,e.b].sort((a,b)=>a-b).join('-'));graph.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'edge'+(isWin?' winning':'')}));if(selected===e.a||selected===e.b||isWin)graph.append(svg('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-7,'text-anchor':'middle',class:'edge-label'},formatScore(e.score)));}
 state.words.forEach((word,i)=>{
  const {x,y}=positions[i],width=Math.max(92,word.length*9+30),g=svg('g',{class:'node'+(i===0?' start':i===1?' end':'')+(selected===i?' selected':'')+(winning.includes(i)?' solved':''),transform:`translate(${x},${y})`,tabindex:'0',role:'button','aria-label':title(word)+', Beziehungen anzeigen'});
  g.append(svg('rect',{x:-width/2,y:-24,width,height:48,rx:10}),svg('text',{'text-anchor':'middle','dominant-baseline':'central'},title(word)));
  g.addEventListener('click',()=>select(i));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i);}});
  let pointerStart=null,moved=false;
  g.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};moved=false;g.setPointerCapture(e.pointerId);});
  g.addEventListener('pointermove',e=>{if(!pointerStart)return;if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>4)moved=true;if(!moved)return;const matrix=graph.getScreenCTM();if(!matrix)return;const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());positions[i]={x:Math.max(90,Math.min(710,pt.x)),y:Math.max(45,Math.min(400,pt.y))};g.setAttribute('transform',`translate(${positions[i].x},${positions[i].y})`);});
  g.addEventListener('pointerup',()=>{pointerStart=null;if(moved)draw();});g.addEventListener('pointercancel',()=>{pointerStart=null;draw();});graph.append(g);
 });
}
function select(index){selected=index;draw();$('selection-title').textContent=title(state.words[index]);
 const related=state.words.map((w,i)=>({word:w,id:i,score:lexicon.score(w,state.words[index])})).filter(x=>x.id!==index).sort((a,b)=>b.score-a.score);
 const ul=document.createElement('ul');ul.className='score-list';
 for(const item of related){const li=document.createElement('li'),label=document.createElement('span'),score=document.createElement('b');label.textContent=title(item.word);score.textContent=formatScore(item.score);li.append(label,score);ul.append(li);}
 $('selection-body').replaceChildren(ul);
}
function record(){
 if(state.recorded||!state.finished)return;
 const stats=read(gamePrefix+'stats',{games:0,wins:0,best:null,daily:[]});stats.games++;if(state.won){stats.wins++;const n=winning.length-2;stats.best=stats.best===null?n:Math.min(stats.best,n);if(mode==='daily'&&!stats.daily.includes(activeDate))stats.daily.push(activeDate);}write(gamePrefix+'stats',stats);state.recorded=true;
}
function render(){
 edges=links(state.words,lexicon);winning=boardPath(state.words,edges);state.won=winning.length>0;state.finished=state.won||state.words.length>=50;
 layout();draw();$('word-count').textContent=state.words.length+' / 50';$('progress').style.width=(state.words.length*2)+'%';$('added-count').textContent=(state.words.length-2)+' Wörter ergänzt';
 $('word').disabled=state.finished;$('add').disabled=state.finished;$('clue').hidden=mode!=='daily'||state.words.length<25||state.finished;
 $('board-caption').hidden=state.words.length>2;$('board-status').lastChild.textContent=state.won?' VERBINDUNG GEFUNDEN':' DEIN WORTNETZ';
 if(state.finished){record();showResult();}else $('result').hidden=true;
 save();
}
function showResult(){const result=$('result');result.replaceChildren();result.hidden=false;
 const h=document.createElement('h3');h.textContent=state.won?'Verbunden. Gut gedacht!':'50 Wörter – ein Netz voller Ideen.';
 const p=document.createElement('p');p.textContent=state.won?`${winning.length-2} Zwischenwörter auf deinem kürzesten Weg · ${state.words.length-2} Wörter ausprobiert. ${state.hints?'Mit Hinweis.':'Ohne Hinweis.'}`:'Die beiden Seiten sind noch getrennt. Entdecke eine mögliche Kette oder versuche ein Übungsrätsel.';
 const button=document.createElement('button');button.className='primary';button.textContent=state.won?'Ergebnis teilen ↗':'Mögliche Verbindung ansehen';button.onclick=state.won?share:()=>feedback(lexicon.route(state.words[0],state.words[1]).map(title).join(' → '));result.append(h,p,button);
}
async function share(){const route=winning.map(i=>title(state.words[i])).join(' → ');const text=`Linxikon · ${mode==='daily'?activeDate:'Übung'}\n🔵 ${title(state.words[0])} ↔ ${title(state.words[1])} 🔴\n${winning.length-2} Zwischenwörter | ${state.words.length-2} Versuche${state.hints?' | mit Hinweis':''}\n${preferences.sharePath?route+'\n':''}${new URL('./',location.href).href}`;
 try{if(navigator.share&&navigator.canShare?.({text}))await navigator.share({text});else{await navigator.clipboard.writeText(text);feedback('Dein Ergebnis wurde kopiert.');}}catch(e){if(e.name==='AbortError')return;openModal('<h2>Dein Ergebnis</h2><p>Kopiere diesen Text zum Teilen:</p><textarea id="share-text" rows="6" style="width:100%;padding:12px"></textarea>');$('share-text').value=text;$('share-text').select();}}
$('word-form').addEventListener('submit',e=>{e.preventDefault();if(!lexicon||state.finished)return;const w=normalize($('word').value);
 if(!/^[a-zäöüß]{3,24}$/.test(w)){feedback('Bitte ein deutsches Wort mit 3–24 Buchstaben eingeben.',true);return;}
 if(state.words.includes(w)){feedback('Dieses Wort ist schon auf dem Brett.',true);return;}
 if(!lexicon.has(w)){feedback('Dieses Wort ist noch nicht verfügbar. Versuche ein anderes Wort oder seine Grundform.',true);return;}
 state.words.push(w);$('word').value='';selected=state.words.length-1;render();select(selected);
 const connected=edges.some(e=>e.a===selected||e.b===selected);feedback(state.won?'Du hast die beiden Seiten verbunden!':connected?'Eine neue Verbindung! Folge dem nächsten Gedanken.':'Noch keine Verbindung. Das Wort bleibt auf dem Brett – baue weiter.');
 if(!state.finished)$('word').focus();
});
function openModal(html){$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
$('close-modal').onclick=()=>$('modal').close();$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
$('daily').onclick=()=>{if(lexicon){activeDate=today;start('daily');}};$('practice').onclick=()=>lexicon&&start('practice');$('new-practice').onclick=()=>start('practice',true);
$('arrange').onclick=()=>{if(state){positions=[];layout();draw();}};
$('help').onclick=()=>openModal(`<h2>Wörter verbinden. Gedanken folgen.</h2><p>Dein Ziel: Verbinde das blaue und das rote Wort durch eine Kette verwandter Bedeutungen.</p><div class="example-chain"><b>Startwort</b> → verwandtes Wort → … → <b>Zielwort</b></div><ol><li>Gib ein deutsches Wort ein. Es wird mit allen Wörtern auf dem Brett verglichen.</li><li>Ab 30 % entsteht eine Verbindung. Je Wort bleiben die fünf stärksten Verbindungen erhalten; eine davon genügt, damit die Kante sichtbar bleibt.</li><li>Sobald ein Weg von Blau nach Rot führt, hast du gewonnen. Nutze möglichst wenige Wörter!</li></ol><p>Du hast Platz für 50 Wörter. Im Tagesrätsel gibt es ab 25 Wörtern einen Hinweis. Im Übungsmodus warten unbegrenzt neue Rätsel.</p><p>Die Nähe wird aus deutschen fastText-Wortvektoren berechnet. Wörter, die in ähnlichen Zusammenhängen vorkommen, liegen näher beieinander – auch Gegenteile können deshalb verbunden sein. Die Prozentzahl beschreibt die berechnete Nähe, keine Wahrscheinlichkeit. Seltene Wörter können fehlen.</p><button class="primary" id="understood">Los geht’s ↗</button>`);
$('modal').addEventListener('click',e=>{if(e.target.id==='understood'){$('modal').close();write('linxikon:seenHelp',true);}});
$('stats').onclick=()=>{const s=read(gamePrefix+'stats',{games:0,wins:0,best:null,daily:[]});openModal(`<h2>Deine Verbindungen</h2><div class="stat-grid"><div><strong>${Number(s.games)||0}</strong><span>Abgeschlossene Spiele</span></div><div><strong>${s.games?Math.round(s.wins/s.games*100):0}%</strong><span>Gewonnen</span></div><div><strong>${s.best??'–'}</strong><span>Wenigste Zwischenwörter</span></div></div><p>${s.daily.length} Tagesrätsel gelöst. Die Statistik und dein Fortschritt werden nur in diesem Browser gespeichert${saveAvailable?'.':' – der Browserspeicher ist derzeit nicht verfügbar.'}</p>`);};
$('settings').onclick=()=>{openModal(`<h2>Dein Spiel, dein Stil.</h2><label class="setting-row">Dunkler Modus<input id="dark-setting" type="checkbox" ${preferences.dark?'checked':''}></label><label class="setting-row">Lösungsweg beim Teilen zeigen<input id="share-setting" type="checkbox" ${preferences.sharePath?'checked':''}></label><p>Deine Einstellungen gelten nur für diesen Browser.</p><label class="setting-row">Vergangenes Tagesrätsel<input id="archive-date" type="date" min="2026-01-01" max="${today}" value="${activeDate}"></label><button class="text-button" id="archive-open">Rätsel öffnen ↗</button>`);
 $('dark-setting').onchange=e=>{preferences.dark=e.target.checked;document.body.classList.toggle('dark',preferences.dark);write('linxikon:settings',preferences);};$('share-setting').onchange=e=>{preferences.sharePath=e.target.checked;write('linxikon:settings',preferences);};$('archive-open').onclick=()=>{const value=$('archive-date').value;if(value&&value>='2026-01-01'&&value<=today){activeDate=value;start('daily');$('modal').close();}};
};
$('privacy').onclick=()=>openModal('<h2>Datenschutz</h2><p>Linxikon benötigt kein Konto und setzt keine Analyse- oder Werbe-Cookies. Fortschritt, Statistik und Einstellungen liegen im lokalen Speicher deines Browsers. Du kannst sie über die Website-Daten deines Browsers löschen.</p><p>Die Seite wird von GitHub Pages bereitgestellt. Beim Aufruf verarbeitet GitHub technische Verbindungsdaten, darunter deine IP-Adresse. Die Schriftarten werden von Google Fonts geladen; dabei wird ebenfalls eine Verbindung zu Google hergestellt.</p><p>Beim Teilen wird erst auf deinen Klick die Teilen- oder Zwischenablagefunktion deines Geräts geöffnet. Es gibt keine Bestenliste oder Übermittlung deiner eingegebenen Wörter an einen Spielserver.</p><p><a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub-Datenschutzerklärung ↗</a></p>');
$('about').onclick=()=>openModal('<h2>Mit Worten Brücken bauen.</h2><p>Linxikon ist eine eigenständige deutsche Umsetzung der Spielidee von <a href="https://linxicon.com" target="_blank" rel="noopener">Linxicon von Trainwreck Labs</a>. Dieses Projekt ist nicht mit dem Original verbunden.</p><p>Bedeutungsmodell: <a href="https://fasttext.cc/docs/en/crawl-vectors.html" target="_blank" rel="noopener">Meta fastText cc.de.300</a>, trainiert auf Common Crawl und Wikipedia. Das ist dieselbe öffentliche Modellbasis, die <a href="https://kontexto.de/blog/wie-funktioniert-fasttext/" target="_blank" rel="noopener">Kontexto</a> nennt. Linxikon verwendet eine eigene Wortauswahl und Aufbereitung; die Werte sind nicht identisch mit Kontextos Rängen. Die Vektoren werden zentriert, um drei Hauptkomponenten bereinigt und für den Browser komprimiert. Vektordaten: <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.de" target="_blank" rel="noopener">CC BY-SA 3.0</a>, © Meta / fastText-Autoren. Wortlistenfilter: wordfreq (© Robyn Speer und Mitwirkende, CC BY-SA 4.0) und <a href="https://www.openthesaurus.de" target="_blank" rel="noopener">OpenThesaurus</a>, © Daniel Naber und Mitwirkende, CC BY-SA 4.0. Es werden keine festen Synonym- oder Themenpunktzahlen vergeben.</p><p>Das tägliche Wortpaar rotiert durch einen festen Rätselkatalog. Der Wechsel erfolgt um Mitternacht in deiner lokalen Zeitzone. Die Übung wählt zufällig ein Paar aus diesem Katalog.</p><p><a href="https://github.com/erigrus/linxikon" target="_blank" rel="noopener">Quellcode & technische Dokumentation ↗</a></p>');
$('clue').onclick=()=>{const route=lexicon.route(state.words[0],state.words[1]),next=route.slice(1,-1).find(w=>!state.words.includes(w));if(next){state.hints++;save();feedback('Ein Wort auf einem möglichen Weg: '+title(next));$('word').value=next;$('word').focus();}else feedback('Alle Wörter eines möglichen Wegs sind vorhanden. Prüfe die Verbindungen.');};
function tick(){const now=new Date(),midnight=new Date(now);midnight.setHours(24,0,0,0);const minutes=Math.ceil((midnight-now)/60000);$('next-puzzle').textContent=`Nächstes Tagesrätsel in ${Math.floor(minutes/60)} h ${minutes%60} min`;}
tick();setInterval(tick,30000);
async function init(){try{lexicon=await loadLexicon((loaded,total)=>feedback('Bedeutungskarte laden … '+Math.round(loaded/total*100)+' %'));start('daily');if(read('linxikon:'+today,null))feedback('Neue Wortbewertung: Deine Runde startet neu. Frühere Spielstände bleiben gespeichert.');if(!read('linxikon:seenHelp',false)){write('linxikon:seenHelp',true);$('help').click();}}catch(error){feedback('Bedeutungskarte konnte nicht geladen werden. Bitte lade die Seite neu.',true);console.error(error);}}
init();
