/** Ringanzeige für den Akkustand (grün > 50 %, gelb 20–50 %, rot < 20 %) */
export function AkkuRing({ prozent, groesse = 120 }: { prozent: number | null; groesse?: number }) {
  const r = 42;
  const u = 2 * Math.PI * r;
  const p = prozent === null ? 0 : Math.max(0, Math.min(100, prozent));
  const farbe = prozent === null ? '#94a3b8' : p > 50 ? '#10b981' : p >= 20 ? '#f2b705' : '#d7262b';
  return (
    <svg viewBox="0 0 100 100" width={groesse} height={groesse} role="img" aria-label={prozent === null ? 'Akkustand unbekannt' : `Akkustand ${p} Prozent`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-200 dark:text-slate-700" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={farbe} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * u} ${u}`} transform="rotate(-90 50 50)" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontWeight="800" fontSize={groesse < 80 ? 24 : 22} fill="currentColor">
        {prozent === null ? '–' : `${p}%`}
      </text>
    </svg>
  );
}
