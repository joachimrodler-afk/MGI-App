import { NurMitglied } from '../../components/Anmelden';
import { Seite, Zeile } from '../../components/ui';

export default function Verwaltung() {
  return (
    <Seite titel="Verwaltung">
      <NurMitglied admin>
        <div className="karte divide-y divide-himmel-100 overflow-hidden dark:divide-slate-700">
          <Zeile zu="/verwaltung/mitglieder" icon="personen" titel="Mitglieder & PINs" text="Anlegen, PIN zurücksetzen, deaktivieren" />
          <Zeile zu="/wettbewerbe/neu" icon="pokal" titel="Neuer Wettbewerb" />
          <Zeile zu="/verwaltung/wertungsarten" icon="stift" titel="Wertungsarten & Formeln" text="Kunstflug, Segelflug, Limbo, Ballonstechen …" />
          <Zeile zu="/verwaltung/einstellungen" icon="zahnrad" titel="Einstellungen" text="Platzordnung, Notfall, Windgrenzen" />
          <Zeile zu="/verwaltung/mitteilung" icon="glocke" titel="Mitteilung senden" text="Push an alle, z. B. Platzsperrung" />
        </div>
      </NurMitglied>
    </Seite>
  );
}
