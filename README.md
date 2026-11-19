# Semantio

Deutsches Wortverbindungsspiel, inspiriert von [Linxicon](https://linxicon.com). Spielen: **https://erigrus.github.io/semantio/**. Eigenständige Implementierung; keine Verbindung zu Linxicon oder Kontexto.

Verbinde zwei vorgegebene Wörter durch verwandte Begriffe. Jeder neue Begriff wird mit allen vorhandenen Wörtern verglichen. Gewinne mit einer durchgehenden Verbindung, bevor 50 Wörter auf dem Brett liegen.

- Tagesrätsel, zufällige Übungsrätsel, Datumswahl für vergangene Rätsel.
- Ziehbares SVG-Wortnetz, Beziehungen per Klick oder Tastatur, exakte Nähe mit einer Nachkommastelle.
- Hinweise von Anfang an im Tagesrätsel, Gewinn/Verlust, Ergebnis teilen, dunkler Modus.
- Fortschritt, Einstellungen und Statistik lokal im Browser; kein Konto, keine API-Schlüssel.

## Lebendiges Wortnetz

Wortkarten hängen an gedämpften Federn und stoßen einander ab. Neue Wörter poppen hinein und geben dem Netz einen Impuls. Beim Ziehen und Loslassen reagieren verbundene Karten; weiche Bézier-Kanten schwingen nach. Kartenabstände, ein Kreuzungsplaner und gebogene Wege um Wörter reduzieren Überlagerungen. In dichten, nicht planaren Netzen sind Kreuzungen weiterhin möglich.

Das Netz wächst mit der Wortzahl, lässt sich mobil über den Hintergrund scrollen und pausiert außerhalb des sichtbaren Bereichs sowie in inaktiven Tabs. „Bewegung reduzieren“ im Betriebssystem schaltet die Animationen ab und ordnet die Wörter direkt an. Darstellung und Physik liegen getrennt in `word-graph.js` und `graph-physics.js`; die Bedeutungsbewertung bleibt unverändert.

## Bedeutungsmodell – dieselbe öffentliche Basis wie Kontexto

[Kontexto nennt `cc.de.300.bin`](https://kontexto.de/blog/wie-funktioniert-fasttext/) von Meta fastText als Grundlage. Semantio verwendet den dazu veröffentlichten **`cc.de.300.vec.gz`-Export**: 300-dimensionale deutsche Vektoren, trainiert auf Common Crawl und Wikipedia. [Offizielle Modellbeschreibung und Download](https://fasttext.cc/docs/en/crawl-vectors.html).

Die alte Bewertung mit festen Synonym- und Themenpunkten (86 % / 64 % / 0 %) wurde vollständig ersetzt:

1. Die ersten 600.000 Modellzeilen werden mit einer Wortliste aus OpenThesaurus und den 50.000 häufigsten deutschen wordfreq-Einträgen abgeglichen. Häufige gebeugte Formen und Komposita sind dadurch ebenfalls enthalten.
2. Bei mehreren Schreibweisen gewinnt die zuerst beobachtete, häufigste Originalschreibung. Eingaben werden ohne Beachtung der Groß-/Kleinschreibung verglichen.
3. **All-but-the-Top:** Mittelwert und drei Hauptkomponenten werden auf den ersten 15.500 akzeptierten Wörtern berechnet und von allen Vektoren entfernt. [Kontexto beschreibt dieselbe Art der Bereinigung](https://kontexto.de/blog/all-but-the-top-vektoren-entzerren/).
4. 80.751 Vektoren mit je 300 Dimensionen werden pro Zeile zu int8 quantisiert. Der Browser lädt 20 versionierte, SHA-256-geprüfte Datenblöcke (zusammen etwa 24 MB) und berechnet Kosinus-Ähnlichkeiten als ein Signal der Bewertung. Hinzu kommen etwa 2 MB Sprachdaten für Wortformen, Wortfamilien, Synonyme, direkte Begriffsbeziehungen und Kontextkalibrierung. Er benötigt weder das große Gesamtmodell noch einen Server für Eingaben.

**Gleiche öffentliche Modellbasis bedeutet keine identischen Kontexto-Ränge.** Wortauswahl, Referenzmenge, Schreibweisen und Komprimierung sind eigene Entscheidungen. Die proprietären Rätsel-/Rangtabellen von Kontexto werden nicht verwendet. Der Text-Export enthält keine Subword-Matrizen für neue, unbekannte Wörter; fehlende Wörter werden ausdrücklich gemeldet.

### Verbesserte Verbindungen

Seit 17.11.2026 verwendet Semantio eine kombinierte **Verbindungsstärke von 0–100 %**. Sie ist kein reiner Kosinuswert und keine Wahrscheinlichkeit. Ab **49,95 % (angezeigt als 50,0 %)** entsteht eine Verbindung.

- Erkannte Einzahl, Mehrzahl und Beugungen teilen ihre Grundform und bis zu drei häufige Vektorvertreter. Gleiche Grundformen zählen bei neuen Eingaben nur einmal und verbrauchen keinen zusätzlichen Versuch.
- Die Kontextnähe wird je Wort relativ zu seiner Nachbarschaft bewertet. Ein Mindestwert für die Grundformen verhindert, dass eine einzelne Beugung allein eine Verbindung erzeugt.
- Wörterbuch-Synonyme und lexikalisch belegte Wortfamilien liefern zusätzliche Beziehungen. Das stärkt beispielsweise Arbeit–überarbeitet auch dann, wenn das Vektormodell eher an das Überarbeiten eines Textes denkt.
- Direkte Beziehungen wie Oberbegriff, Maßeinheit, Verwendungszweck und Zutat stehen in einer redaktionellen Wortliste. Der Seitenbereich zeigt den Grund jeder Verbindung.
- Die stärksten Verbindungen und ein maximales Spannwald-Gerüst bleiben sichtbar. Dadurch trennt die visuelle Ausdünnung keine tatsächlich verbundenen Teile des Netzes.

Die [Matching-Dokumentation](MATCHING.md) beschreibt die Bewertung und ihre Grenzen.

Seit dem 21.11.2026 verwendet das Tagesrätsel 2.048 automatisch zusammengestellte Wortpaare. Der Generator zieht aus vertrauten, im Wörterbuch verfügbaren Nomen. Beide Startwörter haben unter 10 % Verbindungsstärke. Jedes Paar hat einen mit dem aktiven Matching geprüften Pfad mit zwei bis vier Zwischenwörtern. Im geprüften Wortvorrat gibt es keine Verbindung mit nur einem Zwischenwort. Weitere Lösungen können im größeren Spielwörterbuch möglich sein.

Das lokale Kalenderdatum bestimmt den Eintrag. Kein Wortpaar kommt in den ersten 2.048 Tagen zweimal vor. Danach wiederholt sich die Folge. Die früheren 28 Paare bleiben für das Archiv vor dem Stichtag und für den Übungsmodus verfügbar.

`node scripts/build-daily-puzzles.mjs` erzeugt die Datumsfolge mit dem ausgelieferten Wörterbuch und demselben Matching wie das Spiel. Bei einer Erweiterung bleiben bereits vergebene Termine erhalten.

## Spielstände und Umbenennung

Das Spiel heißt seit 17.11.2026 **Semantio**. Runden und Statistiken verwenden `semantio:fasttext-de-abtt3-v1:*`; Einstellungen liegen unter `semantio:settings`. Beim nächsten Aufruf werden bisherige `linxikon:*`-Einträge automatisch kopiert. Bereits vorhandene neuere Semantio-Spielstände werden dabei nicht überschrieben. Die ursprünglichen Einträge bleiben erhalten; bei gesperrtem oder vollem Speicher können sie weiterhin gelesen werden.

Ältere Spielstände aus der Zeit vor dem fastText-Modell werden weiterhin getrennt behandelt. Die Tagesauswahl nutzt die lokale Gerätezeitzone; Fortschritt synchronisiert sich nicht zwischen Geräten. Die Migration funktioniert für beide GitHub-Pages-Pfade auf demselben Ursprung `erigrus.github.io`.

## Entwicklung

Node.js 22 oder neuer, keine npm-Abhängigkeiten nötig:

```sh
npm test
npm run build
```

`dist/` enthält die statische Website mit relativen Asset-Pfaden für den Repository-Pfad `/semantio/`.

### Vektordaten reproduzieren

Nur der Datenbau braucht Python, numpy und wordfreq 3.1.1. Diese Werkzeuge werden nicht an Browser ausgeliefert.

```sh
python3 -m venv /tmp/semantio-build
/tmp/semantio-build/bin/pip install numpy wordfreq==3.1.1
curl -L https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.de.300.vec.gz -o /tmp/cc.de.300.vec.gz
OPENBLAS_NUM_THREADS=4 /tmp/semantio-build/bin/python scripts/build-embeddings.py /tmp/cc.de.300.vec.gz --cache /tmp/selected.npz
npm test
npm run build
```

Der Builder verarbeitet nur die ersten 600.000 Zeilen und speichert einen nach dem Wortfilter versionierten Extraktionscache. `manifest.json` dokumentiert Quellmodell, Transformation, Wortauswahl, Prüfsummen und Routingpfade. `data/lexicon.json` und `data/associations.txt` dienen nur der historischen Wortauswahl, **nicht** der Ähnlichkeitsbewertung. Mit `scripts/build-data.py` lässt sich der ursprüngliche OpenThesaurus-Filter erneut erzeugen.

## GitHub Pages

[Settings → Pages](https://github.com/erigrus/semantio/settings/pages) → Source: **GitHub Actions**. `.github/workflows/pages.yml` prüft, baut und veröffentlicht jeden Push auf `main`. Die Workflow-Ausgabe bestätigt die tatsächliche Veröffentlichung. Der Build erzeugt kanonische Seitenadresse und Repository-Links aus `GITHUB_REPOSITORY`. Lokal wird `erigrus/semantio` verwendet.

Produkt, Repository und Pages-Adresse heißen seit 17.11.2026 Semantio. Die neue Adresse ist **https://erigrus.github.io/semantio/**. Alte GitHub-Pages-Adressen werden durch eine Repository-Umbenennung nicht automatisch weitergeleitet.

### Sprachdaten reproduzieren

Nach dem Vektorbau (mit dem Cache `/tmp/selected.npz` aus dem Beispiel oben):

```sh
curl -L https://raw.githubusercontent.com/michmech/lemmatization-lists/master/lemmatization-de.txt -o /tmp/lemmatization-de.txt
curl -L https://www.ims.uni-stuttgart.de/documents/ressourcen/lexika/derivbase/derivcelex-v2.txt -o /tmp/derivcelex-v2.txt
OPENBLAS_NUM_THREADS=4 /tmp/semantio-build/bin/python scripts/build-relationships.py --lemmas /tmp/lemmatization-de.txt --families /tmp/derivcelex-v2.txt --source-forms /tmp/selected.npz
npm test
npm run build
```

## Quellen und Lizenzen

- Spielidee: [Linxicon / Trainwreck Labs](https://linxicon.com). Programmcode und Gestaltung wurden unabhängig implementiert. Bestehende Code-Lizenz: `LICENSE`.
- Vektoren: Meta / fastText-Autoren, *Learning Word Vectors for 157 Languages*, Grave et al., LREC 2018. **CC BY-SA 3.0**, einschließlich der bearbeiteten Vektoren. Quelle, Veränderungen, vollständige Lizenz: `data/fasttext/NOTICE.md` und `LICENSE-CC-BY-SA-3.0.txt`.
- Wortfilter: [OpenThesaurus](https://www.openthesaurus.de), © Daniel Naber und Mitwirkende, Export 15.11.2026, bearbeitet, **CC BY-SA 4.0**. Siehe `data/OPENTHESAURUS-LICENSE.txt`.
- Ergänzende Wortauswahl: [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1, © Robyn Speer und Mitwirkende. Häufigkeitsdaten **CC BY-SA 4.0**; Paketcode Apache 2.0. Attribution der zugrunde liegenden Korpora: `data/WORDFREQ-NOTICE.md` und `WORDFREQ-LICENSE.txt`.
- Zusätzliche Beziehungsdaten: deutsche Lemmaliste von Michal Boleslav Měchura (ODbL 1.0), DErivCELEX v2 / IMS Stuttgart (CC BY-SA 3.0), OpenThesaurus (CC BY-SA 4.0) und fastText-Kalibrierung (CC BY-SA 3.0). Siehe `data/relationships/NOTICE.md` und die jeweils getrennten Datenbanken.
- Schriften: DM Sans und McLaren (SIL Open Font License) über Google Fonts; Systemschrift als Fallback.
- Ursprüngliche REA-Untersuchung und Grenzen: `ANALYSIS.md`. Bericht zur Modellumstellung: `MODEL-UPDATE.md`.
