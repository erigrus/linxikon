# Umstellung auf deutsche fastText-Wortvektoren

> Historischer Bericht der ursprünglichen fastText-Bewertung. Seit 17.11.2026 kombiniert Semantio weitere Sprachdaten und eine lokale Kalibrierung. Aktuell: [MATCHING.md](MATCHING.md).

16.11.2026. Anlass: Die ursprünglichen festen Synonym- und Themengruppen erkannten viele sinnvolle Beziehungen nicht. Nutzerwunsch: dieselbe Datenbasis wie Kontexto.

## Quellenbefund

- Kontexto benennt `cc.de.300.bin` von Meta fastText und erklärt sein Verfahren: https://kontexto.de/blog/wie-funktioniert-fasttext/
- Kontexto beschreibt Mittelwertabzug und Entfernung der drei größten Hauptkomponenten mit einer alltagssprachlichen Referenzmenge: https://kontexto.de/blog/all-but-the-top-vektoren-entzerren/
- Meta stellt dasselbe trainierte deutsche Modell auch als Wortvektor-Textdatei bereit, unter CC BY-SA 3.0: https://fasttext.cc/docs/en/crawl-vectors.html

Es wurden keine Kontexto-Interna, Rangtabellen oder privaten Daten kopiert. Die veröffentlichte fastText-Modellbasis ist identisch; eigene Wortauswahl, Referenzmenge und int8-Aufbereitung können andere Werte liefern. Der bekannte Wortvektor-Export ersetzt nicht die Subword-Funktion des binären Gesamtmodells.

## Umsetzung

- 80.751 Wörter aus den ersten 600.000 Modellzeilen, mit OpenThesaurus und wordfreq gefiltert. Die häufigste vorhandene Originalschreibung wird für jeden kleingeschriebenen Eintrag verwendet.
- 300 Dimensionen, Mittelwertabzug, drei Hauptkomponenten entfernt; Fit auf 15.500 akzeptierten Einträgen in Quellhäufigkeitsreihenfolge. Keine erfundenen Ähnlichkeitswerte oder Synonymüberschreibungen.
- Pro Vektor int8-Quantisierung. Der Browser berechnet den Kosinus mit den tatsächlichen Normen der quantisierten Vektoren; Identität ergibt 100 %, fehlende Vektoren ergeben keinen erfundenen Wert.
- 20 Datenblöcke mit SHA-256-Prüfung, maximal vier gleichzeitige Downloads, sichtbarer Ladefortschritt. Ohne vollständiges gültiges Modell startet keine Runde.
- Verbindungen ab 29,95 %, angepasst an die bereinigte Werteverteilung. Vorherige 39,95 % waren für die frühere Datenbasis gewählt. Anzeige mit einer Nachkommastelle vermeidet den Eindruck, dass knapp unterhalb der Schwelle bereits eine Verbindung bestehen müsste.
- Alte Spielstände und Statistiken bleiben unverändert in ihrem bisherigen lokalen Namensraum. Neue Modellversionen nutzen einen eigenen Namensraum; Einstellungen bleiben gleich.

## Verifikation

Die Engine-Tests prüfen echte Modellwerte gegen sachfremde Kontrollwörter, Symmetrie, Kosinusrechnung, Umlaute und häufige Wortformen, alle 28 Lösungspfade samt Top-5-Regel, Datumswahl und Score-Rundung. Der Modellloader wird mit den echten Dateien und mit fehlenden, unvollständigen sowie korrupten Blöcken geprüft. Ein zusätzlicher jsdom-Ablauf prüft das vollständige Spiel einschließlich Statistik, Einstellungen, Üben und Wiederherstellen gespeicherter Runden. Keine visuelle Browserprüfung verfügbar.

Beispielwerte des ausgelieferten Modells:

| Wortpaar | Kosinus × 100 |
| --- | ---: |
| Hund – Katze | 66,0 % |
| Hund – Computer | 10,5 % |
| Erdbeere – Himbeere | 65,9 % |
| Kaffee – Tee | 73,2 % |
| Meer – Ozean | 64,8 % |
| Sonne – Sonnenlicht | 57,7 % |
| Auto – Fahrzeug | 66,2 % |
| Arzt – Krankenhaus | 39,7 % |
| Wald – Bäume | 46,6 % |

Dies sind eigene gemessene Kosinuswerte, keine Kontexto-Ränge. Die maximale beobachtete Kosinusabweichung durch Quantisierung bei aufeinanderfolgenden Vektorpaaren steht im Manifest; dieser begrenzte Messwert ist keine Garantie für alle denkbaren Wortpaare.
