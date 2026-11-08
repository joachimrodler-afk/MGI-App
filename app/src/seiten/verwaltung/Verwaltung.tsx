import { NurMitglied } from '../../components/Anmelden';
import { Seite, useLaden, Zeile } from '../../components/ui';
import { api } from '../../lib/api';
import type { Anfrage } from '../../lib/model';

function Inhalt() {
  const { daten } = useLaden(() => api<Anfrage[]>('anfragen_liste'));
  const anzahl = daten?.length ?? 0;
  return (
    <div className="karte divide-y divide-himmel-100 overflow-hidden dark:divide-slate-700">
      <Zeile zu="/verwaltung/mitglieder" icon="personen" titel="Mitglieder & PINs" text="Zugangsanfragen, anlegen, PIN zurücksetzen"
        rechts={anzahl > 0 ? <span className="rounded-full bg-mgi-rot px-2.5 py-0.5 text-xs font-bold text-white">{anzahl} neu</span> : undefined} />
      <Zeile zu="/verwaltung/flugbuch" icon="flieger" titel="Flugbuch-Übersicht" text="Alle Einträge, Export, Google-Tabelle" />
      <Zeile zu="/wettbewerbe/neu" icon="pokal" titel="Neuer Wettbewerb" />
      <Zeile zu="/verwaltung/wertungsarten" icon="stift" titel="Wertungsarten & Formeln" text="Kunstflug, Segelflug, Limbo, Ballonstechen …" />
      <Zeile zu="/verwaltung/einstellungen" icon="zahnrad" titel="Einstellungen" text="Platzordnung, Notfall, Windgrenzen, Auto-Abmeldung" />
      <Zeile zu="/verwaltung/mitteilung" icon="glocke" titel="Mitteilung senden" text="Push an alle, z. B. Platzsperrung" />
      <Zeile zu="/verwaltung/changelog" icon="stift" titel="Changelog" text="Was sich an der App geändert hat" />
    </div>
  );
}

export default function Verwaltung() {
  return (
    <Seite titel="Verwaltung">
      <NurMitglied admin><Inhalt /></NurMitglied>
    </Seite>
  );
}
