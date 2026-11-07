# MGI-App – Anleitung für Admins

Admins sind der Vorstand und die Wertungsrichter. Der Admin-Bereich steht unter **Mehr → Verwaltung**.

## Mitglieder & PINs
- **Zugangsanfragen** erscheinen oben unter *Mitglieder & PINs* (Admins bekommen eine Push-Nachricht). **Freigeben** legt das Mitglied an und zeigt den PIN – per WhatsApp/E-Mail-Button mit App-Link verschicken. **Ablehnen** verwirft die Anfrage.
- **Mitglied anlegen:** Vor- und Nachname eingeben, Rolle und Sparte wählen. Die App erzeugt einen zufälligen 6-stelligen PIN und zeigt ihn **nur einmal** an. Gib ihn direkt per WhatsApp oder E-Mail weiter, die Buttons dafür sind dabei.
- **Neuer PIN:** Der alte PIN wird sofort ungültig und das Mitglied auf allen Geräten abgemeldet.
- **Deaktivieren**, z. B. bei einem Austritt: Das Mitglied kann sich sofort nicht mehr anmelden. Seine Daten bleiben erhalten.
- PINs werden nur verschlüsselt gespeichert (gesalzener Hash). Auch Admins können sie nicht nachschauen, nur neu vergeben.
- Nach 5 falschen PIN-Eingaben ist der Zugang für 10 Minuten gesperrt.

**Super-Admin:** Die Mitglieds-ID in der Script Property `SUPER_ADMIN` ist geschützt – andere Admins können dieses Konto weder ändern, deaktivieren, löschen noch seinen PIN zurücksetzen (gesperrt im Backend). In der Mitgliederliste steht „Super-Admin“. Ändern kann das nur, wer Zugriff auf das Apps-Script-Projekt hat.

## Wettbewerb durchführen
1. **Wertung → Neu:** Name, Datum und Anzahl der Durchgänge eingeben, die Wertungsart wählen, optional Klassen, dann die Teilnehmer eintragen. Mehrere Namen kannst du mit Komma getrennt auf einmal eingeben.
2. **Wertung eintragen:** Teilnehmer und Durchgang wählen und die Werte eingeben. Unten siehst du sofort die Punkte. Nach dem Speichern springt die App zum nächsten Teilnehmer, der in diesem Durchgang noch keine Wertung hat.
3. Die **Rangliste** aktualisiert sich bei allen Zuschauern alle 20 Sekunden.
4. **Abschließen:** Der Wettbewerb wird als Endergebnis markiert, und alle, die Push für Ergebnisse eingeschaltet haben, bekommen eine Nachricht.
5. **PDF/Drucken** und **CSV** gibt es unter der Rangliste.

## Wertungsarten & Formeln
Unter **Verwaltung → Wertungsarten & Formeln** lassen sich die vier Vorlagen anpassen oder neue Wertungsarten anlegen.

**Bausteine**
- **Eingabefelder:** Das gibt der Wertungsrichter ein. Es gibt vier Typen:
  - *Zahl*
  - *Zeit* im Format mm:ss, wird intern in Sekunden umgerechnet
  - *Ja/Nein*, ergibt 1 oder 0
  - *Liste*, mehrere Werte, z. B. eine Note je Richter
- **Konstanten:** Feste Werte wie Sollzeit oder Bonus.
- **Figuren/Aufgaben** (optional): Die Formel wird je Figur berechnet und dann addiert. Jede Figur kann eigene Werte haben, z. B. den K-Faktor `k`.
- **Formel:** Rechnet aus Eingaben und Konstanten die Punkte für einen Durchgang aus.
- **Gesamtwertung:** Bestimmt, wie aus den Durchgängen das Gesamtergebnis wird:
  - Summe, bester Durchgang oder Summe mit Streichergebnis
  - optional je Durchgang auf 1000 normieren (Tagesbester = 1000)
  - Regel für Gleichstand

**Formel-Syntax** (wie in Excel bzw. Google Tabellen)

| Was | Beispiel |
|---|---|
| Rechnen | `+ - * / ^ ( )` |
| Vergleich (ergibt 1 oder 0) | `flugzeit >= sollzeit` |
| Logik | `und`, `oder`, `nicht` |
| Wenn-dann | `wenn(ballons >= 5; 20; 0)` |
| Summe / Durchschnitt einer Liste | `summe(noten)`, `durchschnitt(noten)` |
| Höchste und niedrigste Note streichen | `durchschnitt(streich(noten))` |
| Beste n Werte | `summe(beste(noten; 3))` |
| Sonstiges | `min`, `max`, `abs`, `runden(x; 2)`, `abrunden`, `aufrunden`, `wurzel`, `anzahl` |

Wichtig: Dezimalzahlen mit **Punkt** schreiben (`2.5`) und Argumente mit **Semikolon** trennen.

**Beispiele**
- Kunstflug je Figur: `k * durchschnitt(noten)`
- Segelflug: `max(0; sollzeit - abs(flugzeit - sollzeit)) + landepunkte`
- Limbo: `durchfluege * basis * 200 / hoehe - beruehrungen * abzug`
- Ballonstechen: `ballons * 10 + wenn(ballons >= ballons_gesamt; bonus; 0) - zeit / 10 - strafpunkte`

**Versionierung:** Jede Änderung erhöht die Versionsnummer. Ein Wettbewerb rechnet immer mit der Formel-Version, die beim Anlegen galt. Unter **Bearbeiten** kann man ihn bewusst auf die neue Formel umstellen.

Die Formel-Engine führt keinen fremden Code aus. Erlaubt sind nur Zahlen, Variablen und die oben genannten Funktionen.

## Flugbuch
- Jede An- und Abmeldung landet mit Uhrzeit in der Google-Tabelle (Blätter **Flugbuch** und **Flugleiter**).
- **Verwaltung → Flugbuch-Übersicht:** Einträge nach Zeitraum, nach Tagen gruppiert, CSV-Export und Link zur Tabelle.
- Admins können vergessene Einträge anderer unter „Flugbuch heute“ abmelden. Sonst beendet die App offene Einträge automatisch **um 23:59 Uhr** am Tag der Anmeldung – markiert mit „automatisch“. Optional lässt sich unter Einstellungen zusätzlich eine Stundengrenze setzen (0 = keine).
- Der **CSV-Export** enthält zwei Blöcke: Piloten und Flugleiter (mit Fangnetz, Rasen, Wetter, Wind).
- Das elektronische Flugbuch ist in der **Flugbetriebsordnung (Fassung 07.11.2026), Abschnitt 6.2** geregelt.

## Einstellungen
Unter **Verwaltung → Einstellungen** pflegst du:
- Platzordnung und Notfall-Infos (Markdown, mit Vorschau)
- Notfall-Kontakte
- Grenzwerte der Wind-Ampel
- Stundengrenze für das automatische Abmelden im Flugbuch (0 = erst um 23:59 Uhr)
- Datenschutzhinweis beim Foto-Upload

## Push-Nachrichten
- Jedes Mitglied schaltet Push unter **Konto → Push-Nachrichten** selbst ein. Neben der Überschrift steht deutlich **an** oder **aus**; die Schalter für die Anlässe erscheinen erst, wenn Push an ist.
- **Test-Nachricht senden** schickt sofort eine Nachricht an die eigenen Geräte – gut zum Prüfen, gerade auf dem iPhone.
- Als Admin bekommst du bei jeder **Zugangsanfrage** eine Push-Nachricht (Schalter „Zugangsanfragen“, nur für Admins sichtbar).
- iPhone: Push nur in der App vom Home-Bildschirm (iOS 16.4+). Kurzanleitung für Mitglieder: [MGI-App_iPhone.pdf](MGI-App_iPhone.pdf).

## Regel-Assistent (KI)
- Mitglieder stellen unter **Regel-Assistent (KI)** (Startseite und *Mehr*) Fragen zur **Satzung**, **Flugbetriebsordnung** und zu den **MFSD-Regeln**. Die Antworten kommen von **Google Gemini** und dürfen nur aus diesen Dokumenten stammen, mit Fundstelle; sonst Verweis an den Vorstand.
- **MFSD-Regeln:** Das Backend holt einmal pro Woche (im Tagesjob `taeglich`) die StRfF (alle Ziffern) und die beiden Kurzbeschreibungen „Modellflieger“ und „Modellfluggelände“ von mfsd.de und speichert sie als `MFSD-Regeln (automatisch von mfsd.de).txt` neben der App-Tabelle. Sofort aktualisieren: im Apps-Script-Editor `mfsdAktualisieren` ausführen; prüfen mit `diagnoseMfsd`. Ändert der MFSD seine Webseite grundlegend, bricht der Abgleich mit einer Fehlermeldung ab und die letzte Fassung bleibt erhalten.
- Grenze: 30 Fragen pro Mitglied und Tag. Namen werden nicht an Google übermittelt.
- Mitgeschickt wird die aktuelle Lage (Uhrzeit, Sonnenuntergang, Wind und Wind-Ampel, Anzahl Piloten, ob ein Flugleiter da ist) und der Status des Fragenden (Mitglied/Admin, im Flugbuch angemeldet ja/nein).
- Einrichtung (Script Properties): `GEMINI_API_KEY` = Schlüssel aus [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Optional `GEMINI_MODELL` (Standard `gemini-3.1-flash-lite`).
- **Neue Fassung eines Dokuments:** PDF in den Drive legen und in den Script Properties `REGELN_DATEIEN` setzen, Format `Titel=Drive-Datei-ID,Titel=Drive-Datei-ID`, z. B. `Vereinssatzung (Stand 23.09.2024)=1mnr…,Flugbetriebsordnung (Stand 07.11.2026)=1NDT…`. Ohne diese Property nimmt das Backend Satzung 23.09.2024 und Flugbetriebsordnung 07.11.2026.
- Im kostenlosen Gemini-Tarif darf Google Eingaben zur Verbesserung nutzen; mit hinterlegter Abrechnung nicht.

## Mitteilung senden
Unter **Verwaltung → Mitteilung senden** geht eine Push-Nachricht an alle, die „Wichtige Mitteilungen“ eingeschaltet haben, z. B. „Platz heute gesperrt“.

## Arbeitsdienst-Liste

- Die Liste ist die Google-Tabelle „Arbeitsliste 2027“ im Vereins-Drive. Das erste Blatt wird gelesen: Kalenderwoche | Zeitraum (z. B. `30.03.–05.04.2026`) | Einsatz | Person 1 | Person 2. Zeilen ohne Kalenderwoche gehören zur Woche darüber.
- Die Namen werden den Mitgliedern in der App zugeordnet (voller Name, „J. Rodler“ oder eindeutiger Nachname). Nicht zuordenbare Namen stehen im Ausführungsprotokoll des Scripts (`taeglich`).
- Mitglieder tragen sich in der App ein (Seite Arbeitsdienst); die Tabelle muss dafür **nicht** für sie freigegeben werden. Austragen können nur Admins: in der App über das ✕ am Namen oder direkt in der Tabelle.
- Neue Einsätze: einfach eine Zeile unter der Woche einfügen (Spalte A und B leer, Einsatz in Spalte C).
- Neues Jahr: neue Tabelle anlegen, in den Script Properties `ARBEITSLISTE_ID` auf die neue ID setzen und `arbeitsdienstUrl` in `app/src/config.ts` anpassen.

## Besondere Vorkommnisse

Was Piloten unter „Besondere Vorkommnisse“ eintragen, steht im Blatt „Flugbuch“ in der Spalte `vorkommnisse` (wird nach dem Update automatisch hinten angefügt), in der Flugbuch-Übersicht unter dem jeweiligen Piloten und im CSV-Export.

## Technik am Platz

- Abschnitt antippen → **Bearbeiten**: Titel, Symbol, Text (einfaches Markdown), Fotos (max. 6) und optional das Blockschaltbild der Wetterstation.
- **Nur für angemeldete Mitglieder** einschalten bei allem, was nicht öffentlich sein soll (z. B. Zahlenkombination Dixi-Schloss). Solche Abschnitte schickt das Backend ohne Anmeldung gar nicht erst aus.
- Mit ↑ ↓ die Reihenfolge ändern, unten **Neuer Abschnitt** für weitere Geräte.
- Ladesteckdosen: **jeder Tisch** hat eine eigene Sicherung 15 A (Blockschaltbild und Texte entsprechend).
- Die Texte stehen im Blatt „Technik“ der Tabelle MGI-Flugbuch, Fotos im Drive-Ordner „Technik (App)“ (wird beim ersten Foto automatisch neben der Tabelle angelegt).

## Updates der App
- Neue Versionen gehen automatisch live, sobald sie auf GitHub sind. Die App sucht beim Öffnen und jedes Mal beim Zurückkehren in die App nach einer neuen Version und lädt sich dann selbst neu.
- Welche Version läuft, steht unten auf der Seite **Mehr** (z. B. „Version 1.1.0“). Hängt ein Gerät noch auf einer alten Version: App ganz schließen (iPhone: von unten wischen und die App nach oben wegschieben) und neu öffnen.
