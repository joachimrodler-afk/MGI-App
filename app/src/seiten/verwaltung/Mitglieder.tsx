import { useState } from 'react';
import { NurMitglied } from '../../components/Anmelden';
import { Icon } from '../../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Laden, Seite, useLaden } from '../../components/ui';
import { api } from '../../lib/api';
import { klassen } from '../../lib/helfer';
import type { Anfrage, Mitglied } from '../../lib/model';
import { datumKurz } from '../../lib/helfer';
import { useSitzung } from '../../lib/sitzung';

function PinAnzeige({ name, pin, schliessen }: { name: string; pin: string; schliessen: () => void }) {
  // Adresse der App (funktioniert unter jeder Domain, z. B. GitHub Pages)
  const appLink = `${location.origin}${location.pathname}`;
  const text =
    `Hallo ${name.split(' ')[0]}, hier ist dein Zugang zur MGI-App:\n\n` +
    `👉 ${appLink}\n\n` +
    `Name: ${name}\nPIN: ${pin}\n\n` +
    `So geht's:\n` +
    `1. Link öffnen und die App auf den Startbildschirm legen\n` +
    `   – Android: Menü ⋮ → „App installieren“\n` +
    `   – iPhone: Teilen-Symbol → „Zum Home-Bildschirm“\n` +
    `2. App öffnen, oben aufs Schloss tippen, Name und PIN eingeben – du bleibst dann angemeldet.\n` +
    `3. Bitte den PIN danach unter „Mehr → Mein Konto“ ändern.`;
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

/** Offene Zugangsanfragen: freigeben (PIN erzeugen) oder ablehnen */
function Anfragen({ onPin, onNeu }: { onPin: (p: { name: string; pin: string }) => void; onNeu: () => void }) {
  const { daten, fehler, neu } = useLaden(() => api<Anfrage[]>('anfragen_liste'));
  const [arbeitet, setArbeitet] = useState('');
  const [fehler2, setFehler2] = useState('');
  if (fehler) return <Fehler fehler={fehler} nochmal={neu} />;
  if (!daten?.length) return null;

  async function freigeben(a: Anfrage, rolle: 'mitglied' | 'admin') {
    setArbeitet(a.id); setFehler2('');
    try {
      const r = await api<{ pin: string; vorname: string; nachname: string }>('anfrage_freigeben', { id: a.id, rolle, sparte: 'flug' });
      onPin({ name: `${r.vorname} ${r.nachname}`, pin: r.pin });
      void neu(); onNeu();
    } catch (err) { setFehler2((err as Error).message); } finally { setArbeitet(''); }
  }
  async function ablehnen(a: Anfrage) {
    if (!confirm(`Anfrage von ${a.vorname} ${a.nachname} ablehnen?`)) return;
    setArbeitet(a.id);
    try { await api('anfrage_ablehnen', { id: a.id }); void neu(); } finally { setArbeitet(''); }
  }

  return (
    <div className="karte overflow-hidden border-2 border-mgi-rot/40">
      <h2 className="bg-red-50 px-4 py-2 font-bold text-mgi-rot dark:bg-red-950/40">Offene Zugangsanfragen ({daten.length})</h2>
      {fehler2 && <div className="p-3"><Fehler fehler={fehler2} /></div>}
      <ul className="divide-y divide-himmel-100 dark:divide-slate-700">
        {daten.map((a) => (
          <li key={a.id} className="space-y-2 px-4 py-3">
            <div>
              <p className="font-semibold">{a.vorname} {a.nachname}</p>
              <p className="text-sm text-slate-500">{datumKurz(a.erstellt)}{a.nachricht ? ` · „${a.nachricht}“` : ''}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Knopf onClick={() => freigeben(a, 'mitglied')} laedt={arbeitet === a.id}><Icon name="haken" className="h-5 w-5" /> Freigeben</Knopf>
              <Knopf art="gefahr" onClick={() => ablehnen(a)} disabled={arbeitet === a.id}>Ablehnen</Knopf>
            </div>
          </li>
        ))}
      </ul>
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
  const [loeschFrage, setLoeschFrage] = useState('');
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
  async function loeschen(m: Mitglied) {
    try { await api('mitglied_loeschen', { id: m.id }); setLoeschFrage(''); void neu(); } catch (err) { setFehler2((err as Error).message); }
  }

  async function aendern(m: Mitglied, d: Partial<Mitglied>) {
    try { await api('mitglied_aendern', { id: m.id, ...d }); void neu(); } catch (err) { setFehler2((err as Error).message); }
  }

  const liste = (daten ?? []).filter((m) => `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase()));

  return (
    <div className="space-y-4">
      {pin && <PinAnzeige {...pin} schliessen={() => setPin(null)} />}
      <Anfragen onPin={setPin} onNeu={neu} />
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
          <details key={m.id} className="group">
            <summary className={klassen('flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2', !m.aktiv && 'opacity-60')}>
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
              {!m.aktiv && m.id !== s.mitgliedId && (loeschFrage === m.id ? (
                <div className="col-span-2 space-y-2 rounded-xl bg-red-50 p-3 text-sm dark:bg-red-950">
                  <p><b>{m.vorname} {m.nachname}</b> endgültig löschen? Anmeldungen, Push und Nachweise werden entfernt. Im Flugbuch, in der Arbeitsliste und bei Wertungen bleibt der Name stehen. Das lässt sich nicht rückgängig machen.</p>
                  <div className="flex gap-2">
                    <Knopf art="gefahr" className="flex-1 !min-h-10" onClick={() => void loeschen(m)}>Endgültig löschen</Knopf>
                    <Knopf art="sekundaer" className="!min-h-10" onClick={() => setLoeschFrage('')}>Abbrechen</Knopf>
                  </div>
                </div>
              ) : (
                <Knopf art="leise" className="col-span-2 text-mgi-rot" onClick={() => setLoeschFrage(m.id)}>
                  <Icon name="muell" className="h-5 w-5" /> Endgültig löschen
                </Knopf>
              ))}
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
