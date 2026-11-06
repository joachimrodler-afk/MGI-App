import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { klassen } from '../lib/helfer';

/** Seitenrahmen mit Titel und optionalem Zurück-Pfeil */
export function Seite({ titel, children, zurueck = true, aktion }: { titel: string; children: ReactNode; zurueck?: boolean; aktion?: ReactNode }) {
  const nav = useNavigate();
  useEffect(() => {
    document.title = `${titel} – MGI`;
  }, [titel]);
  return (
    <div className="mx-auto max-w-2xl px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center gap-2">
        {zurueck && (
          <button onClick={() => nav(-1)} className="nicht-drucken -ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-himmel-100 dark:hover:bg-slate-800" aria-label="Zurück">
            <Icon name="zurueck" />
          </button>
        )}
        <h1 className="flex-1 text-2xl font-bold tracking-tight">{titel}</h1>
        {aktion}
      </div>
      {children}
    </div>
  );
}

type KnopfArt = 'primaer' | 'sekundaer' | 'gefahr' | 'leise';
export function Knopf({ art = 'primaer', className, children, laedt, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { art?: KnopfArt; laedt?: boolean }) {
  const stil: Record<KnopfArt, string> = {
    primaer: 'bg-mgi-rot text-white hover:bg-mgi-rot-dunkel shadow-sm',
    sekundaer: 'bg-white text-himmel-700 ring-1 ring-himmel-300 hover:bg-himmel-50 dark:bg-slate-800 dark:text-himmel-200 dark:ring-slate-600',
    gefahr: 'bg-white text-mgi-rot ring-1 ring-red-300 hover:bg-red-50 dark:bg-slate-800',
    leise: 'text-himmel-700 hover:bg-himmel-100 dark:text-himmel-200 dark:hover:bg-slate-800',
  };
  return (
    <button
      {...rest}
      disabled={rest.disabled || laedt}
      className={klassen('inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition disabled:opacity-50', stil[art], className)}
    >
      {laedt && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Laden({ text = 'Lädt …' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-himmel-500 border-t-transparent" />
      {text}
    </div>
  );
}

export function Hinweis({ art = 'info', children }: { art?: 'info' | 'fehler' | 'ok' | 'warnung'; children: ReactNode }) {
  const stil = {
    info: 'bg-himmel-100 text-himmel-900 dark:bg-himmel-900/40 dark:text-himmel-100',
    fehler: 'bg-red-50 text-red-800 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900',
    ok: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
    warnung: 'bg-sonne-hell text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900',
  }[art];
  return <div className={klassen('rounded-xl px-4 py-3 text-sm leading-relaxed', stil)} role={art === 'fehler' ? 'alert' : undefined}>{children}</div>;
}

export function Fehler({ fehler, nochmal }: { fehler: string; nochmal?: () => void }) {
  return (
    <Hinweis art="fehler">
      <div className="flex items-center justify-between gap-3">
        <span>{fehler}</span>
        {nochmal && <button onClick={nochmal} className="shrink-0 font-semibold underline">Nochmal</button>}
      </div>
    </Hinweis>
  );
}

/** Lädt Daten und liefert {daten, fehler, laedt, neu} */
export function useLaden<T>(fn: () => Promise<T>, abh: unknown[] = []) {
  const [daten, setDaten] = useState<T | null>(null);
  const [fehler, setFehler] = useState('');
  const [laedt, setLaedt] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const neu = useCallback(async () => {
    setLaedt(true);
    setFehler('');
    try {
      setDaten(await fnRef.current());
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setLaedt(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, abh);
  useEffect(() => {
    void neu();
  }, [neu]);
  return { daten, setDaten, fehler, laedt, neu };
}

export function ExternerLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function Feld({ label, children, hilfe }: { label: string; children: ReactNode; hilfe?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hilfe && <span className="mt-1 block text-xs text-slate-500">{hilfe}</span>}
    </label>
  );
}

export function Leer({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-slate-500">{children}</p>;
}

export function Zeile({ zu, icon, titel, text, rechts }: { zu: string; icon?: string; titel: string; text?: string; rechts?: ReactNode }) {
  return (
    <Link to={zu} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-himmel-50 dark:hover:bg-slate-800">
      {icon && <Icon name={icon} className="h-6 w-6 text-himmel-600" />}
      <span className="flex-1">
        <span className="block font-semibold">{titel}</span>
        {text && <span className="block text-sm text-slate-500">{text}</span>}
      </span>
      {rechts}
      <Icon name="rechts" className="h-5 w-5 text-slate-400" />
    </Link>
  );
}

export function Schalter({ an, onChange, label, text }: { an: boolean; onChange: (v: boolean) => void; label: string; text?: string }) {
  return (
    <button type="button" role="switch" aria-checked={an} onClick={() => onChange(!an)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        {text && <span className="block text-sm text-slate-500">{text}</span>}
      </span>
      <span className={klassen('relative h-7 w-12 shrink-0 rounded-full transition', an ? 'bg-himmel-600' : 'bg-slate-300 dark:bg-slate-600')}>
        <span className={klassen('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition', an ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
