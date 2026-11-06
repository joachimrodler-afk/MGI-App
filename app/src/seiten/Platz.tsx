import { useState } from 'react';
import { NurMitglied } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Fehler, Knopf, Laden, Leer, Schalter, Seite, useLaden } from '../components/ui';
import { api } from '../lib/api';
import { useEinstellungen } from '../lib/einstellungen';
import { uhrzeit } from '../lib/helfer';
import type { CheckIn } from '../lib/model';
import { useSitzung } from '../lib/sitzung';

interface Anwesend { anzahl: number; flugleiter: boolean; liste: CheckIn[] }

function PlatzInhalt() {
  const s = useSitzung()!;
  const { einstellungen } = useEinstellungen();
  const { daten, setDaten, fehler, laedt, neu } = useLaden(() => api<Anwesend>('anwesende'), [s.token]);
  const [flugleiter, setFlugleiter] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler2, setFehler2] = useState('');
  const ich = daten?.liste.find((c) => c.mitgliedId === s.mitgliedId);

  async function aktion(a: 'checkin' | 'checkout') {
    setSendet(true);
    setFehler2('');
    try {
      setDaten(await api<Anwesend>(a, { flugleiter }));
    } catch (e) {
      setFehler2((e as Error).message);
    } finally {
      setSendet(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="karte p-4">
        {ich ? (
          <>
            <p className="mb-3 text-lg font-bold text-emerald-700 dark:text-emerald-400">
              <Icon name="haken" className="mr-1 inline h-6 w-6" /> Du bist seit {uhrzeit(ich.seit)} Uhr eingecheckt{ich.flugleiter ? ' als Flugleiter' : ''}.
            </p>
            <Knopf art="sekundaer" className="w-full" onClick={() => aktion('checkout')} laedt={sendet}>Auschecken</Knopf>
          </>
        ) : (
          <>
            <Schalter an={flugleiter} onChange={setFlugleiter} label="Ich bin heute Flugleiter" />
            <Knopf className="mt-2 w-full text-lg" onClick={() => aktion('checkin')} laedt={sendet}>
              <Icon name="flieger" /> Ich bin am Platz
            </Knopf>
          </>
        )}
        <p className="mt-2 text-center text-xs text-slate-500">Automatisches Auschecken nach {einstellungen.checkinStunden} Stunden. Kein Standort wird gespeichert.</p>
      </div>
      {fehler2 && <Fehler fehler={fehler2} />}

      <div className="karte">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="font-bold">Jetzt am Platz ({daten?.anzahl ?? 0})</h2>
          <button onClick={neu} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-himmel-100 dark:hover:bg-slate-800" aria-label="Aktualisieren"><Icon name="aktualisieren" className="h-5 w-5" /></button>
        </div>
        {laedt && !daten && <Laden />}
        {fehler && <div className="p-4"><Fehler fehler={fehler} nochmal={neu} /></div>}
        {daten && !daten.liste.length && <Leer>Gerade ist niemand eingecheckt.</Leer>}
        <ul className="divide-y divide-himmel-100 dark:divide-slate-700">
          {daten?.liste.slice().sort((a, b) => Number(b.flugleiter) - Number(a.flugleiter)).map((c) => (
            <li key={c.mitgliedId} className="flex items-center gap-3 px-4 py-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${c.flugleiter ? 'bg-sonne text-tinte' : 'bg-himmel-100 text-himmel-700 dark:bg-slate-800'}`}>
                {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-sm text-slate-500">seit {uhrzeit(c.seit)} Uhr</span>
              </span>
              {c.flugleiter && <span className="rounded-full bg-sonne px-3 py-1 text-xs font-bold text-tinte">Flugleiter</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Platz() {
  return (
    <Seite titel="Wer ist am Platz?">
      <NurMitglied text="Zum Einchecken und um zu sehen, wer da ist, bitte anmelden.">
        <PlatzInhalt />
      </NurMitglied>
    </Seite>
  );
}
