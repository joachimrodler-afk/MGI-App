import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NurMitglied } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Laden } from '../components/ui';
import { Seite } from '../components/ui';
import { api } from '../lib/api';
import { alleArten } from '../lib/arten';
import type { Teilnehmer, Wertungsart, Wettbewerb } from '../lib/model';

function Inhalt() {
  const { id } = useParams();
  const nav = useNavigate();
  const [arten, setArten] = useState<Wertungsart[] | null>(null);
  const [wb, setWb] = useState<Partial<Wettbewerb>>({ name: '', datum: new Date().toISOString().slice(0, 10), durchgaenge: 3, klassen: [], teilnehmer: [] });
  const [artId, setArtId] = useState('');
  const [klassenText, setKlassenText] = useState('');
  const [neuName, setNeuName] = useState('');
  const [neuKlasse, setNeuKlasse] = useState('');
  const [fehler, setFehler] = useState('');
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    void alleArten().then((a) => { setArten(a); if (!id && a.length) setArtId(a[0].id); }).catch((e) => setFehler(e.message));
    if (id) {
      void api<{ wettbewerb: Wettbewerb }>('wettbewerb', { id }).then(({ wettbewerb }) => {
        setWb(wettbewerb);
        setArtId(wettbewerb.art.id);
        setKlassenText(wettbewerb.klassen.join(', '));
      });
    }
  }, [id]);

  const aktuelleArt = arten?.find((a) => a.id === artId);
  const neuereVersion = id && wb.art && aktuelleArt && (aktuelleArt.version > wb.art.version || aktuelleArt.formel !== wb.art.formel);

  function teilnehmerDazu() {
    const namen = neuName.split(/[\n,;]/).map((n) => n.trim()).filter(Boolean);
    if (!namen.length) return;
    setWb({ ...wb, teilnehmer: [...(wb.teilnehmer ?? []), ...namen.map((n) => ({ id: '', name: n, klasse: neuKlasse }))] });
    setNeuName('');
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaedt(true);
    setFehler('');
    try {
      const art = id ? wb.art! : aktuelleArt;
      if (!art) throw new Error('Bitte eine Wertungsart wählen');
      const { vorlage: _v, ...artOhne } = art as Wertungsart & { vorlage?: boolean };
      const gespeichert = await api<Wettbewerb>('wettbewerb_speichern', {
        ...wb,
        art: artOhne,
        klassen: klassenText.split(',').map((k) => k.trim()).filter(Boolean),
      });
      nav(`/wettbewerbe/${gespeichert.id}`, { replace: true });
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaedt(false);
    }
  }

  if (!arten) return fehler ? <Fehler fehler={fehler} /> : <Laden />;
  const klassenListe = klassenText.split(',').map((k) => k.trim()).filter(Boolean);

  return (
    <form onSubmit={speichern} className="space-y-4">
      <div className="karte space-y-4 p-4">
        <Feld label="Name"><input className="eingabe" required value={wb.name} onChange={(e) => setWb({ ...wb, name: e.target.value })} placeholder="z. B. Vereinsmeisterschaft Segelflug 2027" /></Feld>
        <div className="grid grid-cols-2 gap-3">
          <Feld label="Datum"><input type="date" className="eingabe" required value={wb.datum} onChange={(e) => setWb({ ...wb, datum: e.target.value })} /></Feld>
          <Feld label="Durchgänge"><input type="number" min={1} max={10} className="eingabe" required value={wb.durchgaenge} onChange={(e) => setWb({ ...wb, durchgaenge: Number(e.target.value) })} /></Feld>
        </div>
        {!id ? (
          <Feld label="Wertungsart" hilfe={aktuelleArt?.beschreibung}>
            <select className="eingabe" value={artId} onChange={(e) => setArtId(e.target.value)}>
              {arten.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Feld>
        ) : (
          <div>
            <span className="label">Wertungsart</span>
            <p>{wb.art?.name} (Formel-Version {wb.art?.version})</p>
            {neuereVersion && (
              <div className="mt-2">
                <Hinweis art="warnung">
                  Für diese Wertungsart gibt es eine neuere Formel. Der Wettbewerb rechnet weiter mit seiner Version.
                  <button type="button" className="mt-2 block font-semibold underline" onClick={() => setWb({ ...wb, art: aktuelleArt })}>Auf neue Formel umstellen</button>
                </Hinweis>
              </div>
            )}
          </div>
        )}
        <Feld label="Klassen (optional, mit Komma getrennt)" hilfe="z. B. Junioren, Senioren – leer lassen, wenn alle zusammen gewertet werden">
          <input className="eingabe" value={klassenText} onChange={(e) => setKlassenText(e.target.value)} />
        </Feld>
      </div>

      <div className="karte p-4">
        <h2 className="mb-3 font-bold">Teilnehmer ({wb.teilnehmer?.length ?? 0})</h2>
        <ul className="mb-3 divide-y divide-himmel-100 dark:divide-slate-700">
          {wb.teilnehmer?.map((t: Teilnehmer, i) => (
            <li key={i} className="flex items-center gap-2 py-2">
              <span className="flex-1 font-semibold">{t.name}</span>
              {klassenListe.length > 0 && (
                <select className="rounded-lg border border-himmel-200 bg-transparent px-2 py-1 text-sm" value={t.klasse} aria-label={`Klasse von ${t.name}`}
                  onChange={(e) => setWb({ ...wb, teilnehmer: wb.teilnehmer!.map((x, j) => (j === i ? { ...x, klasse: e.target.value } : x)) })}>
                  <option value="">–</option>
                  {klassenListe.map((k) => <option key={k}>{k}</option>)}
                </select>
              )}
              <button type="button" onClick={() => setWb({ ...wb, teilnehmer: wb.teilnehmer!.filter((_, j) => j !== i) })} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-red-50" aria-label={`${t.name} entfernen`}>
                <Icon name="x" className="h-4 w-4 text-mgi-rot" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className="eingabe flex-1" value={neuName} onChange={(e) => setNeuName(e.target.value)} placeholder="Name (mehrere mit Komma)"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); teilnehmerDazu(); } }} />
          {klassenListe.length > 0 && (
            <select className="eingabe w-32" value={neuKlasse} onChange={(e) => setNeuKlasse(e.target.value)} aria-label="Klasse">
              <option value="">Klasse</option>
              {klassenListe.map((k) => <option key={k}>{k}</option>)}
            </select>
          )}
          <Knopf type="button" art="sekundaer" onClick={teilnehmerDazu} aria-label="Teilnehmer hinzufügen"><Icon name="plus" /></Knopf>
        </div>
      </div>

      {fehler && <Fehler fehler={fehler} />}
      <Knopf type="submit" className="w-full" laedt={laedt}>{id ? 'Speichern' : 'Wettbewerb anlegen'}</Knopf>
    </form>
  );
}

export default function WettbewerbBearbeiten() {
  const { id } = useParams();
  return (
    <Seite titel={id ? 'Wettbewerb bearbeiten' : 'Neuer Wettbewerb'}>
      <NurMitglied admin><Inhalt /></NurMitglied>
    </Seite>
  );
}
