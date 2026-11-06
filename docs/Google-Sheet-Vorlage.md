# Google-Tabelle: Aufbau

`setup()` im Apps Script legt alle Blätter mit den passenden Spaltenköpfen automatisch an. Neue Blätter aus späteren Updates (z. B. Flugbuch) legt das Script beim ersten Gebrauch selbst an. Diese Übersicht dient nur zur Orientierung.

> **Bitte nichts von Hand ändern.** Am wichtigsten: keine Spalten verschieben und keine Zeilen sortieren. Die Daten in den `json`-Spalten werden von der App geschrieben.

| Blatt | Spalten | Inhalt |
|---|---|---|
| **Mitglieder** | `id`, `vorname`, `nachname`, `rolle` (mitglied/admin), `sparte` (flug/schiff), `salt`, `hash`, `aktiv` (true/false), `erstellt` | Mitglieder. Der PIN steht **nur als Hash** darin |
| **Sitzungen** | `token`, `mitgliedId`, `ablauf` (ms) | Anmeldungen. Sie laufen nicht ab; sie enden durch Abmelden, neuen PIN oder Deaktivieren. Sitzungen deaktivierter Mitglieder löscht der tägliche Trigger |
| **Einstellungen** | `schluessel`, `wert` (JSON) | Platzordnung, Notfall-Infos, Kontakte, Windgrenzen, Datenschutztext, Check-in-Dauer |
| **Wertungsarten** | `id`, `json` | Wertungsarten mit Feldern, Konstanten, Formel und Version |
| **Wettbewerbe** | `id`, `json` | Wettbewerbe mit Teilnehmern und einer Kopie der Wertungsart |
| **Wertungen** | `id`, `wettbewerbId`, `json` | Eingaben je Teilnehmer und Durchgang |
| **Flugbuch** | `id`, `datum`, `name`, `vorname`, `verein_gast`, `kanal`, `schulungsnachweis`, `segler`, `elektro`, `kolben`, `turbine`, `max_masse`, `beginn`, `ende`, `regeln_bestaetigt`, `eingetragen_von`, … | Elektronisches Flugbuch (wie der Papiervordruck; die Spalte `kanal` wird nicht mehr abgefragt und bleibt leer). `beginn`/`ende` = Uhrzeit An-/Abmeldung, `auto_beendet` = automatisch abgemeldet |
| **Flugleiter** | `id`, `datum`, `name`, `vorname`, `fangnetz`, `rasen_gemaeht`, `wetter`, `windrichtung`, `windstaerke`, `beginn`, `ende`, … | Modellflugleiter mit Flugbedingungen |
| **Anfragen** | `id`, `vorname`, `nachname`, `nachricht`, `erstellt`, `status`, `bearbeitet` | Zugangsanfragen (offen/freigegeben/abgelehnt) |
| **CheckIns** | – | Nicht mehr benutzt (ersetzt durch das Flugbuch), kann gelöscht werden |
| **Brett** | `id`, `ablauf`, `json` | Beiträge vom Schwarzen Brett |
| **Nachweise** | `mitgliedId`, `name`, `kenntnisnachweis`, `eid`, `versicherung`, `gemeldet` | Nur die Ablaufdaten, keine Nummern |
| **PushAbos** | `fcmToken`, `mitgliedId`, `einstellungen` (JSON), `erstellt` | Geräte mit eingeschaltetem Push |

**Zugriff:** Die Tabelle sollte nur dem Vereinskonto gehören und **nicht** geteilt werden. Wer sie öffnen kann, sieht z. B. die Nachweis-Ablaufdaten und die Push-Abos.
