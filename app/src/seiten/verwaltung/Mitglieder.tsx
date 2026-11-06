import { useState } from 'react';
import { NurMitglied } from '../../components/Anmelden';
import { Icon } from '../../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Laden, Seite, useLaden } from '../../components/ui';
import { api } from '../../lib/api';
import { klassen } from '../../lib/helfer';
import type { Mitglied } from '../../lib/model';
import { useSitzung } from '../../lib/sitzung';

function PinAnzeige({ name, pin, schliessen }: { name: string; pin: string; schliessen: () => void }) {
  const text = `Hallo ${name.split(' ')[0]}, dein Zugang zur MGI-App:\nName: ${name}\nPIN: ${pin}\n\nBitte ändere den PIN nach der ersten Anmeldung unter „Mein Konto“.`;
  return (
    <div className="karte space-y-3 border-2 border-sonne p-4">
      <p className="font-bold">PIN für {name}</p>
      <p className="rounded-xl bg-himmel-50 py-3 text-center font-mono text-4xl font-extrabold tracking-[0.3em] dark:bg-slate-800">{pin}</p>
      <Hinweis art="warnung">Der PIN wird nur jetzt angezeigt und nirgends im Klartext gespeichert. Gib ihn direkt weiter.</Hinweis>
      <div className="grid grid-cols-2 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 font-semibold text-white">WhatsApp</a>
        <a href={`mailto:?subject=${encodeURIComponent('Dein Zugang zur MGI-App')}&body=${encodeURIComponent(text)}`} className="flex min-h-12 items-center justify-center rounded-xl bg-himmel-600 font-semibold text-white">E-Mail</a>
      </div>
      <Knopf art="leise" className="w-full" onClick={schliessen}>Fertig</Knopf>
    </div>
  );
}

function Inhalt() {
  const s = useSitzung()!;
  const { daten, fehler, laedt, neu } = useLaden(() => api<Mitglied[]>('mitglieder_liste'));
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [rolle, setRolle] = useState<'mitglied' | 'admin'>('mitglied');
  const [sparte, setSparte] = useState<'flug' | 'schiff' | ''>('flug');
  const [pin, setPin] = useState<{ name: string; pin: string } | null>(null);
  const [fehler2, setFehler2] = useState('');
  const [arbeitet, setArbeitet] = useState(false);
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState(false);

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setArbeitet(true); setFehler2('');
    try {
      const r = await api<{ pin: string }>('mitglied_anlegen', { vorname, nachname, rolle, sparte });
      setPin({ name: `${vorname} ${nachname}`, pin: r.pin });
      setVorname(''); setNachname(''); setRolle('mitglied'); setOffen(false);
      void neu();
    } catch (err) { setFehler2((err as Error).message); } finally { setArbeitet(false); }
  }
  async function zuruecksetzen(m: Mitglied) {
    if (!confirm(`Neuen PIN für ${m.vorname} ${m.nachname} erzeugen? Der alte PIN ist dann ungültig.`)) return;
    try {
      const r = await api<{ pin: string }>('pin_zuruecksetzen', { id: m.id });
      setPin({ name: `${m.vorname} ${m.nachname}`, pin: r.pin });
    } catch (err) { setFehler2((err as Error).message); }
  }
  async function aendern(m: Mitglied, d: Partial<Mitglied>) {
    try { await api('mitglied_aendern', { id: m.id, ...d }); void neu(); } catch (err) { setFehler2((err as Error).message); }
  }

  const liste = (daten ?? []).filter((m) => `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase()));

  return (
    <div className="space-y-4">
      {pin && <PinAnzeige {...pin} schliessen={() => setPin(null)} />}
      {!offen ? (
        <Knopf className="w-full" onClick={() => setOffen(true)}><Icon name="plus" /> Mitglied anlegen</Knopf>
      ) : (
        <form onSubmit={anlegen} className="karte space-y-3 p-4">
          <h2 className="font-bold">Neues Mitglied</h2>
          <div className="grid grid-cols-2 gap-3">
            <Feld label="Vorname"><input className="eingabe" required value={vorname} onChange={(e) => setVorname(e.target.value)} /></Feld>
            <Feld label="Nachname"><input className="eingabe" required value={nachname} onChange={(e) => setNachname(e.target.value)} /></Feld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Feld label="Rolle">
              <select className="eingabe" value={rolle} onChange={(e) => setRolle(e.target.value as 'mitglied' | 'admin')}>
                <option value="mitglied">Mitglied</option><option value="admin">Admin</option>
              </select>
            </Feld>
            <Feld label="Sparte">
              <select className="eingabe" value={sparte} onChange={(e) => setSparte(e.target.value as 'flug' | 'schiff' | '')}>
                <option value="flug">Flugmodellbau</option><option value="schiff">Schiffsmodellbau</option><option value="">–</option>
              </select>
            </Feld>
          </div>
          <div className="flex gap-2">
            <Knopf type="button" art="sekundaer" className="flex-1" onClick={() => setOffen(false)}>Abbrechen</Knopf>
            <Knopf type="submit" className="flex-1" laedt={arbeitet}>Anlegen & PIN erzeugen</Knopf>
          </div>
        </form>
      )}
      {fehler2 && <Fehler fehler={fehler2} />}
      <input className="eingabe" placeholder="Suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} aria-label="Mitglieder suchen" />
      {laedt && !daten && <Laden />}
      {fehler && <Fehler fehler={fehler} nochmal={neu} />}
      <div className="karte divide-y divide-himmel-100 dark:divide-slate-700">
        {liste.map((m) => (
          <details key={m.id} className={klassen('group', !m.aktiv && 'opacity-60')}>
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2">
              <span className="flex-1">
                <span className="block font-semibold">{m.vorname} {m.nachname}{m.id === s.mitgliedId && ' (du)'}</span>
                <span className="block text-sm text-slate-500">{m.rolle === 'admin' ? 'Admin' : 'Mitglied'}{m.sparte ? ` · ${m.sparte === 'flug' ? 'Flug' : 'Schiff'}` : ''}{!m.aktiv && ' · deaktiviert'}</span>
              </span>
              <Icon name="rechts" className="h-5 w-5 text-slate-400 transition group-open:rotate-90" />
            </summary>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <Knopf art="sekundaer" onClick={() => zuruecksetzen(m)}>Neuer PIN</Knopf>
              <Knopf art="sekundaer" disabled={m.id === s.mitgliedId} onClick={() => aendern(m, { rolle: m.rolle === 'admin' ? 'mitglied' : 'admin' })}>
                {m.rolle === 'admin' ? 'Admin entziehen' : 'Zum Admin machen'}
              </Knopf>
              <Knopf art={m.aktiv ? 'gefahr' : 'sekundaer'} className="col-span-2" disabled={m.id === s.mitgliedId}
                onClick={() => aendern(m, { aktiv: !m.aktiv })}>
                {m.aktiv ? 'Deaktivieren (z. B. bei Austritt)' : 'Wieder aktivieren'}
              </Knopf>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default function Mitglieder() {
  return <Seite titel="Mitglieder & PINs"><NurMitglied admin><Inhalt /></NurMitglied></Seite>;
}
