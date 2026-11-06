import { useState, type ReactNode } from 'react';
import { api, speichereSitzung } from '../lib/api';
import type { Sitzung } from '../lib/model';
import { useSitzung } from '../lib/sitzung';
import { istDemo } from '../config';
import { Feld, Hinweis, Knopf } from './ui';
import { Icon } from './Icon';

/** Zugang anfragen: Name eingeben, ein Admin gibt frei und schickt den PIN */
function ZugangAnfragen({ zurueck }: { zurueck: () => void }) {
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [nachricht, setNachricht] = useState('');
  const [fehler, setFehler] = useState('');
  const [laedt, setLaedt] = useState(false);
  const [fertig, setFertig] = useState(false);

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    setLaedt(true);
    setFehler('');
    try {
      await api('zugang_anfragen', { vorname, nachname, nachricht });
      setFertig(true);
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaedt(false);
    }
  }

  if (fertig) {
    return (
      <div className="karte space-y-4 p-5">
        <Hinweis art="ok">
          Danke, {vorname}! Deine Anfrage ist beim Vorstand angekommen. Sobald sie freigegeben ist, bekommst du deinen persönlichen PIN per WhatsApp oder E-Mail.
        </Hinweis>
        <Knopf art="sekundaer" className="w-full" onClick={zurueck}>Zur Anmeldung</Knopf>
      </div>
    );
  }

  return (
    <form onSubmit={senden} className="karte space-y-4 p-5">
      <div>
        <h2 className="font-bold">Zugang anfragen</h2>
        <p className="text-sm text-slate-500">Für Mitglieder der MGI. Ein Admin prüft deine Anfrage und schickt dir deinen persönlichen PIN.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Feld label="Vorname"><input className="eingabe" required value={vorname} onChange={(e) => setVorname(e.target.value)} autoComplete="given-name" /></Feld>
        <Feld label="Nachname"><input className="eingabe" required value={nachname} onChange={(e) => setNachname(e.target.value)} autoComplete="family-name" /></Feld>
      </div>
      <Feld label="Nachricht an den Vorstand (optional)" hilfe="z. B. deine Handynummer für den PIN per WhatsApp">
        <input className="eingabe" value={nachricht} onChange={(e) => setNachricht(e.target.value)} maxLength={200} />
      </Feld>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" laedt={laedt} className="w-full">Anfrage senden</Knopf>
      <button type="button" onClick={zurueck} className="w-full text-center text-sm font-semibold text-himmel-700 dark:text-himmel-300">Ich habe schon einen PIN</button>
    </form>
  );
}

export function LoginFormular({ text }: { text?: string }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [fehler, setFehler] = useState('');
  const [laedt, setLaedt] = useState(false);
  const [anfrage, setAnfrage] = useState(false);

  async function los(e: React.FormEvent) {
    e.preventDefault();
    setLaedt(true);
    setFehler('');
    try {
      const s = await api<Sitzung>('login', { name, pin });
      speichereSitzung(s);
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaedt(false);
    }
  }

  if (anfrage) return <ZugangAnfragen zurueck={() => setAnfrage(false)} />;

  return (
    <form onSubmit={los} className="karte space-y-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-himmel-100 text-himmel-700 dark:bg-slate-800">
          <Icon name="schloss" />
        </span>
        <div>
          <h2 className="font-bold">Anmelden</h2>
          <p className="text-sm text-slate-500">{text ?? 'Einmal mit Namen und persönlichem PIN – danach bleibst du auf diesem Gerät angemeldet.'}</p>
        </div>
      </div>
      <Feld label="Vor- und Nachname">
        <input className="eingabe" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" required placeholder="z. B. Max Muster" />
      </Feld>
      <Feld label="PIN">
        <input className="eingabe tracking-[0.4em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
          type="password" autoComplete="current-password" required maxLength={8} placeholder="••••••" />
      </Feld>
      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      {istDemo && <Hinweis>Demo: „Demo Admin“ mit PIN 123456 oder „Max Muster“ mit PIN 111111.</Hinweis>}
      <Knopf type="submit" laedt={laedt} className="w-full">Anmelden</Knopf>
      <div className="border-t border-himmel-100 pt-3 text-center dark:border-slate-700">
        <p className="text-sm text-slate-500">Noch keinen PIN?</p>
        <button type="button" onClick={() => setAnfrage(true)} className="mt-1 min-h-11 font-semibold text-mgi-rot">Zugang anfragen</button>
      </div>
      <p className="text-center text-xs text-slate-500">PIN vergessen? Bitte beim Vorstand melden – er kann ihn zurücksetzen.</p>
    </form>
  );
}

/** Zeigt den Inhalt nur angemeldeten Mitgliedern (bzw. Admins), sonst das Login */
export function NurMitglied({ children, admin = false, text }: { children: ReactNode; admin?: boolean; text?: string }) {
  const s = useSitzung();
  if (!s) return <LoginFormular text={text} />;
  if (admin && s.rolle !== 'admin') return <Hinweis art="warnung">Dieser Bereich ist nur für Admins (Vorstand und Wertungsrichter).</Hinweis>;
  return <>{children}</>;
}
