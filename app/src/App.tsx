import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { Icon } from './components/Icon';
import { Laden } from './components/ui';
import { istDemo } from './config';
import { klassen } from './lib/helfer';
import { useOnline, useSitzung } from './lib/sitzung';
import Start from './seiten/Start';
import Notfall from './seiten/Notfall';

// Seltener genutzte Seiten werden erst bei Bedarf geladen
const Kalender = lazy(() => import('./seiten/Kalender'));
const Wetter = lazy(() => import('./seiten/Wetter'));
const Webcam = lazy(() => import('./seiten/Webcam'));
const Strom = lazy(() => import('./seiten/Strom'));
const Foto = lazy(() => import('./seiten/Foto'));
const Wettbewerbe = lazy(() => import('./seiten/Wettbewerbe'));
const WettbewerbDetail = lazy(() => import('./seiten/WettbewerbDetail'));
const WettbewerbEingabe = lazy(() => import('./seiten/WettbewerbEingabe'));
const WettbewerbBearbeiten = lazy(() => import('./seiten/WettbewerbBearbeiten'));
const Platz = lazy(() => import('./seiten/Platz'));
const Brett = lazy(() => import('./seiten/Brett'));
const Nachweise = lazy(() => import('./seiten/Nachweise'));
const Mehr = lazy(() => import('./seiten/Mehr'));
const Konto = lazy(() => import('./seiten/Konto'));
const Verwaltung = lazy(() => import('./seiten/verwaltung/Verwaltung'));
const Mitglieder = lazy(() => import('./seiten/verwaltung/Mitglieder'));
const Wertungsarten = lazy(() => import('./seiten/verwaltung/Wertungsarten'));
const WertungsartEditor = lazy(() => import('./seiten/verwaltung/WertungsartEditor'));
const EinstellungenSeite = lazy(() => import('./seiten/verwaltung/Einstellungen'));
const Mitteilung = lazy(() => import('./seiten/verwaltung/Mitteilung'));

function Kopf() {
  const s = useSitzung();
  const online = useOnline();
  return (
    <header className="wolken sicher-oben nicht-drucken sticky top-0 z-30 text-white shadow-md">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
        <Link to="/" className="flex flex-1 items-center gap-2.5" aria-label="Startseite">
          <img src="logo-640.jpg" alt="" className="h-10 w-10 rounded-full bg-white ring-2 ring-white/70" />
          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-tight">MGI</span>
            <span className="block text-[11px] font-medium opacity-90">Modellbau-Gemeinschaft Ismaning</span>
          </span>
        </Link>
        <Link to="/konto" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label={s ? `Konto: ${s.name}` : 'Anmelden'}>
          <Icon name={s ? 'person' : 'schloss'} />
        </Link>
        <Link to="/notfall" className="flex h-11 items-center gap-1.5 rounded-full bg-mgi-rot px-3 font-bold shadow ring-2 ring-white/60" aria-label="Notfall">
          <Icon name="notfall" className="h-5 w-5" />
          <span className="text-sm">Notfall</span>
        </Link>
      </div>
      {(!online || istDemo) && (
        <div className={klassen('px-4 py-1 text-center text-xs font-semibold', !online ? 'bg-amber-400 text-amber-950' : 'bg-sonne text-tinte')}>
          {!online ? 'Offline – angezeigt wird der letzte bekannte Stand' : 'Demo-Modus – Beispieldaten, nichts wird wirklich gespeichert'}
        </div>
      )}
    </header>
  );
}

function Fuss() {
  const punkte: { zu: string; icon: string; text: string; ende?: boolean }[] = [
    { zu: '/', icon: 'start', text: 'Start', ende: true },
    { zu: '/kalender', icon: 'kalender', text: 'Termine' },
    { zu: '/foto', icon: 'kamera', text: 'Foto' },
    { zu: '/wettbewerbe', icon: 'pokal', text: 'Wertung' },
    { zu: '/mehr', icon: 'mehr', text: 'Mehr' },
  ];
  return (
    <nav className="sicher-unten nicht-drucken fixed inset-x-0 bottom-0 z-30 border-t border-himmel-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95" aria-label="Hauptnavigation">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {punkte.map((p) => (
          <NavLink key={p.zu} to={p.zu} end={p.ende}
            className={({ isActive }) => klassen('flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold',
              isActive ? 'text-mgi-rot' : 'text-slate-500 dark:text-slate-400')}>
            {p.zu === '/foto' ? (
              <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-mgi-rot text-white shadow-lg ring-4 ring-white dark:ring-slate-900">
                <Icon name="kamera" className="h-7 w-7" />
              </span>
            ) : (
              <Icon name={p.icon} />
            )}
            {p.text}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function Rahmen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-24">
      <Kopf />
      <main>{children}</main>
      <Fuss />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Rahmen>
        <Suspense fallback={<Laden />}>
          <Routes>
            <Route path="/" element={<Start />} />
            <Route path="/notfall" element={<Notfall />} />
            <Route path="/kalender" element={<Kalender />} />
            <Route path="/wetter" element={<Wetter />} />
            <Route path="/webcam" element={<Webcam />} />
            <Route path="/strom" element={<Strom />} />
            <Route path="/foto" element={<Foto />} />
            <Route path="/wettbewerbe" element={<Wettbewerbe />} />
            <Route path="/wettbewerbe/neu" element={<WettbewerbBearbeiten />} />
            <Route path="/wettbewerbe/:id" element={<WettbewerbDetail />} />
            <Route path="/wettbewerbe/:id/bearbeiten" element={<WettbewerbBearbeiten />} />
            <Route path="/wettbewerbe/:id/eingabe" element={<WettbewerbEingabe />} />
            <Route path="/platz" element={<Platz />} />
            <Route path="/brett" element={<Brett />} />
            <Route path="/nachweise" element={<Nachweise />} />
            <Route path="/mehr" element={<Mehr />} />
            <Route path="/konto" element={<Konto />} />
            <Route path="/verwaltung" element={<Verwaltung />} />
            <Route path="/verwaltung/mitglieder" element={<Mitglieder />} />
            <Route path="/verwaltung/wertungsarten" element={<Wertungsarten />} />
            <Route path="/verwaltung/wertungsarten/:id" element={<WertungsartEditor />} />
            <Route path="/verwaltung/einstellungen" element={<EinstellungenSeite />} />
            <Route path="/verwaltung/mitteilung" element={<Mitteilung />} />
            <Route path="*" element={<div className="p-8 text-center">Seite nicht gefunden. <Link className="underline" to="/">Zur Startseite</Link></div>} />
          </Routes>
        </Suspense>
      </Rahmen>
    </HashRouter>
  );
}
