import { useState } from 'react';
import { AkkuRing } from '../components/AkkuRing';
import { Icon } from '../components/Icon';
import { ExternerLink, Fehler, Hinweis, Laden, Seite, useLaden } from '../components/ui';
import { Verlauf } from '../components/Verlauf';
import { config } from '../config';
import { api } from '../lib/api';
import { klassen, vorZeit } from '../lib/helfer';
import type { BluettiAntwort, BluettiVerlauf } from '../lib/model';

function Wert({ label, wert, einheit = 'W', aktiv }: { label: string; wert: number; einheit?: string; aktiv?: boolean }) {
  return (
    <div className="karte p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{wert} <span className="text-sm font-semibold">{einheit}</span></p>
      {aktiv !== undefined && <p className={klassen('text-xs font-semibold', aktiv ? 'text-emerald-600' : 'text-slate-400')}>{aktiv ? '● an' : '○ aus'}</p>}
    </div>
  );
}

export default function Strom() {
  const { daten: a, fehler, laedt, neu } = useLaden(() => api<BluettiAntwort>('bluetti'));
  const [tage, setTage] = useState<1 | 7>(1);
  const verlauf = useLaden(() => api<{ eingerichtet: boolean; punkte: BluettiVerlauf[] }>('bluetti_verlauf', { tage }), [tage]);
  const d = a?.daten;

  const packs = d
    ? [
        { name: 'Basis', da: d.pack_internal, soc: d.pack1_soc },
        { name: 'B300 #1', da: d.pack_b300_1, soc: d.pack2_soc },
        { name: 'B300 #2', da: d.pack_b300_2, soc: d.pack3_soc },
      ].filter((p) => p.da)
    : [];

  return (
    <Seite titel="Strom am Platz" aktion={<button onClick={neu} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-himmel-100 dark:hover:bg-slate-800" aria-label="Aktualisieren"><Icon name="aktualisieren" /></button>}>
      {laedt && !a && <Laden />}
      {fehler && <Fehler fehler={fehler} nochmal={neu} />}
      {a && !a.erreichbar && (
        <Hinweis art="warnung">
          Bluetti-Server gerade nicht erreichbar.{a.zeit ? ` Angezeigt wird der letzte bekannte Wert (${vorZeit(a.zeit)}).` : ''}
        </Hinweis>
      )}
      {d && !d.connected && <div className="mt-3"><Hinweis art="warnung">ESP32 erreichbar, aber keine Verbindung zur Bluetti.</Hinweis></div>}
      {d && (
        <div className="mt-3 space-y-4">
          <div className="karte flex items-center gap-5 p-5">
            <AkkuRing prozent={d.soc} />
            <div>
              <p className="text-sm text-slate-500">Akkustand gesamt</p>
              <p className={klassen('text-lg font-bold', d.net_power_w >= 0 ? 'text-emerald-600' : 'text-mgi-rot')}>
                {d.net_power_w >= 0 ? '▲ lädt' : '▼ entlädt'} {Math.abs(d.net_power_w)} W
              </p>
              {a.zeit && <p className="text-xs text-slate-500">Messung {vorZeit(a.zeit)}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Wert label="☀ Solar" wert={d.solar_input_w} />
            <Wert label="Netz" wert={d.grid_input_w} />
            <Wert label="AC-Ausgang" wert={d.ac_output_w} aktiv={d.ac_active} />
            <Wert label="DC-Ausgang" wert={d.dc_output_w} aktiv={d.dc_active} />
          </div>
          {packs.length > 0 && (
            <div className="karte p-4">
              <h2 className="mb-3 font-bold">Akkupacks</h2>
              <div className="space-y-3">
                {packs.map((p) => (
                  <div key={p.name}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{p.name}</span><span>{p.soc} %</span></div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className={klassen('h-full rounded-full', p.soc > 50 ? 'bg-emerald-500' : p.soc >= 20 ? 'bg-sonne' : 'bg-mgi-rot')} style={{ width: `${p.soc}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {verlauf.daten?.eingerichtet && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Verlauf</h2>
            <div className="flex rounded-xl bg-himmel-100 p-1 dark:bg-slate-800">
              {([1, 7] as const).map((t) => (
                <button key={t} onClick={() => setTage(t)} className={klassen('min-h-9 rounded-lg px-3 text-sm font-semibold', tage === t ? 'bg-white shadow dark:bg-slate-700' : '')}>
                  {t === 1 ? '24 Std.' : '7 Tage'}
                </button>
              ))}
            </div>
          </div>
          {verlauf.laedt ? <Laden /> : (
            <>
              <Verlauf titel="Akkustand" einheit="%" max={100} tage={tage} farbe={{ hell: '#1e6fd9', dunkel: '#7ab3f0' }}
                punkte={verlauf.daten.punkte.map((p) => ({ zeit: p.zeit, wert: p.soc }))} />
              <Verlauf titel="Solarleistung" einheit="W" tage={tage} farbe={{ hell: '#b45309', dunkel: '#f6b73c' }}
                punkte={verlauf.daten.punkte.map((p) => ({ zeit: p.zeit, wert: p.solar }))} />
            </>
          )}
        </div>
      )}

      <ExternerLink href={config.bluetti.webUrl}
        className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-himmel-700 ring-1 ring-himmel-300 dark:bg-slate-800 dark:text-himmel-200">
        <Icon name="extern" className="h-5 w-5" /> Original-Webseite öffnen
      </ExternerLink>
    </Seite>
  );
}
