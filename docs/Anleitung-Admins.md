# MGI-App – Anleitung für Admins

Admins sind der Vorstand und die Wertungsrichter. Der Admin-Bereich steht unter **Mehr → Verwaltung**.

## Mitglieder & PINs
- **Mitglied anlegen:** Vor- und Nachname eingeben, Rolle und Sparte wählen. Die App erzeugt einen zufälligen 6-stelligen PIN und zeigt ihn **nur einmal** an. Gib ihn direkt per WhatsApp oder E-Mail weiter, die Buttons dafür sind dabei.
- **Neuer PIN:** Der alte PIN wird sofort ungültig und das Mitglied auf allen Geräten abgemeldet.
- **Deaktivieren**, z. B. bei einem Austritt: Das Mitglied kann sich sofort nicht mehr anmelden. Seine Daten bleiben erhalten.
- PINs werden nur verschlüsselt gespeichert (gesalzener Hash). Auch Admins können sie nicht nachschauen, nur neu vergeben.
- Nach 5 falschen PIN-Eingaben ist der Zugang für 10 Minuten gesperrt.

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

## Einstellungen
Unter **Verwaltung → Einstellungen** pflegst du:
- Platzordnung und Notfall-Infos (Markdown, mit Vorschau)
- Notfall-Kontakte
- Grenzwerte der Wind-Ampel
- Zeit bis zum automatischen Auschecken
- Datenschutzhinweis beim Foto-Upload

## Mitteilung senden
Unter **Verwaltung → Mitteilung senden** geht eine Push-Nachricht an alle, die „Wichtige Mitteilungen“ eingeschaltet haben, z. B. „Platz heute gesperrt“.
