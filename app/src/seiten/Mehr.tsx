import { Icon } from '../components/Icon';
import { Seite, Zeile } from '../components/ui';
import { config, istGesetzt } from '../config';
import { useSitzung } from '../lib/sitzung';

export default function Mehr() {
  const s = useSitzung();
  const extern = (href: string, icon: string, titel: string, text: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-himmel-50 dark:hover:bg-slate-800">
      <Icon name={icon} className="h-6 w-6 text-himmel-600" />
      <span className="flex-1"><span className="block font-semibold">{titel}</span><span className="block text-sm text-slate-500">{text}</span></span>
      <Icon name="extern" className="h-5 w-5 text-slate-400" />
    </a>
  );
  return (
    <Seite titel="Mehr" zurueck={false}>
      <div className="space-y-4">
        <div className="karte divide-y divide-himmel-100 overflow-hidden dark:divide-slate-700">
          <Zeile zu="/wetter" icon="wind" titel="Wetter am Platz" text="Wind, Böen, Vorhersage" />
          <Zeile zu="/webcam" icon="webcam" titel="Webcam" text="Standbild und Live-Stream" />
          <Zeile zu="/strom" icon="akku" titel="Strom am Platz" text="Bluetti-Akku und Solar" />
          <Zeile zu="/flugbuch" icon="flieger" titel="Flugbuch" text="An- und abmelden, wer ist am Platz" />
          <Zeile zu="/brett" icon="pinnwand" titel="Schwarzes Brett" />
          <Zeile zu="/arbeitsdienst" icon="schaufel" titel="Arbeitsdienst" text="Termine und Eintragen" />
          <Zeile zu="/notfall" icon="notfall" titel="Platzordnung & Notfall" />
        </div>
        <div className="karte divide-y divide-himmel-100 overflow-hidden dark:divide-slate-700">
          <Zeile zu="/konto" icon="person" titel={s ? s.name : 'Anmelden'} text={s ? 'Konto, PIN, Push-Nachrichten' : 'Mit Name und PIN'} />
          {s && <Zeile zu="/nachweise" icon="ausweis" titel="Meine Nachweise" text="Kenntnisnachweis, e-ID, Versicherung" />}
          {s?.rolle === 'admin' && <Zeile zu="/verwaltung" icon="zahnrad" titel="Verwaltung" text="Mitglieder, Wertungen, Einstellungen" />}
        </div>
        <div className="karte divide-y divide-himmel-100 overflow-hidden dark:divide-slate-700">
          {extern(config.kalender.webUrl, 'kalender', 'Vereinskalender', 'kalender.digital')}
          {extern(config.wetter.stationUrl, 'wind', 'Wetterstation', 'Wettermonster')}
          {istGesetzt(config.impressumUrl) && extern(config.impressumUrl, 'extern', 'Impressum', '')}
          {istGesetzt(config.datenschutzUrl) && extern(config.datenschutzUrl, 'extern', 'Datenschutz', '')}
        </div>
        <p className="text-center text-xs text-slate-500">{config.vereinsname} · Vereins-App</p>
      </div>
    </Seite>
  );
}
