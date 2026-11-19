# Natürlichere Verbindungen

Aktuelle Regeln vom 19.11.2026 (`de-relations-v3`). Frühere Änderungen adressierten Beziehungen wie Arbeit–überarbeitet, Vitamin–Gesundheit und Vitamin–Obst. Die aktuelle Fassung ergänzt direkte Begriffsbeziehungen und prüft die Grundformen bei Kontexttreffern. Die frühere Regel verknüpfte ausschließlich bei
ungefähr 30 % bereinigtem Kosinus. Sie behandelte Wortformen getrennt, berücksichtigte
keine Wortfamilien und konnte beim Ausblenden schwächerer Kanten einen gültigen Weg trennen.

## Bewertung

Die unveränderte öffentliche fastText-Modellbasis liefert weiterhin die Vektoren.
Die neue Spielstärke ist eine Kombination mehrerer Hinweise:

1. **Grundformen.** Wörterbuchbelegte Beugungen werden zusammengefasst. Die ursprüngliche
   Modellschreibung und Groß-/Kleinschreibung dienen beim Datenbau zur Unterscheidung von
   Wortarten. Ein Vektorkosinus von mindestens 0,35 bestätigt eine vorgeschlagene Zuordnung;
   reine Zeichenähnlichkeit reicht nicht. Pro Gruppe werden die Grundform (falls vorhanden)
   und häufige Formen verwendet, maximal drei Vertreter. Bei fehlendem Grundform-Vektor
   kann ein vorhandener Beugungsvektor die Grundform vertreten.
2. **Lokale Kontextnähe.** Für jeden Modellvektor wird die Nähe zum 120. Nachbarn unter
   12.000 häufigen Wörterbuchkonzepten bestimmt. Diese lokale Schwelle wird auf 0,22–0,30
   begrenzt. Damit erhalten Wörter mit unterschiedlich dichter Nachbarschaft unterschiedliche
   Bezugspunkte. Der Browser nimmt die strengere der beiden Schwellen und verwendet mindestens 0,25. Ein Kontexttreffer setzt zusätzlich einen Kosinus von mindestens 0,21 zwischen den Grundformen voraus.
3. **Wörterbuchwissen.** Eine gemeinsame Wortfamilie aus DErivCELEX liefert Spielstärke 72 %;
   eine OpenThesaurus-Synonymbeziehung 88 %. Gleiche Grundformen entsprechen 100 %. Diese
   Gewichte sind transparente Spielregeln und keine statistischen Wahrscheinlichkeiten.

4. **Direkte Begriffsbeziehungen.** Redaktionell gepflegte Oberbegriffe (82 %),
   Maßeinheiten und Verwendungszwecke (je 74 %) sowie Zutaten (76 %) ergänzen das Modell.
   Die Beziehung gilt für das jeweilige Paar. Begriffe können dadurch auch ohne eigenen
   Vektor verfügbar sein, etwa „Wanduhr“.

Der Kontextbeitrag wird unterhalb der lokalen Schwelle linear von 0 bis 50 % abgebildet.
Oberhalb der Schwelle steigt er linear bis 100 %. Negative Kosinuswerte liefern 0 %.
Berechnet wird das stärkste Signal aus Kontext, Wortformen und belegten Begriffsbeziehungen.
Die automatische Unterscheidung mehrerer Wortbedeutungen bleibt begrenzt. Beispielsweise
bleibt „Apple“ im Technikkontext ein Markenname und bekommt keine Übersetzungsverbindung
zum Obstbegriff „Apfel“.

Verknüpft wird ab 49,95 % Spielstärke (Anzeige 50,0 %). Im Seitenbereich steht der Grund.
Der Rohkosinus bleibt über die interne Methode `cosine()` messbar und wird nicht als
Synonymie oder Wahrscheinlichkeit ausgegeben.

## Spielverhalten

- Eine bereits vorhandene Grundform wird bei einer weiteren Beugung erklärt statt als
  zusätzlicher Versuch gezählt. Bestehende gespeicherte Netze mit solchen Formen bleiben erhalten.
- Für die Darstellung werden zusätzlich zu den stärksten Kanten die Kanten eines maximalen
  Spannwaldes behalten. Das bewahrt die Erreichbarkeit aller semantisch verbundenen Komponenten.
- Hinweise entfernen gleichwertige Wortformen und suchen einen gültigen kürzesten Weg unter
  den verbleibenden Kandidaten. Alle 28 Tagespaare bleiben anfangs getrennt und lösbar.
- Bestehende Runden, Einstellungen und Statistiken behalten ihren Speicherbereich. Gespeicherte
  Wörter in offenen Runden werden nach den aktuellen Regeln neu verbunden. Abgeschlossene
  Runden behalten die Regeln und die Wertung ihres Ergebnisses.

## Prüfung und Grenzen

`tests/fixtures/relationship-quality.json` enthält 40 nachvollziehbare positive Beziehungen
und 30 negative Kontrollen, darunter ähnlich geschriebene, aber inhaltlich andere Wörter.
Diese Beispiele sind Entwicklungs- und Regressionstests, kein repräsentativer Sprachbenchmark.
Tests prüfen außerdem Beugungen, Wortfamilien-Erklärungen, Symmetrie, unverwechselte Homographen,
alle Rätselpfade ohne doppelte Grundformen, den Erhalt von Brückenkanten und den vollständig
geprüften Datenlader. Ergänzend wurde der Spielablauf mit den Nutzerbeispielen, gespeicherten
Runden, Zurückweisen doppelter Beugungen, Gewinn und Einstellungen in jsdom geprüft.

Das System verwendet pro Wort weiterhin statische Modellvektoren und Wörterbuchzuordnungen.
Es kennt nicht den vom Spieler gedachten Satz oder jede einzelne Bedeutung. Wortfamilien
können Bedeutungsverschiebungen enthalten; auch Modellnachbarschaften können überraschend sein.
Ein gleich aussehender Wortteil allein erzeugt keine Verbindung. Keine visuelle Safari-Prüfung
war in der Entwicklungsumgebung verfügbar.

## Quellen und getrennte Lizenzen

- Lemmaliste: https://github.com/michmech/lemmatization-lists — ODbL 1.0.
- DErivCELEX v2: https://www.ims.uni-stuttgart.de/forschung/ressourcen/lexika/derivbase/ — CC BY-SA 3.0.
- OpenThesaurus: https://www.openthesaurus.de — CC BY-SA 4.0.
- Meta fastText cc.de.300: https://fasttext.cc/docs/en/crawl-vectors.html — CC BY-SA 3.0.

Anpassungen, Attribution und Lizenztexte: `data/relationships/NOTICE.md`. Datenbau:
`scripts/build-relationships.py`. Die zusätzlichen Ressourcen sind getrennt lizenziert,
versioniert und mit Prüfsummen sowie dem zugrunde liegenden Vokabular verbunden.
