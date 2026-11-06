/** Gemeinsame Datentypen (Frontend <-> Apps Script). */

export type Rolle = 'mitglied' | 'admin';

export interface Sitzung {
  token: string;
  mitgliedId: string;
  name: string;
  rolle: Rolle;
  /** 0 = unbegrenzt gültig */
  ablauf: number;
}

export interface Mitglied {
  id: string;
  vorname: string;
  nachname: string;
  rolle: Rolle;
  sparte: 'flug' | 'schiff' | '';
  aktiv: boolean;
}

export interface Termin {
  titel: string;
  beginn: string; // ISO
  ende: string;
  ganztaegig: boolean;
  ort?: string;
  beschreibung?: string;
}

export interface BluettiStatus {
  soc: number;
  solar_input_w: number;
  grid_input_w: number;
  ac_output_w: number;
  dc_output_w: number;
  net_power_w: number;
  dc_active: boolean;
  ac_active: boolean;
  pack_count: number;
  pack_internal: boolean;
  pack_b300_1: boolean;
  pack_b300_2: boolean;
  pack1_soc: number;
  pack2_soc: number;
  pack3_soc: number;
  connected: boolean;
}

export interface BluettiAntwort {
  erreichbar: boolean;
  daten?: BluettiStatus;
  zeit?: string; // Zeitpunkt der Messung (ISO)
  ausCache?: boolean;
}

export interface BluettiVerlauf {
  zeit: string;
  soc: number | null;
  solar: number | null;
}

export interface CheckIn {
  mitgliedId: string;
  name: string;
  seit: string;
  flugleiter: boolean;
}

export interface BrettBeitrag {
  id: string;
  kategorie: 'biete' | 'suche' | 'info';
  titel: string;
  text: string;
  preis?: string;
  kontakt?: string;
  fotos: string[]; // Bild-URLs (Drive)
  verfasserId: string;
  verfasser: string;
  erstellt: string;
  ablauf: string;
}

export interface Nachweise {
  kenntnisnachweis?: string; // ISO-Datum des Ablaufs
  eid?: string;
  versicherung?: string;
}

export interface PushEinstellungen {
  /** nur für Admins: neue Zugangsanfragen */
  anfragen?: boolean;
  termine: boolean;
  mitteilungen: boolean;
  ergebnisse: boolean;
  brett: boolean;
  nachweise: boolean;
  /** Erinnerung an eigene Arbeitsdienst-Wochen */
  arbeitsdienst?: boolean;
}

/** Eine Arbeitsdienst-Woche, in der das Mitglied eingetragen ist */
export interface ArbeitsdienstWoche {
  kw: string;
  von: string; // yyyy-mm-dd (Montag)
  bis: string;
  einsaetze: string[];
}

export interface Einstellungen {
  platzordnung: string; // Markdown
  notfallInfo: string; // Markdown: Erste-Hilfe-Kasten, Feuerlöscher, Kontakte
  notfallKontakte: { name: string; rolle: string; telefon: string }[];
  windGelb: number; // km/h Böen
  windRot: number;
  datenschutzFoto: string;
  checkinStunden: number;
}

// ---------------------------------------------------------------- Wettbewerbe
export type FeldTyp = 'zahl' | 'zeit' | 'janein' | 'liste';

export interface Feld {
  key: string;
  label: string;
  typ: FeldTyp;
  /** Bei typ = liste: Anzahl Werte (z. B. Anzahl Wertungsrichter) */
  anzahl?: number;
  min?: number;
  max?: number;
  einheit?: string;
}

export interface Konstante {
  key: string;
  label: string;
  wert: number;
}

/** z. B. Kunstflug-Figuren mit eigenem K-Faktor */
export interface ElementDef {
  bezeichnung: string; // „Figur“
  konstanten: string[]; // Schlüssel pro Element, z. B. ["k"]
  liste: { name: string; werte: Record<string, number> }[];
}

export interface Wertungsart {
  id: string;
  name: string;
  beschreibung: string;
  felder: Feld[];
  konstanten: Konstante[];
  elemente?: ElementDef;
  /** Formel pro Durchgang (bzw. pro Element, wenn elemente gesetzt) */
  formel: string;
  gesamt: 'summe' | 'bester' | 'streichen';
  streichAnzahl?: number;
  normieren1000: boolean;
  sortierung: 'hoch' | 'niedrig';
  gleichstand: 'bester_durchgang' | 'geteilt';
  version: number;
  geaendert: string;
}

export interface Teilnehmer {
  id: string;
  name: string;
  klasse: string;
}

export interface Wettbewerb {
  id: string;
  name: string;
  datum: string;
  /** Kopie der Wertungsart zum Zeitpunkt der Anlage (Formel-Version bleibt fest) */
  art: Wertungsart;
  klassen: string[];
  teilnehmer: Teilnehmer[];
  durchgaenge: number;
  status: 'offen' | 'abgeschlossen';
  erstellt: string;
}

export type FeldWert = number | number[];

export interface Eingabe {
  felder: Record<string, FeldWert>;
  elemente?: Record<string, FeldWert>[];
}

export interface Wertung {
  id: string;
  wettbewerbId: string;
  teilnehmerId: string;
  durchgang: number; // ab 1
  eingabe: Eingabe;
  richter: string;
  zeit: string;
}

// ---------------------------------------------------------------- Zugangsanfrage
export interface Anfrage {
  id: string;
  vorname: string;
  nachname: string;
  nachricht?: string;
  erstellt: string;
}

// ---------------------------------------------------------------- Flugbuch
export type Antrieb = 'segler' | 'elektro' | 'kolben' | 'turbine';
export type Masse = '<250 g' | '<2 kg' | '<12 kg' | '<25 kg';
export type Wetter = 'klar' | 'leicht bedeckt' | 'bedeckt' | 'nebelig';
export type Windrichtung = 'N' | 'NO' | 'O' | 'SO' | 'S' | 'SW' | 'W' | 'NW';
export type Windstaerke = 'kein' | 'leicht' | 'mäßig' | 'stark';

export interface FlugbuchEintrag {
  id: string;
  datum: string; // TT.MM.JJJJ
  name: string;
  vorname: string;
  vereinGast: 'Verein' | 'Gast';
  kanal: string;
  schulungsnachweis: boolean;
  antrieb: Antrieb[];
  masse: Masse;
  beginn: string; // HH:mm
  ende: string;
  eingetragenVon: string;
  mitgliedId: string;
  beginnTs: string;
  endeTs: string;
  autoBeendet: boolean;
  /** Besondere Vorkommnisse (Freitext) */
  vorkommnisse?: string;
}

export interface Flugbedingungen {
  fangnetz: boolean;
  rasenGemaeht: boolean;
  wetter: Wetter;
  windrichtung: Windrichtung;
  windstaerke: Windstaerke;
}

export interface FlugleiterEintrag extends Flugbedingungen {
  id: string;
  datum: string;
  name: string;
  vorname: string;
  beginn: string;
  ende: string;
  mitgliedId: string;
  beginnTs: string;
  endeTs: string;
  autoBeendet: boolean;
}

export interface FlugbuchStatus {
  heute: string;
  piloten: FlugbuchEintrag[];
  flugleiter: FlugleiterEintrag[];
  anwesend: { anzahl: number; flugleiter: boolean; liste: CheckIn[] };
  autoStunden: number;
}

export interface PilotEingabe {
  art: 'verein' | 'gast';
  gastVorname?: string;
  gastName?: string;
  schulungsnachweis: boolean;
  antrieb: Antrieb[];
  masse: Masse | '';
  regelnBestaetigt: boolean;
}

// ---------------------------------------------------------------- Eigene Wetterstation
export interface WetterstationAntwort {
  erreichbar: boolean;
  daten?: {
    temperatur: number | null;
    wind: number | null; // km/h
    richtung: string | null; // N, NO, O, …
    luftdruck: number | null;
    luftfeuchte: number | null;
    batterie: number | null;
  };
  zeit?: string;
  ausCache?: boolean;
}
