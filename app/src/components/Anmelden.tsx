import { useState, type ReactNode } from 'react';
import { api, speichereSitzung } from '../lib/api';
import type { Sitzung } from '../lib/model';
import { useSitzung } from '../lib/sitzung';
import { istDemo } from '../config';
import { Feld, Hinweis, Knopf } from './ui';
import { Icon } from './Icon';

export function LoginFormular({ text }: { text?: string }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [fehler, setFehler] = useState('');
  const [laedt, setLaedt] = useState(false);

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
