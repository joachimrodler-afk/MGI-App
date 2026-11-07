/** Schlichte Linien-Icons (eigene SVGs, keine externe Bibliothek nötig) */
const PFADE: Record<string, string> = {
  start: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  kalender: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  kamera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  pokal: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6',
  mehr: 'M5 12h.01M12 12h.01M19 12h.01',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
  webcam: 'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2M8 21h8M12 15v6',
  akku: 'M3 8h15v8H3zM18 11h2v2h-2M6 10.5v3M9 10.5v3',
  schaufel: 'M14 4l6 6M17 7l-8 8M9 15l-4 4-2-2 4-4M12 18l-6-6',
  personen: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M21 20a5 5 0 0 0-4-5',
  pinnwand: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3',
  notfall: 'M12 3l9 16H3zM12 10v4M12 17h.01',
  ausweis: 'M3 6h18v12H3zM8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4M5 16a3 3 0 0 1 6 0M14 10h4M14 14h3',
  zahnrad: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12l2-1-1-3-2 .2-1.3-1.3.2-2-3-1-1 2h-1.8l-1-2-3 1 .2 2L7 7.2 5 7 4 10l2 1v2l-2 1 1 3 2-.2 1.3 1.3-.2 2 3 1 1-2h1.8l1 2 3-1-.2-2 1.3-1.3 2 .2 1-3-2-1z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
  zurueck: 'M15 5l-7 7 7 7',
  rechts: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  telefon: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  karte: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  kopieren: 'M8 8h12v12H8zM4 16V4h12',
  sprechblase: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12ZM8.5 12h.01M12 12h.01M15.5 12h.01',
  welt: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3 12h18M12 3c2.5 2.5 3.6 5.6 3.6 9s-1.1 6.5-3.6 9c-2.5-2.5-3.6-5.6-3.6-9S9.5 5.5 12 3',
  extern: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  aktualisieren: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  hochladen: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  glocke: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  muell: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  stift: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  haken: 'M5 12l5 5L20 7',
  x: 'M6 6l12 12M18 6 6 18',
  drucker: 'M7 9V4h10v5M7 17H4V9h16v8h-3M7 14h10v6H7z',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  sonne: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  schloss: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  flieger: 'M2 13l9-2 3-7 2 1-1 6 6 1 1 2-7 1-2 5-2-1v-4l-7-1z',
};

export function Icon({ name, className = 'h-6 w-6', titel }: { name: keyof typeof PFADE | string; className?: string; titel?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={titel ? undefined : true} role={titel ? 'img' : undefined}>
      {titel && <title>{titel}</title>}
      <path d={PFADE[name] ?? PFADE.mehr} />
    </svg>
  );
}
