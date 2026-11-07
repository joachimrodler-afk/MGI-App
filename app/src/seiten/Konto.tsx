import { useEffect, useState } from 'react';
import { LoginFormular } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Schalter, Seite } from '../components/ui';
import { istDemo } from '../config';
import { api, speichereSitzung } from '../lib/api';
import { demoZuruecksetzen } from '../lib/demo';
import { klassen } from '../lib/helfer';
import type { PushEinstellungen } from '../lib/model';
import { erlaubnisHilfe, pushAuffrischen, pushAusschalten, pushEinschalten, pushEinstellungenSpeichern, pushErlaubnis, pushMoeglich, pushStatus, pushTesten, STANDARD_PUSH } from '../lib/push';
import { useSitzung } from '../lib/sitzung';

const PUSH_ANLAESSE: { key: keyof PushEinstellungen; name: string; text: string }[] = [
  { key: 'mitteilungen', name: 'Wichtige Mitteilungen', text: 'z. B. Platzsperrung' },
  { key: 'termine', name: 'Termine', text: 'neue Termine und Erinnerung am Vortag' },
  { key: 'ergebnisse', name: 'Wettbewerbsergebnisse', text: 'wenn eine Rangliste fertig ist' },
  { key: 'brett', name: 'Schwarzes Brett', text: 'neue Beiträge' },
  { key: 'nachweise', name: 'Nachweis-Erinnerungen', text: 'vor Ablauf deiner Nachweise' },
  { key: 'arbeitsdienst', name: 'Arbeitsdienst', text: 'eine Woche vorher und am Montag deiner Woche' },
];

function PushBereich({ admin }: { admin: boolean }) {
  const [st, setSt] = useState(pushStatus);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');
  const [test, setTest] = useState('');
  const moeglich = pushMoeglich();
  const erlaubnis = moeglich.ok ? pushErlaubnis() : 'fehlt';
  const aktiv = !!st.token && erlaubnis === 'granted';

  // Abo beim Öffnen prüfen (neues Token nach iOS-Update, Erlaubnis entzogen …)
  useEffect(() => { void pushAuffrischen().then(() => setSt(pushStatus())).catch(() => undefined); }, []);

  async function an() {
    setLaedt(true); setFehler(''); setTest('');
    try { await pushEinschalten(st.einstellungen); setSt(pushStatus()); } catch (e) { setFehler((e as Error).message); } finally { setLaedt(false); }
  }
  async function aus() {
    setLaedt(true); setTest('');
    await pushAusschalten();
    setSt(pushStatus());
    setLaedt(false);
  }
  async function testen() {
    setLaedt(true); setFehler(''); setTest('');
    try {
      const n = await pushTesten();
      setTest(n ? `Test-Nachricht an ${n} ${n === 1 ? 'Gerät' : 'Geräte'} gesendet – sie sollte in wenigen Sekunden erscheinen.` : 'Für dich ist kein Gerät registriert. Bitte Push aus- und wieder einschalten.');
    } catch (e) { setFehler((e as Error).message); } finally { setLaedt(false); }
  }
  async function setze(k: keyof PushEinstellungen, v: boolean) {
    const e = { ...st.einstellungen, [k]: v };
    setSt({ ...st, einstellungen: e });
    await pushEinstellungenSpeichern(e).catch((x) => setFehler((x as Error).message));
  }

  return (
    <div className="karte overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Icon name="glocke" className="h-6 w-6 text-himmel-600" />
        <h2 className="flex-1 font-bold">Push-Nachrichten</h2>
        <span className={klassen('rounded-full px-2.5 py-0.5 text-xs font-bold', aktiv ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200')}>
          {aktiv ? 'an' : 'aus'}
        </span>
      </div>
      {!moeglich.ok ? (
        <div className="px-4 pb-4"><Hinweis>{moeglich.grund}</Hinweis></div>
      ) : !aktiv ? (
        <div className="space-y-3 px-4 pb-4">
          {erlaubnis === 'denied'
            ? <Hinweis art="warnung">{erlaubnisHilfe()}</Hinweis>
            : <Hinweis>Push ist auf diesem Gerät noch <b>aus</b>. Tippe auf „Push einschalten“ und erlaube in der Abfrage „Mitteilungen“.</Hinweis>}
          {fehler && <Fehler fehler={fehler} />}
          <Knopf className="w-full" onClick={an} laedt={laedt}><Icon name="glocke" className="h-5 w-5" /> Push einschalten</Knopf>
        </div>
      ) : (
        <>
          <div className="divide-y divide-himmel-100 border-t border-himmel-100 dark:divide-slate-700 dark:border-slate-700">
            {admin && <Schalter an={st.einstellungen.anfragen !== false} onChange={(v) => setze('anfragen', v)} label="Zugangsanfragen" text="nur Admins: jemand möchte in die App" />}
            {PUSH_ANLAESSE.map((a) => (
              <Schalter key={a.key} an={st.einstellungen[a.key] ?? STANDARD_PUSH[a.key] ?? false} onChange={(v) => setze(a.key, v)} label={a.name} text={a.text} />
            ))}
          </div>
          <div className="space-y-2 p-4">
            {fehler && <Fehler fehler={fehler} />}
            {test && <Hinweis art="ok">{test}</Hinweis>}
            <Knopf art="sekundaer" className="w-full" onClick={testen} laedt={laedt}><Icon name="glocke" className="h-5 w-5" /> Test-Nachricht senden</Knopf>
            <Knopf art="leise" className="w-full" onClick={aus} laedt={laedt}>Push auf diesem Gerät ausschalten</Knopf>
          </div>
        </>
      )}
    </div>
  );
}

function PinAendern() {
  const [offen, setOffen] = useState(false);
  const [alt, setAlt] = useState('');
  const [neu, setNeu] = useState('');
  const [neu2, setNeu2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [laedt, setLaedt] = useState(false);
  async function los(e: React.FormEvent) {
    e.preventDefault();
    if (neu !== neu2) return setMsg({ ok: false, text: 'Die beiden neuen PINs stimmen nicht überein.' });
    setLaedt(true);
    try {
      await api('pin_aendern', { alt, neu });
      setMsg({ ok: true, text: 'PIN geändert.' });
      setAlt(''); setNeu(''); setNeu2('');
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setLaedt(false);
    }
  }
  const pin = (v: string, set: (s: string) => void, label: string, ac: string) => (
    <Feld label={label}><input className="eingabe tracking-[0.3em]" type="password" inputMode="numeric" autoComplete={ac} value={v} maxLength={8} required onChange={(e) => set(e.target.value.replace(/\D/g, ''))} /></Feld>
  );
  if (!offen) return <Knopf art="sekundaer" className="w-full" onClick={() => setOffen(true)}><Icon name="schloss" className="h-5 w-5" /> PIN ändern</Knopf>;
  return (
    <form onSubmit={los} className="karte space-y-3 p-4">
      <h2 className="font-bold">PIN ändern</h2>
      {pin(alt, setAlt, 'Bisheriger PIN', 'current-password')}
      {pin(neu, setNeu, 'Neuer PIN (6–8 Ziffern)', 'new-password')}
      {pin(neu2, setNeu2, 'Neuer PIN wiederholen', 'new-password')}
      {msg && <Hinweis art={msg.ok ? 'ok' : 'fehler'}>{msg.text}</Hinweis>}
      <div className="flex gap-2">
        <Knopf type="button" art="sekundaer" className="flex-1" onClick={() => setOffen(false)}>Schließen</Knopf>
        <Knopf type="submit" className="flex-1" laedt={laedt}>Ändern</Knopf>
      </div>
    </form>
  );
}

function Thema() {
  const [w, setW] = useState(localStorage.getItem('mgi.thema') ?? 'system');
  const setze = (x: string) => {
    if (x === 'system') localStorage.removeItem('mgi.thema'); else localStorage.setItem('mgi.thema', x);
    setW(x);
    window.dispatchEvent(new Event('mgi-thema'));
  };
  return (
    <div className="karte p-4">
      <h2 className="mb-2 font-bold">Darstellung</h2>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-himmel-100 p-1 dark:bg-slate-800">
        {[['system', 'Automatisch'], ['hell', 'Hell'], ['dunkel', 'Dunkel']].map(([k, n]) => (
          <button key={k} onClick={() => setze(k)} className={klassen('min-h-10 rounded-lg text-sm font-semibold', w === k ? 'bg-white shadow dark:bg-slate-700' : '')}>{n}</button>
        ))}
      </div>
    </div>
  );
}

export default function Konto() {
  const s = useSitzung();
  async function abmelden() {
    await api('logout').catch(() => undefined);
    speichereSitzung(null);
  }
  return (
    <Seite titel={s ? 'Mein Konto' : 'Anmelden'}>
      <div className="space-y-4">
        {!s ? (
          <LoginFormular />
        ) : (
          <>
            <div className="karte flex items-center gap-4 p-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-himmel-600 text-xl font-bold text-white">
                {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              <div className="flex-1">
                <p className="text-lg font-bold">{s.name}</p>
                <p className="text-sm text-slate-500">{s.rolle === 'admin' ? 'Admin (Vorstand / Wertungsrichter)' : 'Mitglied'}</p>
              </div>
            </div>
            <PushBereich admin={s.rolle === 'admin'} />
            <PinAendern />
            <Knopf art="gefahr" className="w-full" onClick={abmelden}>Abmelden</Knopf>
          </>
        )}
        <Thema />
        {istDemo && (
          <Knopf art="leise" className="w-full" onClick={() => { demoZuruecksetzen(); speichereSitzung(null); location.reload(); }}>
            Demo-Daten zurücksetzen
          </Knopf>
        )}
      </div>
    </Seite>
  );
}
