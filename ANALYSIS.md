# Rekonstruktionsbericht

Untersuchungsdatum: 16.11.2026. Ziel: https://linxicon.com. Umfang: öffentlich ausgelieferte Seiten und JavaScript-Artefakte. Keine Konten, privaten Daten oder internen APIs untersucht.

## Methode und REA

Der REA-Skill wurde aus dem Upstream-Projekt bezogen und unter `/workspace/skills/rea/SKILL.md` bereitgestellt. Da kein REA-MCP-Server in dieser Sitzung verbunden war, wurde der im Skill beschriebene CLI-Weg verwendet:

`npx -y rea-agents@latest analyze-javascript-application /workspace/research/linxicon --json`

Das vollständige Ergebnis liegt lokal unter `/workspace/research/rea-evidence.json`. REA-Evidence-ID:

`ev_076d5f3e9b60a98e936febe49992657f4cfef5f53fff553b057086c537368d14`

Artefakt-Digest: `70e2bbfd5bb515242b205f49f9189353ab8452902c227289d7d68e9b8ef369be`.

Analysiert wurden die heruntergeladenen Dateien `entry-client-ClHWkfVo.js`, `constants-zpZLAM5U.js` und `_gameid_-BeBOvjrl.js` (lokal in entry.js, constants.js und game.js umbenannt). Dies ist eine begrenzte statische Untersuchung. Es wurde weder eine vollständige Runtime-Beobachtung des Originals durchgeführt noch dessen Backend rekonstruiert. REA-Evidence bezeichnet statische Analyse, keine beobachteten Klickabläufe.

## Beobachtete Fakten

- Die öffentlich zugängliche Startseite erklärt die Bedeutungsbrücke zwischen zwei zufälligen Wörtern, ein tägliches Rätsel und unbegrenztes Üben.
- `/instructions` erklärt die beiden Eckwörter, das Hinzufügen von Wörtern und den durchgehenden Weg.
- `/faq` dokumentiert 39,95 % Mindestbeziehung, die fünf stärksten Verbindungen pro Wort, maximal 50 Wörter, maximal 15 Buchstaben und einen Hinweis ab 25 Wörtern ausschließlich im Tagesrätsel.
- Das heruntergeladene Konstantenmodul bestätigt diese Grenzwerte.
- Das Spielmodul enthält Zustände für Tages- und Übungssitzungen, Wortliste, Verbindungen, ausgewählten Knoten, kürzesten Weg, Gewinn und Spielende. Dies sind statische Codebefunde; keine Laufzeitbeobachtung.
- Laut FAQ berechnet das Original Beziehungen aus ConceptNet Numberbatch, WordNet-Beziehungen und Themen und nimmt das stärkste Signal. Die genauen serverseitigen Gewichte und deutschsprachige Abdeckung wurden nicht ermittelt.
- Die ausgelieferten Styles verwenden einen warmweißen Hintergrund, DM Sans/McLaren und blaue/rote Ausgangswörter. Diese Gestaltungshinweise wurden unabhängig umgesetzt.

Quellen: https://linxicon.com, https://linxicon.com/instructions, https://linxicon.com/faq, https://linxicon.com/play und die oben genannten öffentlichen JavaScript-Dateien unter `/_build/assets/`.

## Implementierungsentscheidungen

Die deutsche Ausgabe erhält das Kernspiel mit eigenständigem Code und deutschem Wortmaterial. Die statische GitHub-Pages-Architektur benötigt keinen geheimen API-Schlüssel. Synonyme und manuell gepflegte Assoziationen ersetzen die nicht verfügbare Originalbewertung. Wortlänge auf 24 erhöht, damit deutsche Komposita spielbar bleiben. Bekannte Kataloglücken werden als solche angezeigt. Kein Konto, kein Server-Speicher, kein Multiplayer, keine Werbung, keine fremden Profile oder Community-Funktionen.

Die Tagespaare stammen aus einem festen 28-Paare-Katalog. Dies ist kein Zugriff auf die Original-Tagesrätsel. Eine automatische unbegrenzte Generierung neuer Tagespaare und ein deutsches Embeddingmodell sind nicht Teil dieser Version.

## Prüfung

- Alle 28 Rätselpaare sind anhand der tatsächlichen Wortdaten lösbar und anfangs unverbunden.
- Engine-Tests prüfen Normalisierung, Score-Symmetrie, nicht vorhandene Beziehungen, zusammenhängenden Gewinnpfad, Top-5-Verbindungen und Datumsauswahl.
- JavaScript-Syntax und statischer Build geprüft.
- Browser-QA war in der verwalteten Umgebung nicht verfügbar (kein `cua_repl.js`); daher keine Aussage über visuell beobachtetes Verhalten. Ergänzender jsdom-Test bestanden: Laden des Wörterbuchs, ungültige/doppelte Eingaben, vollständiger Gewinnpfad, Statistik, Dunkelmodus, Üben, Wiederherstellen des gespeicherten Tagesrätsels und Informationsdialoge. Dies ersetzt keine visuelle Browserprüfung.

## Veröffentlichung

Das Repository war bei Beginn leer und privat. Schreibzugriff ist vorhanden. GitHub Pages Administration wurde von GitHub mit HTTP 403 verweigert. Deshalb muss die Pages-Quelle in den Repository-Einstellungen freigeschaltet werden. Ein Workflow allein bestätigt noch keine erfolgreiche Veröffentlichung; maßgeblich ist ein erfolgreicher Pages-Deploy-Lauf.
