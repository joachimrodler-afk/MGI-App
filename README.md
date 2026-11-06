# MGI-Vereins-App

Die App der **Modellbau-Gemeinschaft Ismaning e.V.** ist eine Web-App (PWA). Sie läuft im Browser jedes Handys und lässt sich wie eine normale App auf den Startbildschirm legen. Ein App-Store wird dafür nicht gebraucht.

![Logo](assets/logo.png)

## Funktionen

| Bereich | Was es kann |
|---|---|
| **Startseite** | Wind, Böen und Temperatur, Anzahl der Mitglieder am Platz, nächster Termin, Kacheln zu allen Bereichen |
| **Termine** | Die nächsten Termine aus dem kalender.digital-Kalender, einzelne Termine lassen sich in den eigenen Kalender übernehmen |
| **Wetter** | Wind mit Kompass, Böen, Vorhersage für die nächsten Stunden und eine Ampel für den Flugbetrieb (Grenzwerte einstellbar) |
| **Webcam** | Standbild, das sich jede Minute aktualisiert. Antippen öffnet den Live-Stream auf der IPCamLive-Seite (Einbetten ist im kostenlosen IPCamLive-Paket nicht möglich) |
| **Strom** | Akkustand der Bluetti, Leistung von Solar, Netz, AC und DC, Stand jedes Packs, optional Verlauf (ThingSpeak) |
| **Foto** | Foto aufnehmen oder aus der Galerie wählen. Es wird verkleinert und landet automatisch im Drive-Ordner der Homepage-Galerie. Ohne Netz kommt es in eine Warteschlange |
| **Wettbewerbe** | Kunstflug, Segelflug, Limbo, Ballonstechen und eigene Arten mit **frei hinterlegbaren Formeln**. Live-Rangliste, Export als PDF und CSV |
| **Flugbuch** | Elektronisches Flugbuch nach dem Papiervordruck: An-/Abmelden per Button (Uhrzeit wird automatisch ins Google Sheet geschrieben), Verein/Gast, Schulungsnachweis, Antriebsart, Gewichtsklasse, Bestätigung der Betriebsregeln; Modellflugleiter mit Flugbedingungen (Fangnetz, Rasen, Wetter, Wind). Daraus ergibt sich „Wer ist am Platz?“. Übersicht und CSV-Export für Admins |
| **Zugangsanfrage** | Neue Mitglieder fragen in der App Zugang an, ein Admin gibt frei – der PIN wird mit App-Link per WhatsApp/E-Mail verschickt |
| **Schwarzes Brett** | Biete, Suche und Info mit Fotos und Kontakt-Button. Beiträge laufen nach 60 Tagen ab |
| **Notfall & Platzordnung** | Notruf 112, Koordinaten zum Vorlesen, Kontakte und Platzordnung, funktioniert auch **offline** |
| **Nachweise** | Ablaufdaten von Kenntnisnachweis, e-ID und Versicherung mit Push-Erinnerung |
| **Push-Nachrichten** | Termine, Mitteilungen wie Platzsperrungen, Ergebnisse, Schwarzes Brett und Nachweise. Jedes Mitglied schaltet selbst ein, was es bekommen will |
| **Verwaltung** | Zugangsanfragen, Mitglieder mit persönlichem PIN (einmal anmelden, dauerhaft angemeldet), Flugbuch-Übersicht, Wertungsarten und Formeln, Einstellungen, Mitteilungen |

**Demo:** Solange in `app/src/config.ts` keine `apiUrl` eingetragen ist, läuft die App im Demo-Modus mit Beispieldaten. Zum Ausprobieren gibt es zwei Zugänge:
- **Demo Admin** mit PIN `123456`
- **Max Muster** mit PIN `111111`

## Aufbau

```
app/            Frontend: Vite + React + TypeScript + Tailwind, PWA (Service Worker in src/sw.ts)
  src/config.ts   ← ALLE Links und Einstellungen an einer Stelle
  src/lib/formel.ts      sichere Formel-Engine (kein eval)
  src/lib/auswertung.ts  Punkte, Normierung, Streichergebnis, Rangliste
apps-script/    Backend: Google Apps Script (Code.gs, appsscript.json)
docs/           Anleitungen und Tabellenvorlage
assets/         Vereinslogo
```

Für das Backend braucht der Verein **keinen eigenen Server**. Google Apps Script läuft im Google-Konto des Vereins und speichert die Daten in einer Google-Tabelle. Fotos landen in Google Drive.

---

## Einrichtung Schritt für Schritt

Die Einrichtung dauert etwa eine Stunde. Am besten benutzt du dafür das Google-Konto, dem schon die Vereins-Homepage gehört.

### 1. Google-Tabelle anlegen
1. Auf [sheets.google.com](https://sheets.google.com) eine neue, leere Tabelle anlegen und z. B. **„MGI-App Daten“** nennen.
2. Die **ID** der Tabelle steht in der Adresszeile zwischen `/d/` und `/edit`. Kopiere sie, du brauchst sie in Schritt 4.
3. Tabellenblätter musst du nicht anlegen, das übernimmt Schritt 5. Welche Blätter es gibt, steht in [docs/Google-Sheet-Vorlage.md](docs/Google-Sheet-Vorlage.md).

### 2. Drive-Ordner anlegen
1. Den Ordner für die **Homepage-Galerie** verwenden, oder einen neuen anlegen, z. B. „MGI Fotos“.
2. Den Ordner freigeben: **Teilen → Allgemeiner Zugriff → „Jeder mit dem Link“ → Betrachter**.
3. Einen **zweiten** Ordner für die Bilder vom Schwarzen Brett anlegen, z. B. „MGI Schwarzes Brett“. Er darf **nicht** im Galerieordner liegen.
4. Die ID steht jeweils in der Adresse nach `/folders/`. Notiere beide IDs.

### 3. Apps Script anlegen
1. In der Google-Tabelle auf **Erweiterungen → Apps Script** gehen.
2. Den gesamten Inhalt von `apps-script/Code.gs` in die Datei `Code.gs` kopieren und dabei alles ersetzen.
3. Links auf **Projekteinstellungen** (Zahnrad) gehen und **„Manifestdatei appsscript.json im Editor anzeigen“** anhaken. Danach den Inhalt von `apps-script/appsscript.json` in diese Datei kopieren.

### 4. Script Properties eintragen
Unter **Projekteinstellungen → Script-Attribute** die folgenden Einträge anlegen:

| Attribut | Wert |
|---|---|
| `SHEET_ID` | ID der Tabelle aus Schritt 1 |
| `FOTO_ORDNER_ID` | ID des Galerieordners |
| `BRETT_ORDNER_ID` | ID des Ordners für das Schwarze Brett |
| `KALENDER_ICS_URL` | Privater iCal-Export-Link aus kalender.digital (Einstellungen → Export/Abonnieren, endet auf `privat.ics?…`) |
| `BLUETTI_URL` | `http://mgi-ism.ddns.net:8080` |
| `OEFFENTLICH` | `true`: Kalender, Wetter, Webcam und Ergebnisse sind auch ohne Anmeldung sichtbar. `false`: nur mit Anmeldung |
| `ERSTER_ADMIN` | `Vorname;Nachname;PIN`, z. B. `Joachim;Rodler;482913`. Der PIN muss 4–8 Ziffern haben. **Nach Schritt 5 wieder löschen!** |
| `APP_URL` | Adresse der fertigen App aus Schritt 7. Nur für Push nötig, kann später eingetragen werden |

Diese Attribute sind optional:

| Attribut | Wert |
|---|---|
| `BLUETTI_USER`, `BLUETTI_PASS` | Nur nötig, wenn in der ESP32-Firmware `ENABLE_AUTH = true` gesetzt ist |
| `THINGSPEAK_KANAL` | Kanal-ID für das Verlaufsdiagramm. Leer lassen, dann wird kein Verlauf angezeigt |
| `THINGSPEAK_READ_KEY` | Nur bei einem privaten ThingSpeak-Kanal |
| `FCM_SERVICE_ACCOUNT` | Für Push-Nachrichten, siehe Schritt 9 |

> Der Kalender-Link ist privat. Er gehört **nur** hierher, nie in den App-Code oder ins Repository.

### 5. `setup()` ausführen
1. Im Apps-Script-Editor oben die Funktion **`setup`** auswählen und auf **Ausführen** klicken.
2. Google fragt nach Berechtigungen. Das Konto auswählen, dann **„Erweitert“ → „Zu … wechseln (unsicher)“ → „Zulassen“**. Die Warnung erscheint bei jedem eigenen Script und ist hier normal.
3. Danach existieren alle Tabellenblätter, der erste Admin ist angelegt und die täglichen und stündlichen Trigger laufen.
4. **`ERSTER_ADMIN` jetzt aus den Script-Attributen löschen.**

### 6. Als Web-App bereitstellen
1. Rechts oben auf **Bereitstellen → Neue Bereitstellung** gehen, beim Typ das Zahnrad anklicken und **Web-App** wählen.
2. Bei **Ausführen als** „Ich“ wählen, bei **Zugriff** „Jeder“.
3. Auf **Bereitstellen** klicken und die **Web-App-URL** kopieren. Sie endet auf `/exec`.
4. Wenn du `Code.gs` später änderst, gehst du auf **Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → Version: Neue Version**. Dadurch bleibt die URL gleich.

### 7. App veröffentlichen (GitHub Pages)
1. In `app/src/config.ts` bei `apiUrl` die Web-App-URL aus Schritt 6 eintragen. Die anderen `TODO`-Werte ausfüllen, siehe „Offene Punkte“ unten.
2. Committen und auf `main` pushen.
3. Im Repository auf **Settings → Pages → Source: „GitHub Actions“** stellen.
4. Der Workflow `.github/workflows/deploy.yml` baut die App und veröffentlicht sie. Danach ist sie unter `https://<benutzer>.github.io/<repo>/` erreichbar.
5. Diese Adresse in den Script-Attributen als `APP_URL` eintragen.

> GitHub Pages ist auch bei privaten Repositories öffentlich erreichbar, bei kostenlosen Konten muss das Repository dafür öffentlich sein. Das ist kein Problem, weil im Code keine Geheimnisse stehen. Alles Geheime liegt in den Script-Attributen.

### 8. Galerie in Google Sites einbinden
1. Die Vereins-Homepage in Google Sites öffnen und rechts **Einfügen → Drive** wählen.
2. Den Galerieordner aus Schritt 2 auswählen und einfügen, dann auf **Veröffentlichen** klicken.
3. Neue Fotos aus der App erscheinen danach **automatisch** auf der Homepage. Die App legt dafür Unterordner nach Jahr und Monat an, z. B. `2026/11`.

### 9. Push-Nachrichten (optional)
1. Auf [console.firebase.google.com](https://console.firebase.google.com) ein Projekt anlegen, z. B. „mgi-app“. Google Analytics wird nicht gebraucht.
2. Unter **Projekteinstellungen → Allgemein → Meine Apps** eine **Web-App** hinzufügen. Die angezeigten Werte (`apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`) in `config.ts` unter `firebase` eintragen.
3. Unter **Projekteinstellungen → Cloud Messaging → Web-Push-Zertifikate** auf **Schlüsselpaar generieren** klicken. Den Schlüssel bei `vapidKey` in `config.ts` eintragen.
4. Unter **Projekteinstellungen → Dienstkonten** auf **Neuen privaten Schlüssel generieren** klicken. Den **kompletten Inhalt** der JSON-Datei als Script-Attribut `FCM_SERVICE_ACCOUNT` eintragen. Die Datei danach sicher löschen.
5. Die App neu veröffentlichen. Jedes Mitglied schaltet Push unter **Mehr → Mein Konto** selbst ein.
6. **iPhone:** Push funktioniert erst, wenn die App über *Teilen → Zum Home-Bildschirm* installiert ist (ab iOS 16.4).

### 10. Auf dem Handy installieren
- **Android (Chrome):** Die App-Adresse öffnen und im Menü **„App installieren“** bzw. **„Zum Startbildschirm hinzufügen“** wählen.
- **iPhone (Safari):** Die App-Adresse öffnen und **Teilen-Symbol → „Zum Home-Bildschirm“** wählen.

---

## Offene Punkte (in `app/src/config.ts`)

- [ ] `arbeitsdienstUrl`: Link zur Arbeitsdienst-Seite oder -Liste
- [ ] `platz.lat`, `platz.lon`, `platz.adresse`, `platz.zufahrt`: genaue Koordinaten und Zufahrt des Flugplatzes, danach `koordinatenGeprueft: true` setzen
- [ ] `impressumUrl`, `datenschutzUrl`: Links zu Impressum und Datenschutzerklärung der Homepage
- [ ] ThingSpeak-Kanal (Script-Attribut `THINGSPEAK_KANAL`) für das Verlaufsdiagramm
- [ ] Firebase-Werte für Push (Schritt 9)
- [ ] In der App unter **Verwaltung → Einstellungen** die Platzordnung, Notfall-Infos und Kontakte eintragen

## Bekannte Grenzen

- **Wettermonster** bietet keine offene Schnittstelle und sperrt automatische Abrufe. Die App zeigt deshalb Wind und Vorhersage von **Open-Meteo** für die Platz-Koordinaten an und verlinkt die Vereins-Wetterstation.
- **Webcam:** Das Standbild und der Player kommen direkt von IPCamLive. Falls IPCamLive die Adressen ändert, müssen sie in `config.ts` unter `webcam` angepasst werden.
- **Bluetti:** Der ESP32 ist per `http` erreichbar. Deshalb ruft das Apps Script die Werte ab und gibt sie per `https` an die App weiter. Ist der ESP32 offline, zeigt die App den letzten bekannten Wert. Sicherheitshinweis: Die Firmware hat den Passwortschutz ausgeschaltet (`ENABLE_AUTH = false`), daher kann jeder im Internet `/api/status` lesen. Schalten kann man darüber nichts.
- **PDF-Export** läuft über die Druckfunktion des Browsers. Dort „Als PDF speichern“ wählen.

## Entwicklung

```bash
cd app
npm install
npm run dev        # Entwicklungsserver (Demo-Modus, solange apiUrl leer ist)
npm test           # Unit-Tests der Formel-Engine und Auswertung
npm run build      # Produktions-Build nach app/dist

node apps-script/test/ics.test.mjs       # Tests des Kalender-Parsers im Backend (vom Repo-Hauptordner aus)
node apps-script/test/backend.test.mjs   # Ablauftest Backend: Anfrage, Freigabe, Login, Flugbuch
VITE_DEMO=1 npm run dev                  # App mit Beispieldaten statt echtem Backend
```

## Weitere Anleitungen
- [Anleitung für Mitglieder](docs/Anleitung-Mitglieder.md)
- [Anleitung für Admins und Formeln](docs/Anleitung-Admins.md)
- [Google-Tabelle: Aufbau](docs/Google-Sheet-Vorlage.md)
