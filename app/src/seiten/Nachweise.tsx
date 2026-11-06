import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NurMitglied } from '../components/Anmelden';
import { Feld, Fehler, Hinweis, Knopf, Laden, Seite, useLaden } from '../components/ui';
import { api } from '../lib/api';
import { klassen } from '../lib/helfer';
import type { Nachweise as N } from '../lib/model';
import { pushStatus } from '../lib/push';
import { useSitzung } from '../lib/sitzung';

const EID_KEY = 'mgi.eid-nummer';

const FELDER: { key: keyof N; name: string; hilfe: string }[] = [
  { key: 'kenntnisnachweis', name: 'Kenntnisnachweis', hilfe: 'EU-Drohnenführerschein A1/A3 oder Kenntnisnachweis des Verbands – Ablaufdatum' },
  { key: 'eid', name: 'e-ID / Betreiber-Registrierung (LBA)', hilfe: 'Ablaufdatum der Registrierung beim Luftfahrt-Bundesamt' },
  { key: 'versicherung', name: 'Versicherung', hilfe: 'Ende des Versicherungsschutzes (Modellflug-Haftpflicht)' },
];

function status(datum?: string) {
  if (!datum) return null;
  const tage = Math.round((new Date(datum).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (tage < 0) return { text: 'abgelaufen', farbe: 'bg-mgi-rot text-white' };
  if (tage <= 30) return { text: `noch ${tage} Tage`, farbe: 'bg-sonne text-tinte' };
  return { text: 'gültig', farbe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' };
}

function Inhalt() {
  const s = useSitzung()!;
  const { daten, fehler, laedt, neu } = useLaden(() => api<N>('nachweise'), [s.token]);
  const [werte, setWerte] = useState<N>({});
  const [eid, setEid] = useState(() => localStorage.getItem(EID_KEY) ?? '');
  const [gespeichert, setGespeichert] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler2, setFehler2] = useState('');
  useEffect(() => { if (daten) setWerte(daten); }, [daten]);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setSendet(true);
    setFehler2('');
    try {
      setWerte(await api<N>('nachweise_speichern', { ...werte }));
      localStorage.setItem(EID_KEY, eid);
      setGespeichert(true);
      setTimeout(() => setGespeichert(false), 3000);
    } catch (err) {
      setFehler2((err as Error).message);
    } finally {
      setSendet(false);
    }
  }

  if (laedt && !daten) return <Laden />;
  return (
    <form onSubmit={speichern} className="space-y-4">
      {fehler && <Fehler fehler={fehler} nochmal={neu} />}
      {FELDER.map((f) => {
        const st = status(werte[f.key]);
        return (
          <div key={f.key} className="karte p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-bold">{f.name}</h2>
              {st && <span className={klassen('rounded-full px-2.5 py-0.5 text-xs font-bold', st.farbe)}>{st.text}</span>}
            </div>
            <Feld label="Gültig bis" hilfe={f.hilfe}>
              <input type="date" className="eingabe" value={werte[f.key] ?? ''} onChange={(e) => setWerte({ ...werte, [f.key]: e.target.value })} />
            </Feld>
          </div>
        );
      })}
      <div className="karte p-4">
        <Feld label="Meine e-ID-Nummer (Notiz für den Modell-Aufkleber)" hilfe="Wird nur auf diesem Gerät gespeichert, nicht beim Verein.">
          <input className="eingabe font-mono" value={eid} onChange={(e) => setEid(e.target.value.toUpperCase())} placeholder="DEU…" maxLength={30} />
        </Feld>
      </div>
      {fehler2 && <Fehler fehler={fehler2} />}
      {gespeichert && <Hinweis art="ok">Gespeichert.</Hinweis>}
      <Knopf type="submit" className="w-full" laedt={sendet}>Speichern</Knopf>
      <Hinweis>
        Du bekommst 30 und 7 Tage vor Ablauf eine Push-Erinnerung{!pushStatus().token && <> – dafür bitte <Link to="/konto" className="font-semibold underline">Push-Nachrichten einschalten</Link></>}.
        Gespeichert werden nur die Ablaufdaten; die App zeigt sie keinem anderen Mitglied an.
      </Hinweis>
    </form>
  );
}

export default function Nachweise() {
  return (
    <Seite titel="Meine Nachweise">
      <NurMitglied><Inhalt /></NurMitglied>
    </Seite>
  );
}
