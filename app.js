import {loadLexicon, MODEL_VERSION, LINK_THRESHOLD, MAX_PUZZLE_POINTS, puzzlePoints, averagePathStrength, formatPuzzlePoints, formatScore, normalize, links, boardPath, dateKey, dailyPair, PAIRS} from './engine.js?v=8';
import {WordGraph} from './word-graph.js?v=4';
import {STORAGE_PREFIX,migrateStorage,readStorage,writeStorage} from './storage.js?v=5';
const $=id=>document.getElementById(id);
let lexicon, state, mode='daily', selected=null, edges=[], winning=[], saveAvailable=true;
migrateStorage();
const read=readStorage;
function write(key,value){if(!writeStorage(key,value))saveAvailable=false;}
const preferences=read('semantio:settings',{});
document.body.classList.toggle('dark',!!preferences.dark);
const today=dateKey();let activeDate=today;
function feedback(text,error=false){$('feedback').textContent=text;$('feedback').classList.toggle('error',error);}

function title(word){return word.charAt(0).toLocaleUpperCase('de-DE')+word.slice(1);}
const gamePrefix=STORAGE_PREFIX+MODEL_VERSION+':';
function save(){write(gamePrefix+ (mode==='daily'?activeDate:'practice'),state);}
function fresh(pair){return {words:[...pair],finished:false,won:false,hints:0,recorded:false};}
function validState(value,pair){return value&&Array.isArray(value.words)&&value.words.length>=2&&value.words.length<=50&&value.words.every(w=>typeof w==='string'&&lexicon.has(w))&&new Set(value.words).size===value.words.length&&(!pair||(value.words[0]===pair[0]&&value.words[1]===pair[1]));}
function start(nextMode,newGame=false){
 mode=nextMode;selected=null;
 const pair=mode==='daily'?dailyPair(activeDate):PAIRS[Math.floor(Math.random()*PAIRS.length)];
 const previous=read(gamePrefix+(mode==='daily'?activeDate:'practice'),null);
 state=!newGame&&validState(previous,mode==='daily'?pair:null)?previous:fresh(pair);
 wordGraph.reset();edges=links(state.words,lexicon);winning=boardPath(state.words,edges);
 state.won=winning.length>0;state.finished=state.won||state.words.length>=50;
 $('daily').classList.toggle('active',mode==='daily');$('practice').classList.toggle('active',mode==='practice');
 $('puzzle-label').textContent=mode==='daily'?'TAGESRÄTSEL':'ÜBUNGSMODUS';
 $('puzzle-date').textContent=mode==='daily'?new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'long',year:'numeric'}).format(new Date(activeDate+'T12:00:00')):'Platz für neue Gedanken';
 $('start-word').textContent=title(state.words[0]);$('end-word').textContent=title(state.words[1]);
 $('new-practice').hidden=mode!=='practice';$('result').hidden=true;
 feedback('3–24 Buchstaben · Umlaute sind willkommen');render();save();
}
const wordGraph=new WordGraph($('graph'),{onSelect:select,formatScore});
function select(index){selected=index;wordGraph.select(index);$('selection-title').textContent=title(state.words[index]);
 const related=state.words.map((w,i)=>({word:w,id:i,...lexicon.relation(w,state.words[index])})).filter(x=>x.id!==index).sort((a,b)=>b.score-a.score);
 const ul=document.createElement('ul');ul.className='score-list';
 for(const item of related){const li=document.createElement('li'),label=document.createElement('span'),score=document.createElement('b');label.textContent=title(item.word);const reason=document.createElement('small');reason.className='relation-reason';reason.textContent=item.label;label.append(reason);score.textContent=formatScore(item.score);li.classList.toggle('is-linked',item.score>=LINK_THRESHOLD);li.append(label,score);ul.append(li);}
 $('selection-body').replaceChildren(ul);
}
function record(){
 if(state.recorded||!state.finished)return;
 const stats=read(gamePrefix+'stats',{games:0,wins:0,best:null,daily:[]});stats.games++;if(state.won){stats.wins++;const n=winning.length-2;stats.best=stats.best===null?n:Math.min(stats.best,n);if(mode==='daily'&&!stats.daily.includes(activeDate))stats.daily.push(activeDate);}write(gamePrefix+'stats',stats);state.recorded=true;
}
function render(){
 edges=links(state.words,lexicon);winning=boardPath(state.words,edges);state.won=winning.length>0;state.finished=state.won||state.words.length>=50;
 wordGraph.update({words:state.words,edges,winning,selected});$('word-count').textContent=state.words.length+' / 50';$('progress').style.width=(state.words.length*2)+'%';$('added-count').textContent=(state.words.length-2)+' Wörter ergänzt';
 $('word').disabled=state.finished;$('add').disabled=state.finished;$('clue').hidden=mode!=='daily'||state.words.length<25||state.finished;
 $('board-caption').hidden=state.words.length>2;$('board-status').lastChild.textContent=state.won?' VERBINDUNG GEFUNDEN':' DEIN WORTNETZ';
 if(state.finished){record();showResult();}else $('result').hidden=true;
 save();
}
function solutionResult() {
 const intermediateWords = winning.length - 2;
 const attempts = state.words.length - 2;
 const strength = averagePathStrength(winning, edges);
 return {
  points: puzzlePoints(intermediateWords, attempts, strength),
  summary: `${intermediateWords} ${intermediateWords === 1 ? 'Zwischenwort' : 'Zwischenwörter'} im kürzesten Weg · ${attempts} ${attempts === 1 ? 'Versuch' : 'Versuche'} · Ø ${formatScore(strength)} Verbindungsstärke`,
 };
}

function showResult() {
 const result = $('result');
 const heading = document.createElement('h3');
 const detail = document.createElement('p');
 const button = document.createElement('button');
 button.className = 'primary';

 if (state.won) {
  const {points, summary} = solutionResult();
  heading.textContent = 'Verbunden. Gut gedacht!';
  const score = document.createElement('p');
  score.className = 'puzzle-points';
  score.textContent = `${formatPuzzlePoints(points)} von ${MAX_PUZZLE_POINTS} Punkten`;
  detail.textContent = `${summary}. ${state.hints ? 'Mit Hinweis.' : 'Ohne Hinweis.'}`;
  button.textContent = 'Ergebnis teilen ↗';
  button.onclick = share;
  result.replaceChildren(heading, score, detail, button);
 } else {
  heading.textContent = '50 Wörter – ein Netz voller Ideen.';
  detail.textContent = 'Die beiden Seiten sind noch getrennt. Entdecke eine mögliche Kette oder versuche ein Übungsrätsel.';
  button.textContent = 'Mögliche Verbindung ansehen';
  button.onclick = () => feedback(lexicon.route(state.words[0], state.words[1]).map(title).join(' → '));
  result.replaceChildren(heading, detail, button);
 }
 result.hidden = false;
}

async function share() {
 const route = winning.map(i => title(state.words[i])).join(' → ');
 const {points, summary} = solutionResult();
 const text = [
  `Semantio · ${mode === 'daily' ? activeDate : 'Übung'}`,
  `🔵 ${title(state.words[0])} ↔ ${title(state.words[1])} 🔴`,
  `${formatPuzzlePoints(points)}/${MAX_PUZZLE_POINTS} Punkte · ${summary}${state.hints ? ' · mit Hinweis' : ''}`,
  ...(preferences.sharePath ? [route] : []),
  new URL('./', location.href).href,
 ].join('\n');
 try{if(navigator.share&&navigator.canShare?.({text}))await navigator.share({text});else{await navigator.clipboard.writeText(text);feedback('Dein Ergebnis wurde kopiert.');}}catch(e){if(e.name==='AbortError')return;openModal('<h2>Dein Ergebnis</h2><p>Kopiere diesen Text zum Teilen:</p><textarea id="share-text" rows="6" style="width:100%;padding:12px"></textarea>');$('share-text').value=text;$('share-text').select();}}
$('word-form').addEventListener('submit',e=>{e.preventDefault();if(!lexicon||state.finished)return;const w=normalize($('word').value);
 if(!/^[a-zäöüß]{3,24}$/.test(w)){feedback('Bitte ein deutsches Wort mit 3–24 Buchstaben eingeben.',true);return;}
 const existing=state.words.find(word=>lexicon.canonical(word)===lexicon.canonical(w));
 if(existing){feedback(existing===w?'Dieses Wort ist schon auf dem Brett.':`Diese Wortform gehört zu „${title(existing)}“, das schon auf dem Brett liegt. Gleiche Grundform.`,true);return;}
 if(!lexicon.has(w)){feedback('Dieses Wort ist noch nicht verfügbar. Versuche ein anderes Wort oder seine Grundform.',true);return;}
 state.words.push(w);$('word').value='';selected=state.words.length-1;render();select(selected);
 const related=state.words.slice(0,-1).map(word=>({word,...lexicon.relation(w,word)})).sort((a,b)=>b.score-a.score),best=related[0];
 feedback(state.won?`Rätsel gelöst. Du hast ${formatPuzzlePoints(solutionResult().points)} von ${MAX_PUZZLE_POINTS} Punkten erreicht.`:best?.score>=LINK_THRESHOLD?`Verbunden mit „${title(best.word)}“ · ${best.label}`:`Noch keine Verbindung. Nächste Nähe: „${title(best.word)}“ (${formatScore(best.score)}).`);
 if(!state.finished)$('word').focus();
});
function openModal(html){$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
$('close-modal').onclick=()=>$('modal').close();$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
$('daily').onclick=()=>{if(lexicon){activeDate=today;start('daily');}};$('practice').onclick=()=>lexicon&&start('practice');$('new-practice').onclick=()=>start('practice',true);
$('arrange').onclick=()=>{if(state)wordGraph.shuffle();};
$('help').onclick=()=>openModal(`<h2>Wörter verbinden. Gedanken folgen.</h2><p>Dein Ziel: Verbinde das blaue und das rote Wort durch eine Kette verwandter Bedeutungen.</p><div class="example-chain"><b>Startwort</b> → verwandtes Wort → … → <b>Zielwort</b></div><ol><li>Gib ein deutsches Wort ein. Es wird mit allen Wörtern auf dem Brett verglichen.</li><li>Ab 50 % Verbindungsstärke entsteht eine Verbindung. Die stärksten Kanten und ein zusammenhängendes Gerüst bleiben sichtbar. So geht ein gültiger Weg auch in einem dichten Netz nicht verloren.</li><li>Sobald ein Weg von Blau nach Rot führt, hast du gewonnen. Von ${MAX_PUZZLE_POINTS} Punkten geht je ein Punkt für jedes aufs Brett gesetzte Wort und für jedes Zwischenwort im kürzesten Lösungsweg ab. Die durchschnittliche Verbindungsstärke bringt bis zu 0,99 Bonuspunkte. Jeder gesparte Versuch oder jedes gesparte Zwischenwort zählt also mehr als der gesamte Bonus. Bei gleich kurzen Lösungswegen zählt der mit der höchsten durchschnittlichen Verbindungsstärke.</li></ol><p>Du hast Platz für 50 Wörter. Im Tagesrätsel gibt es ab 25 Wörtern einen Hinweis. Im Übungsmodus warten unbegrenzt neue Rätsel.</p><p>Die Verbindungsstärke berücksichtigt Kontextnähe, Wörterbuch-Synonyme und Wortfamilien. Einzahl, Mehrzahl und erkannte Beugungen werden gemeinsam betrachtet; dieselbe Grundform zählt nur einmal. Bei jedem Wort siehst du den Grund für seine Beziehungen. Der Prozentwert ist ein Spielwert, keine Wahrscheinlichkeit. Auch Gegenteile können durch ihren gemeinsamen Kontext verbunden sein.</p><button class="primary" id="understood">Los geht’s ↗</button>`);
$('modal').addEventListener('click',e=>{if(e.target.id==='understood'){$('modal').close();write('semantio:seenHelp',true);}});
$('stats').onclick=()=>{const s=read(gamePrefix+'stats',{games:0,wins:0,best:null,daily:[]});openModal(`<h2>Deine Verbindungen</h2><div class="stat-grid"><div><strong>${Number(s.games)||0}</strong><span>Abgeschlossene Spiele</span></div><div><strong>${s.games?Math.round(s.wins/s.games*100):0}%</strong><span>Gewonnen</span></div><div><strong>${s.best??'–'}</strong><span>Wenigste Zwischenwörter</span></div></div><p>${s.daily.length} Tagesrätsel gelöst. Die Statistik und dein Fortschritt werden nur in diesem Browser gespeichert${saveAvailable?'.':' – der Browserspeicher ist derzeit nicht verfügbar.'}</p>`);};
$('settings').onclick=()=>{openModal(`<h2>Dein Spiel, dein Stil.</h2><label class="setting-row">Dunkler Modus<input id="dark-setting" type="checkbox" ${preferences.dark?'checked':''}></label><label class="setting-row">Lösungsweg beim Teilen zeigen<input id="share-setting" type="checkbox" ${preferences.sharePath?'checked':''}></label><p>Deine Einstellungen gelten nur für diesen Browser.</p><label class="setting-row">Vergangenes Tagesrätsel<input id="archive-date" type="date" min="2026-01-01" max="${today}" value="${activeDate}"></label><button class="text-button" id="archive-open">Rätsel öffnen ↗</button>`);
 $('dark-setting').onchange=e=>{preferences.dark=e.target.checked;document.body.classList.toggle('dark',preferences.dark);write('semantio:settings',preferences);};$('share-setting').onchange=e=>{preferences.sharePath=e.target.checked;write('semantio:settings',preferences);};$('archive-open').onclick=()=>{const value=$('archive-date').value;if(value&&value>='2026-01-01'&&value<=today){activeDate=value;start('daily');$('modal').close();}};
};
$('privacy').onclick=()=>openModal('<h2>Datenschutz</h2><p>Semantio benötigt kein Konto und setzt keine Analyse- oder Werbe-Cookies. Fortschritt, Statistik und Einstellungen liegen im lokalen Speicher deines Browsers. Du kannst sie über die Website-Daten deines Browsers löschen.</p><p>Die Seite wird von GitHub Pages bereitgestellt. Beim Aufruf verarbeitet GitHub technische Verbindungsdaten, darunter deine IP-Adresse. Die Schriftarten werden von Google Fonts geladen; dabei wird ebenfalls eine Verbindung zu Google hergestellt.</p><p>Beim Teilen wird erst auf deinen Klick die Teilen- oder Zwischenablagefunktion deines Geräts geöffnet. Es gibt keine Bestenliste oder Übermittlung deiner eingegebenen Wörter an einen Spielserver.</p><p><a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub-Datenschutzerklärung ↗</a></p>');
$('about').onclick=()=>openModal('<h2>Finde, was Wörter verbindet.</h2><p>Semantio ist ein eigenständiges deutsches Wortverbindungsspiel, inspiriert von <a href="https://linxicon.com" target="_blank" rel="noopener">Linxicon von Trainwreck Labs</a>. Dieses Projekt ist nicht mit dem Original verbunden.</p><p>Bedeutungsmodell: <a href="https://fasttext.cc/docs/en/crawl-vectors.html" target="_blank" rel="noopener">Meta fastText cc.de.300</a>, trainiert auf Common Crawl und Wikipedia. Das ist dieselbe öffentliche Modellbasis, die <a href="https://kontexto.de/blog/wie-funktioniert-fasttext/" target="_blank" rel="noopener">Kontexto</a> nennt. Semantio verwendet eine eigene Wortauswahl und Aufbereitung; die Werte sind nicht identisch mit Kontextos Rängen. Die Vektoren werden zentriert, um drei Hauptkomponenten bereinigt und für den Browser komprimiert. Vektordaten: <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.de" target="_blank" rel="noopener">CC BY-SA 3.0</a>, © Meta / fastText-Autoren. Wortlistenfilter: wordfreq (© Robyn Speer und Mitwirkende, CC BY-SA 4.0) und <a href="https://www.openthesaurus.de" target="_blank" rel="noopener">OpenThesaurus</a>, © Daniel Naber und Mitwirkende, CC BY-SA 4.0. Ergänzt werden Wörterbuch-Synonyme aus OpenThesaurus, Grundformen aus der deutschen Lemmaliste von Michal Boleslav Měchura (ODbL 1.0) und Wortfamilien aus DErivCELEX v2 der Universität Stuttgart (CC BY-SA 3.0). Der angezeigte Spielwert kombiniert diese Hinweise mit einer für jedes Wort kalibrierten Kontextnähe; er ist kein reiner Kosinuswert.</p><p>Das tägliche Wortpaar rotiert durch einen festen Rätselkatalog. Der Wechsel erfolgt um Mitternacht in deiner lokalen Zeitzone. Die Übung wählt zufällig ein Paar aus diesem Katalog.</p><p><a href="__SEMANTIO_REPOSITORY_URL__" target="_blank" rel="noopener">Quellcode & technische Dokumentation ↗</a></p>');
$('clue').onclick=()=>{const route=lexicon.route(state.words[0],state.words[1]),next=route.slice(1,-1).find(w=>!state.words.some(word=>lexicon.canonical(word)===lexicon.canonical(w)));if(next){state.hints++;save();feedback('Ein Wort auf einem möglichen Weg: '+title(next));$('word').value=next;$('word').focus();}else feedback('Alle Wörter eines möglichen Wegs sind vorhanden. Prüfe die Verbindungen.');};
function tick(){const now=new Date(),midnight=new Date(now);midnight.setHours(24,0,0,0);const minutes=Math.ceil((midnight-now)/60000);$('next-puzzle').textContent=`Nächstes Tagesrätsel in ${Math.floor(minutes/60)} h ${minutes%60} min`;}
tick();setInterval(tick,30000);
async function init(){try{lexicon=await loadLexicon((loaded,total)=>feedback('Bedeutungskarte laden … '+Math.round(loaded/total*100)+' %'));start('daily');if(!read('semantio:seenHelp',false)){write('semantio:seenHelp',true);$('help').click();}}catch(error){feedback('Bedeutungskarte konnte nicht geladen werden. Bitte lade die Seite neu.',true);console.error(error);}}
init();
