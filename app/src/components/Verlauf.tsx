import { useRef, useState } from 'react';

/**
 * Einfaches Liniendiagramm (eine Reihe, eine Achse) mit Fadenkreuz-Tooltip.
 * Zwei Größen mit unterschiedlicher Einheit (z. B. % und W) bekommen zwei eigene Diagramme.
 */
export function Verlauf({ titel, punkte, einheit, farbe, max, tage }: {
  titel: string;
  punkte: { zeit: string; wert: number | null }[];
  einheit: string;
  farbe: { hell: string; dunkel: string };
  max?: number;
  tage: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const B = 340, H = 140, L = 34, R = 8, O = 10, U = 22;
  const gueltig = punkte.filter((p) => p.wert !== null) as { zeit: string; wert: number }[];
  if (gueltig.length < 2) return null;
  const t0 = new Date(punkte[0].zeit).getTime();
  const t1 = new Date(punkte[punkte.length - 1].zeit).getTime();
  const yMax = max ?? Math.max(10, Math.ceil(Math.max(...gueltig.map((p) => p.wert)) / 100) * 100);
  const x = (t: string) => L + ((new Date(t).getTime() - t0) / Math.max(1, t1 - t0)) * (B - L - R);
  const y = (v: number) => O + (1 - v / yMax) * (H - O - U);

  // Linie mit Lücken bei fehlenden Werten
  let pfad = '';
  let neu = true;
  for (const p of punkte) {
    if (p.wert === null) { neu = true; continue; }
    pfad += `${neu ? 'M' : 'L'}${x(p.zeit).toFixed(1)},${y(p.wert).toFixed(1)}`;
    neu = false;
  }
  const ticksY = [0, yMax / 2, yMax];
  const ticksX = tage === 1
    ? punkte.filter((p) => new Date(p.zeit).getMinutes() < 10 && new Date(p.zeit).getHours() % 6 === 0)
    : punkte.filter((p) => new Date(p.zeit).getHours() === 0);
  const fmtX = (t: string) => (tage === 1 ? `${new Date(t).getHours()} Uhr` : new Date(t).toLocaleDateString('de-DE', { weekday: 'short' }));

  function bewegen(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * B;
    let best = 0, abst = Infinity;
    punkte.forEach((p, i) => {
      const d = Math.abs(x(p.zeit) - px);
      if (d < abst && p.wert !== null) { abst = d; best = i; }
    });
    setHover(best);
  }
  const hp = hover !== null ? punkte[hover] : null;

  return (
    <figure className="karte p-4">
      <figcaption className="mb-2 flex items-baseline justify-between">
        <span className="font-bold">{titel}</span>
        <span className="text-sm text-slate-500">
          {hp && hp.wert !== null ? (
            <><b className="text-tinte dark:text-slate-100">{Math.round(hp.wert)} {einheit}</b> · {new Date(hp.zeit).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</>
          ) : 'Antippen für Werte'}
        </span>
      </figcaption>
      <svg ref={ref} viewBox={`0 0 ${B} ${H}`} className="w-full touch-none select-none" role="img"
        aria-label={`${titel}: aktuell ${Math.round(gueltig[gueltig.length - 1].wert)} ${einheit}`}
        onPointerMove={bewegen} onPointerDown={bewegen} onPointerLeave={() => setHover(null)}>
        {ticksY.map((v) => (
          <g key={v}>
            <line x1={L} x2={B - R} y1={y(v)} y2={y(v)} stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-700" />
            <text x={L - 5} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize="10" fill="currentColor" className="text-slate-500">{Math.round(v)}</text>
          </g>
        ))}
        {ticksX.map((p) => (
          <text key={p.zeit} x={x(p.zeit)} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500">{fmtX(p.zeit)}</text>
        ))}
        <path d={pfad} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="dark:hidden" stroke={farbe.hell} />
        <path d={pfad} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="hidden dark:block" stroke={farbe.dunkel} />
        {hp && hp.wert !== null && (
          <g>
            <line x1={x(hp.zeit)} x2={x(hp.zeit)} y1={O} y2={H - U} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="text-slate-400" />
            <circle cx={x(hp.zeit)} cy={y(hp.wert)} r="4.5" fill={farbe.hell} stroke="white" strokeWidth="2" />
          </g>
        )}
      </svg>
    </figure>
  );
}
