import {readFile, writeFile} from 'node:fs/promises';
import {HARD_ATTEMPT_LIMIT, HARD_LINK_THRESHOLD, loadLexicon, normalize, PAIRS} from '../engine.js';
import {DAILY_ROUTES} from '../data/daily/catalog-v1.js';
import {HARD_LEGACY_ROUTES} from '../data/daily/hard-legacy.js';

const root = new URL('../', import.meta.url);
const lexicon = await loadLexicon(undefined, async path => {
  const bytes = await readFile(new URL(path.split('?')[0], root));
  return {
    ok: true,
    json: async () => JSON.parse(bytes),
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  };
});

// Expand the editorial vocabulary around topics that become disconnected at 60%.
const bridges = `
silber bronze kupfer diamant platin edelmetall medaille goldmedaille edelstein schmuck
kette ring perle seil armband ohrringe schleife stange serie abfolge folge reihe kettenglied schlauch
klinik gefängnis gesundheitswesen hospital klinikum stationär krankenschwester spital pflegeheim rettungsdienst
pflege medizinisch pfleger notaufnahme operation behandlung arzt heilung erkrankung
königin thron krönung krönen monarch herrscher monarchie prinzessin prinz palast königshaus königreich
gerät handy fax tablet laptop notebook rechner drucker festplatte prozessor sensor pc anruf anrufen klingel
mobiltelefon telefonieren festnetz kommunikation telefonnummer email mail modem internetzugang verkabelung
information kunde angabe hinweis zeitung bericht ereignis botschaft meldung auskunft neuigkeit mitteilung bescheid
warnung bekanntmachung botschafter erzählen geschichte zeitschrift
ecke innenstadt kanal hauptstraße bundesstraße kreuzung landstraße allee fahrbahn damm fußgängerzone gasse
hausnummer spur ausfahrt einfahrt autobahn verkehr
schlag kugel korb torwart ballett spielfeld pfosten wurf elfmeter zweikampf torhüter tor spieler
werfen schießen torschuss abschlag volley schlager schläger
entwicklung aktivität bewegen handlung trend haltung verschiebung dynamik rhythmus berührung strömung
beweglich beweglichkeit fortschritt antrieb geräusch gang
schließen code abschließen anschließen verschließen schließung verschlüsselung verschlüsseln vorhängeschloss
türschloss schlossriegel öffnung öffnen türgriff schlüsselbund schlüsselwort
gruppe saison team auswahl verein liga trainer truppe meisterschaft turnier nation sportler kapitän
besatzung schiedsrichter halbzeit heimspiel wettkampf trikot fußballer pokal
teil mitglied punkt element bestandteil komponente modul gliederung baustein rohr bolzen schwert zubehör körperteil einzelteil
aufnahme fotografie fotograf fotografieren linse mikrofon webcam objektiv megapixel blende drohne
digitalkamera bildqualität verschluss lichtbild optik lupe
abenteuer wunder geheimnis phänomen raten erraten quiz puzzle herausforderung aufgabe knacknuss lösen lösung detektiv frage antwort
`;
const vocabulary = await readFile(new URL('data/associations.txt', root), 'utf8');
const words = [...new Set([
  ...`${vocabulary} ${bridges}`.trim().split(/\s+/).map(normalize),
  ...HARD_LEGACY_ROUTES.flat(),
])].filter(word => /^[a-zäöüß]{3,24}$/.test(word) && lexicon.has(word) && lexicon.canonical(word) === word);
const index = new Map(words.map((word, id) => [word, id]));
const neighbors = words.map(() => []);
for (let i = 0; i < words.length; i++) {
  for (let j = i + 1; j < words.length; j++) {
    const score = lexicon.score(words[i], words[j]);
    if (score >= HARD_LINK_THRESHOLD) {
      neighbors[i].push({id: j, score});
      neighbors[j].push({id: i, score});
    }
  }
}

const pathsByStart = new Map();
function findPath(start, end) {
  const startId = index.get(start);
  const endId = index.get(end);
  if (startId === undefined || endId === undefined) {
    throw new Error(`Missing Hardmode endpoint for ${start} → ${end}`);
  }
  if (!pathsByStart.has(startId)) {
    // Match the game's preference for shorter paths, then stronger connections.
    const paths = new Map([[startId, {parent: null, steps: 0, strength: 0}]]);
    const queue = [startId];
    for (const from of queue) {
      const {steps, strength} = paths.get(from);
      if (steps >= HARD_ATTEMPT_LIMIT + 1) continue;
      for (const {id, score} of neighbors[from]) {
        const known = paths.get(id);
        const next = {parent: from, steps: steps + 1, strength: strength + score};
        if (!known) queue.push(id);
        if (!known || (known.steps === next.steps && known.strength < next.strength)) paths.set(id, next);
      }
    }
    pathsByStart.set(startId, paths);
  }
  const paths = pathsByStart.get(startId);
  if (!paths.has(endId)) throw new Error(`No Hardmode route for ${start} → ${end}`);
  const route = [];
  for (let id = endId; id !== null; id = paths.get(id).parent) route.push(words[id]);
  return route.reverse();
}

const dailySteps = DAILY_ROUTES.map(route => findPath(route[0], route.at(-1)).slice(1, -1));
const practiceRoutes = PAIRS.map(([start, end]) => findPath(start, end));
const rows = paths => paths.map(path => '  ' + JSON.stringify(path)).join(',\n');
await writeFile(new URL('data/daily/hard-v2.js', root),
  `// Generated by scripts/build-hardmode-routes.mjs. Daily entries follow catalog-v1.js.\n` +
  `export const HARD_DAILY_STEPS = [\n${rows(dailySteps)}\n];\n` +
  `export const HARD_PRACTICE_ROUTES = [\n${rows(practiceRoutes)}\n];\n`);
console.log(`Verified ${dailySteps.length} daily and ${practiceRoutes.length} practice routes at the Hardmode threshold.`);
