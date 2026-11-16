# Linxikon

Ein deutsches Wortverbindungsspiel, inspiriert von [Linxicon](https://linxicon.com) von Trainwreck Labs. Eigenständige Implementierung; keine offizielle Übersetzung und keine Verbindung zum Original.

Verbinde zwei vorgegebene Wörter durch verwandte Begriffe. Jeder neue Begriff wird mit allen vorhandenen Wörtern verglichen. Die beiden Seiten müssen durch einen durchgehenden Pfad verbunden werden, bevor 50 Wörter auf dem Brett liegen.

## Spielen

- Tagesrätsel (lokaler Tageswechsel), zufällige Übungsrätsel und Datumswahl für vergangene Rätsel.
- Interaktives SVG-Wortnetz, ziehbare Knoten und Beziehungen per Mausklick oder Tastatur.
- Hinweise ab 25 Wörtern im Tagesrätsel, Gewinn- und Verlustzustand, Ergebnis teilen.
- Fortschritt, Einstellungen und Statistik im Browser; keine Anmeldung, kein Backend.
- Responsive Oberfläche, dunkler Modus, deutsche Meldungen und Umlaute.

## Deutsche Wortbeziehungen und Grenzen

`data/lexicon.json` enthält 32.901 gefilterte Synonymgruppen aus OpenThesaurus sowie 107 redaktionelle Assoziationsgruppen. Insgesamt stehen ungefähr 89.000 Einträge zur Verfügung. Die Daten bleiben getrennt vom Programmcode und sind austauschbar.

- Gemeinsame Synonymgruppe: 86 %.
- Gemeinsame Assoziationsgruppe: 64 %.
- Keine gemeinsame Gruppe: 0 % (keine Aussage darüber, ob im wirklichen Sprachgebrauch eine Beziehung besteht).
- Verbindungen entstehen ab 39,95 %. Eine Kante bleibt, wenn sie für mindestens einen Endpunkt zu dessen fünf stärksten Verbindungen gehört.

Das Original nutzt ConceptNet-Numberbatch-Vektoren und englisches WordNet. Diese Ausgabe rekonstruiert diesen nicht veröffentlichten Serveralgorithmus **nicht**. Die lokale deutsche Datenbasis ist deterministisch, einfacher und begrenzter. Mehrdeutigkeiten und Lücken sind möglich. Keine KI-Dienste oder API-Schlüssel erforderlich.

Der Rätselkatalog enthält 28 geprüfte Wortpaare. Das Tagesrätsel rotiert alle 28 Tage; Üben zieht zufällig aus demselben Katalog. Alle Wortpaare haben einen überprüften Lösungsweg. Die Statistik zählt abgeschlossene Runden; sie synchronisiert sich nicht zwischen Geräten. Tagesrätsel verwenden die lokale Zeitzone des Geräts.

## Entwicklung

Node.js 22 oder neuer. Keine npm-Abhängigkeiten erforderlich.

```sh
npm test
npm run build
```

`dist/` enthält die gesamte statische Website. Alle Asset-Pfade sind relativ und funktionieren unter `/linxikon/`.

Wortdaten neu erzeugen:

```sh
curl -L https://www.openthesaurus.de/export/OpenThesaurus-Textversion.zip -o /tmp/OpenThesaurus.zip
python3 scripts/build-data.py /tmp/OpenThesaurus.zip
```

## GitHub Pages

Repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Der Workflow `.github/workflows/pages.yml` testet, baut und veröffentlicht bei jedem Push auf `main`. Er kann außerdem unter **Actions → Publish Linxikon to GitHub Pages → Run workflow** gestartet werden. Die veröffentlichte Adresse wird vom Deploy-Schritt ausgegeben. Für private Repositories kann ein kostenpflichtiger GitHub-Plan erforderlich sein. Der Pages-Zugriff der verbundenen App ist unabhängig vom Schreibzugriff auf Repository-Dateien.

## Quellen und Lizenzen

- Spielidee: [Linxicon / Trainwreck Labs](https://linxicon.com). Design und Code dieser Ausgabe wurden neu implementiert; fremde Tracking-, Werbe- oder Kontodienste werden nicht eingebunden.
- Wörter: [OpenThesaurus](https://www.openthesaurus.de), © Daniel Naber und Mitwirkende. Export vom 15.11.2026; verändert durch Entfernen von Klammerzusätzen, Kleinschreibung und Beschränkung auf einzelne alphabetische Wörter mit 3–24 Zeichen. Abgeleitete Wortdaten unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), vollständiger Lizenztext in `data/OPENTHESAURUS-LICENSE.txt`. Ergänzende Assoziationsdaten stehen ebenfalls unter CC BY-SA 4.0.
- Schriftarten: DM Sans und McLaren, über Google Fonts geladen (SIL Open Font License). Systemschriften als Fallback.
- Untersuchung: [REA / morluto](https://github.com/morluto/rea), siehe `ANALYSIS.md`.
