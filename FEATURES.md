# Geplante Features

Hier werden Feature-Ideen gesammelt, die noch nicht implementiert sind.
**Wenn ein Feature implementiert wird, muss es aus dieser Datei gelöscht werden.**

---

## Einkaufsliste

### Einkaufsliste aus Wochenplan generieren

Automatische Generierung einer Einkaufsliste auf Basis eines frei wählbaren Zeitraums.

**Zeitraumauswahl**
- Schnellauswahl (z.B. „Diese Woche", „Nächste 7 Tage") kombiniert mit freiem Datepicker (Von–Bis)

**Aggregation & Mengenberechnung**
- Zutaten aller Rezepte im gewählten Zeitraum werden zusammengefasst und Mengen addiert
- Umrechnung auf gängige Packungsgrößen via interner Tabelle (z.B. 16g Backpulver → „≈ 1 Pckg Backpulver")
- Bei Frischwaren (Obst, Gemüse) bleibt die Grammzahl stehen, da keine eindeutige Packungsgröße existiert
- `custom_meal`-Einträge (Freitextmahlzeiten) werden als Merker ohne Zutaten in die Liste übernommen und als „Freitexteintrag" markiert

**Abhak-System**
- Jeder Artikel hat einen einzelnen Haken
- Abgehakte Artikel verschieben sich in einen „Erledigt"-Bereich am Ende der Liste (grau, durchgestrichen)
- Der „Erledigt"-Bereich kann per Button vollständig geleert werden

**Persistenz & Geräteübergreifende Verfügbarkeit**
- Die Liste wird in der Datenbank gespeichert und ist auf allen Geräten verfügbar
- Die Liste bleibt aktiv, bis sie manuell geleert oder überschrieben wird
- Wird eine neue Liste generiert, während eine aktive existiert: Hinweis an den Nutzer mit Wahlmöglichkeit (überschreiben oder zusammenführen)

**Manuelle Einträge**
- Artikel können manuell hinzugefügt werden (Freitext + Menge + Einheit)

---

## Rezeptplanung

### Intuitive UI für die Rezeptplanung

Vollständige Überarbeitung der Wochenplanungs-Oberfläche mit Fokus auf Mobile-Usability.

**Layout & Responsivität**
- **Mobile** (< 768px): Tageskarten untereinander; jede Karte zeigt 3 Mahlzeit-Slots (Frühstück, Mittag, Abend)
- **Tablet** (768–1024px): Wie Mobile, aber mit mehr Platz pro Karte
- **Web/Desktop** (> 1024px): 7 Tage nebeneinander (horizontales Scrollen), je 3 Slots pro Tag
- Rezepttitel werden bei Platzmangel abgekürzt (Truncation)

**Slot-Struktur**
- 3 Slots pro Tag (Frühstück, Mittag, Abend), immer sichtbar
- Jeder Slot enthält eine Zeile pro Haushaltsmitglied (aktuell 3 Personen)
- Leere Personen-Zeilen zeigen ein deutliches „+"-Icon

**Interaktion**
- Antippen einer leeren Zeile → Rezeptauswahl öffnet sich (Modal/Bottom-Sheet)
  - Rezeptauswahl zeigt „Zuletzt verwendet" als schnellen Einstieg
- **Long-Press** auf einen befüllten Eintrag → Bottom-Sheet mit Aktionen:
  - **Verschieben**: Slots werden hervorgehoben, Antippen des Zielslots verschiebt den Eintrag
  - **Kopieren**: gleicher Flow wie Verschieben, Original bleibt erhalten
  - **Löschen**
  - **Wöchentlich wiederholen** (ein/aus): wiederholt diesen Eintrag jeden Wochentag
- **Web/Desktop zusätzlich**: Drag & Drop zwischen Slots

---

## KI-Chat

### Datenbankzugriff im KI-Chat

Der KI-Chat erhält vollständigen Lesezugriff auf alle App-Daten:
- Rezepte (inkl. vollständiger Zutaten, Zubereitungsschritte, Tags, Bewertungen)
- Wochenplan (alle Einträge, alle Personen)
- Einkaufsliste
- Haushaltsmitglieder

Damit kann die KI kontextbezogene Vorschläge machen (z.B. „Was kann ich diese Woche noch kochen?" oder „Welche Zutaten fehlen mir noch?").

### Mehrere Konversationen

Der KI-Chat unterstützt mehrere separate, unabhängig gespeicherte Konversationen.

- Jede Konversation wird automatisch betitelt (z.B. anhand der ersten Nachricht)
- Maximal ~10 aktive Konversationen vorgesehen, keine Suchfunktion notwendig
- Architektur soll perspektivisch verschiedene **Konversationstypen** unterstützen (z.B. Rezeptideen, Wochenplanung, Einkauf) – initiale Implementierung als freie Chats ohne Kategorisierung

### Datenveränderung aus dem Chat

Der KI-Chat kann aktiv Daten in der App anlegen, bearbeiten und löschen:
- Rezepte anlegen / bearbeiten / löschen
- Wochenplan-Einträge setzen / ändern / löschen
- Einkaufsliste generieren / bearbeiten

**Sicherheit**: Jede schreibende Aktion wird dem Nutzer zuerst als Vorschlag präsentiert. Änderungen werden erst nach expliziter Bestätigung durch den Nutzer ausgeführt – unabhängig von der Art der Aktion (Anlegen, Bearbeiten, Löschen).

### Voice Input & Output

Spracheingabe und Sprachausgabe im KI-Chat.

- **Plattform**: Mobile (iOS/Android)
- **Eingabe (Speech-to-Text)**: Einmaliges Antippen des Mikrofon-Buttons startet die Aufnahme; automatische Erkennung des Sprechendes (Pause-Detection); erkannter Text wird ins Eingabefeld übernommen und kann vor dem Senden noch bearbeitet werden
- **Ausgabe (Text-to-Speech)**: KI-Antworten werden optional vorgelesen
