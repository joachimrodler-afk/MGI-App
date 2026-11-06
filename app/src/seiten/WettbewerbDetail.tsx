import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Fehler, Hinweis, Knopf, Laden, Seite, useLaden } from '../components/ui';
import { config } from '../config';
import { api } from '../lib/api';
import { rangCsv, rangliste } from '../lib/auswertung';
import { datumKurz, herunterladen, klassen } from '../lib/helfer';
import type { Wertung, Wettbewerb } from '../lib/model';
import { useSitzung } from '../lib/sitzung';

const zahl = (x: number | null, st = 1) => (x === null ? '–' : x.toLocaleString('de-DE', { maximumFractionDigits: st }));

export default function WettbewerbDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = useSitzung();
  const { daten, fehler, laedt, neu } = useLaden(() => api<{ wettbewerb: Wettbewerb; wertungen: Wertung[] }>('wettbewerb', { id }), [id, s?.token]);
  const [klasse, setKlasse] = useState('');
  const [aendert, setAendert] = useState(false);
  const wb = daten?.wettbewerb;
  const admin = s?.rolle === 'admin';

  // Live: laufende Wettbewerbe alle 20 Sekunden aktualisieren
  useEffect(() => {
    if (wb?.status !== 'offen') return;
    const t = setInterval(() => void neu(), 20000);
    return () => clearInterval(t);
  }, [wb?.status, neu]);

  const plaetze = useMemo(() => (wb ? rangliste(wb, daten!.wertungen, klasse) : []), [wb, daten, klasse]);

  async function status(st: 'offen' | 'abgeschlossen') {
    setAendert(true);
    try { await api('wettbewerb_speichern', { ...wb, status: st }); await neu(); } finally { setAendert(false); }
  }
  async function loeschen() {
    if (!confirm(`„${wb!.name}“ mit allen Wertungen löschen?`)) return;
    await api('wettbewerb_loeschen', { id });
    nav('/wettbewerbe');
  }

  if (laedt && !daten) return <Seite titel="Wettbewerb"><Laden /></Seite>;
  if (!wb) return <Seite titel="Wettbewerb">{fehler && <Fehler fehler={fehler} nochmal={neu} />}</Seite>;
  const fehlerListe = plaetze.flatMap((p) => p.durchgaenge.filter((d) => d.fehler).map((d) => `${p.teilnehmer.name}: ${d.fehler}`));

  return (
    <Seite titel={wb.name}>
      {/* Kopf für die Druckansicht / PDF */}
      <div className="mb-4 hidden items-center gap-4 print:flex">
        <img src="logo-640.jpg" alt="" className="h-20 w-20" />
        <div><p className="font-bold">{config.vereinsname}</p><p>{wb.art.name} · {datumKurz(wb.datum)}</p></div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-himmel-100 px-3 py-1 font-semibold text-himmel-800 dark:bg-slate-800 dark:text-himmel-200">{wb.art.name}</span>
        <span className="text-slate-500">{datumKurz(wb.datum)} · {wb.durchgaenge} Durchgänge</span>
        {wb.status === 'offen'
          ? <span className="rounded-full bg-mgi-rot px-3 py-1 text-xs font-bold text-white">läuft · aktualisiert sich automatisch</span>
          : <span className="rounded-full bg-sonne px-3 py-1 text-xs font-bold text-tinte">Endergebnis</span>}
      </div>

      {admin && wb.status === 'offen' && (
        <Link to={`/wettbewerbe/${wb.id}/eingabe`} className="nicht-drucken mb-4 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-mgi-rot text-lg font-bold text-white shadow-md">
          <Icon name="stift" /> Wertung eintragen
        </Link>
      )}

      {wb.klassen.length > 0 && (
        <div className="nicht-drucken mb-3 flex gap-2 overflow-x-auto">
          {['', ...wb.klassen].map((k) => (
            <button key={k} onClick={() => setKlasse(k)} className={klassen('min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold', klasse === k ? 'bg-himmel-600 text-white' : 'bg-white ring-1 ring-himmel-200 dark:bg-slate-800')}>
              {k || 'Alle Klassen'}
            </button>
          ))}
        </div>
      )}

      <div className="karte overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-himmel-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
              <th className="py-2 pl-2 pr-1">Pl.</th>
              <th className="px-1 py-2">Name</th>
              {Array.from({ length: wb.durchgaenge }, (_, i) => <th key={i} className="px-1 py-2 text-right">DG{i + 1}</th>)}
              <th className="sticky right-0 bg-white py-2 pl-1 pr-2 text-right dark:bg-slate-900">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {plaetze.map((p) => (
              <tr key={p.teilnehmer.id} className={klassen('border-b border-himmel-100 last:border-0 dark:border-slate-800', p.platz === 1 && p.gesamt > 0 ? 'bg-sonne-hell dark:bg-amber-950' : 'bg-white dark:bg-slate-900')}>
                <td className="py-2.5 pl-2 pr-1">
                  <span className={klassen('inline-flex h-7 w-7 items-center justify-center rounded-full font-bold',
                    p.platz === 1 ? 'bg-sonne text-tinte' : p.platz === 2 ? 'bg-slate-200 text-tinte' : p.platz === 3 ? 'bg-amber-200 text-tinte' : '')}>{p.platz}</span>
                </td>
                <td className="px-1 py-2.5 font-semibold leading-tight">
                  {p.teilnehmer.name}
                  {p.teilnehmer.klasse && !klasse && <span className="block text-xs font-normal text-slate-500">{p.teilnehmer.klasse}</span>}
                </td>
                {p.durchgaenge.map((d, i) => (
                  <td key={i} className={klassen('px-1 py-2.5 text-right tabular-nums', p.gestrichen.includes(i) && 'text-slate-400 line-through', d.fehler && 'text-mgi-rot')} title={d.fehler}>
                    {d.fehler ? '!' : zahl(d.punkte)}
                  </td>
                ))}
                <td className="sticky right-0 bg-inherit py-2.5 pl-1 pr-2 text-right text-sm font-bold tabular-nums">{zahl(p.gesamt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {wb.art.normieren1000 && 'Je Durchgang auf 1000 Punkte normiert (Bester = 1000). '}
        {wb.art.gesamt === 'streichen' && `Das schlechteste Ergebnis (${wb.art.streichAnzahl ?? 1}) wird gestrichen. `}
        {wb.art.gesamt === 'bester' && 'Es zählt der beste Durchgang. '}
        Formel (Version {wb.art.version}): <code className="rounded bg-himmel-100 px-1 dark:bg-slate-800">{wb.art.formel}</code>
      </p>
      {fehlerListe.length > 0 && <div className="mt-3"><Hinweis art="fehler">Formelfehler: {fehlerListe.slice(0, 3).join(' · ')}</Hinweis></div>}

      <div className="nicht-drucken mt-5 grid grid-cols-2 gap-2">
        <Knopf art="sekundaer" onClick={() => window.print()}><Icon name="drucker" className="h-5 w-5" /> PDF / Drucken</Knopf>
        <Knopf art="sekundaer" onClick={() => herunterladen(`${wb.name}.csv`, '﻿' + rangCsv(wb, plaetze), 'text/csv;charset=utf-8')}><Icon name="download" className="h-5 w-5" /> CSV</Knopf>
        {navigator.share && (
          <Knopf art="sekundaer" className="col-span-2" onClick={() => navigator.share({ title: wb.name, text: `Ergebnisse ${wb.name}`, url: location.href }).catch(() => undefined)}>
            <Icon name="extern" className="h-5 w-5" /> Ergebnis teilen
          </Knopf>
        )}
      </div>

      {admin && (
        <div className="nicht-drucken mt-6 space-y-2 border-t border-himmel-200 pt-4 dark:border-slate-700">
          <p className="text-sm font-bold text-slate-500">Verwaltung</p>
          <div className="grid grid-cols-2 gap-2">
            <Link to={`/wettbewerbe/${wb.id}/bearbeiten`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-himmel-700 ring-1 ring-himmel-300 dark:bg-slate-800 dark:text-himmel-200">
              <Icon name="stift" className="h-5 w-5" /> Bearbeiten
            </Link>
            {wb.status === 'offen'
              ? <Knopf art="sekundaer" onClick={() => status('abgeschlossen')} laedt={aendert}><Icon name="haken" className="h-5 w-5" /> Abschließen</Knopf>
              : <Knopf art="sekundaer" onClick={() => status('offen')} laedt={aendert}>Wieder öffnen</Knopf>}
          </div>
          <Knopf art="gefahr" className="w-full" onClick={loeschen}><Icon name="muell" className="h-5 w-5" /> Wettbewerb löschen</Knopf>
        </div>
      )}
    </Seite>
  );
}
