/**
 * Blockschaltbild der MGI-Wetterstation (nach der Firmware „Wetterstation-5.0“).
 * Reines SVG, passt sich hell/dunkel über currentColor und Tailwind-Klassen an.
 */
function Box({ x, y, w, h, titel, unter, art = 'sensor' }: { x: number; y: number; w: number; h: number; titel: string; unter?: string; art?: 'sensor' | 'mcu' | 'aus' | 'netz' }) {
  const fuell = {
    sensor: 'fill-himmel-50 stroke-sky-400 dark:fill-slate-800 dark:stroke-sky-600',
    mcu: 'fill-mgi-rot stroke-mgi-rot-dunkel',
    aus: 'fill-amber-50 stroke-amber-400 dark:fill-amber-950 dark:stroke-amber-600',
    netz: 'fill-emerald-50 stroke-emerald-400 dark:fill-emerald-950 dark:stroke-emerald-600',
  }[art];
  const text = art === 'mcu' ? 'fill-white' : 'fill-tinte dark:fill-slate-100';
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} className={fuell} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (unter ? h / 2 - 3 : h / 2 + 5)} textAnchor="middle" className={text} fontSize={art === 'mcu' ? 16 : 13} fontWeight={700}>{titel}</text>
      {unter && <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" className={text} fontSize={10.5} opacity={0.85}>{unter}</text>}
    </g>
  );
}

function Pfeil({ d, label, lx, ly, anker = 'start' }: { d: string; label?: string; lx?: number; ly?: number; anker?: 'start' | 'middle' | 'end' }) {
  return (
    <g>
      <path d={d} fill="none" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth={1.6} markerEnd="url(#mgi-pfeil)" />
      {label && <text x={lx} y={ly} textAnchor={anker} fontSize={10} className="fill-slate-600 dark:fill-slate-300">{label}</text>}
    </g>
  );
}

export function BlockschaltbildWetterstation() {
  return (
    <figure className="my-2">
      <svg viewBox="0 0 360 400" className="h-auto w-full" role="img" aria-labelledby="bsb-titel">
        <title id="bsb-titel">Blockschaltbild der Wetterstation: Sensoren an ESP32, Ausgang Rabenschreck, WLAN zu Wettermonster und App</title>
        <defs>
          <marker id="mgi-pfeil" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="fill-slate-500 dark:fill-slate-400" />
          </marker>
        </defs>

        {/* Sensoren links */}
        <Box x={4} y={10} w={156} h={46} titel="Anemometer" unter="4–20 mA über 120 Ω" />
        <Box x={4} y={66} w={156} h={46} titel="Windfahne" unter="Windrichtung, analog" />
        <Box x={4} y={122} w={156} h={46} titel="BME280" unter="Temp. · Feuchte · Druck" />
        <Box x={4} y={178} w={156} h={46} titel="Akku 12 V" unter="Spannungsteiler 1 : 5,4" />
        <Pfeil d="M160,33 H224" label="GPIO 34" lx={192} ly={28} anker="middle" />
        <Pfeil d="M160,89 H224" label="GPIO 35" lx={192} ly={84} anker="middle" />
        <Pfeil d="M160,145 H224" label="I²C 0x76" lx={192} ly={140} anker="middle" />
        <Pfeil d="M160,201 H224" label="GPIO 36" lx={192} ly={196} anker="middle" />

        {/* ESP32 */}
        <rect x={226} y={10} width={130} height={214} rx={12} className="fill-mgi-rot stroke-mgi-rot-dunkel" strokeWidth={1.5} />
        <text x={291} y={98} textAnchor="middle" className="fill-white" fontSize={18} fontWeight={800}>ESP32</text>
        <text x={291} y={116} textAnchor="middle" className="fill-white" fontSize={10.5}>NodeMCU-32S</text>
        <text x={291} y={140} textAnchor="middle" className="fill-white" fontSize={10} opacity={0.9}>Messung alle 30 s</text>
        <text x={291} y={154} textAnchor="middle" className="fill-white" fontSize={10} opacity={0.9}>Watchdog · OTA</text>

        {/* Ausgang und WLAN */}
        <Pfeil d="M320,224 V260" label="GPIO 14" lx={314} ly={246} anker="end" />
        <Box x={226} y={262} w={130} h={46} titel="Rabenschreck" unter="Schaltausgang" art="aus" />
        <Pfeil d="M250,224 V242 H104 V260" label="WLAN" lx={176} ly={237} anker="middle" />
        <Box x={4} y={262} w={200} h={46} titel="Router am Platz" unter="Internet" art="netz" />
        <Pfeil d="M60,308 V338" />
        <Pfeil d="M150,308 V322 H270 V338" />
        <Box x={4} y={340} w={168} h={52} titel="Wettermonster" unter="Upload alle 10 min" art="netz" />
        <Box x={188} y={340} w={168} h={52} titel="MGI-App" unter="Messwerte (Port 81)" art="netz" />
      </svg>
      <figcaption className="mt-1 text-center text-xs text-slate-500">Blockschaltbild nach der Firmware Wetterstation 5.0</figcaption>
    </figure>
  );
}

function Rahmen({ x, y, w, h, titel, rechts }: { x: number; y: number; w: number; h: number; titel: string; rechts?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="none" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1.4} strokeDasharray="6 4" />
      <text x={rechts ? x + w - 10 : x + 10} y={y + 15} textAnchor={rechts ? 'end' : 'start'} fontSize={10.5} fontWeight={700} className="fill-slate-500 dark:fill-slate-400">{titel}</text>
    </g>
  );
}

/** Blockschaltbild der Stromversorgung am Platz (Bluetti im Gartenhaus, Pufferbatterie an den Tischen) */
export function BlockschaltbildStrom() {
  return (
    <figure className="my-2">
      <svg viewBox="0 0 360 614" className="h-auto w-full" role="img" aria-labelledby="bss-titel">
        <title id="bss-titel">Blockschaltbild der Stromversorgung: zwei Solarmodule über DC-Trennschalter an das Bluetti; 12 V für Wetterstation, WLAN-Router und DC-DC-Wandler zur Pufferbatterie an den Tischen; je Tisch 2 XT60-Ladeanschlüsse, jeder einzeln mit 15 A abgesichert; 230 V für Mähroboter, RTK-Antenne und Kühlschrank</title>
        <defs>
          <marker id="mgi-pfeil-s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="fill-slate-500 dark:fill-slate-400" />
          </marker>
        </defs>

        {/* Solar */}
        <Box x={8} y={6} w={164} h={44} titel="Solarmodul" unter="500 Wp" art="netz" />
        <Box x={188} y={6} w={164} h={44} titel="Solarmodul" unter="500 Wp" art="netz" />
        <path d="M90,50 V66 H170 M270,50 V66 H190" fill="none" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth={1.6} />
        <path d="M180,66 V96" fill="none" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth={1.6} markerEnd="url(#mgi-pfeil-s)" />
        <text x={188} y={84} fontSize={10} className="fill-slate-600 dark:fill-slate-300">PV · 2 × 500 Wp</text>

        {/* Gartenhaus */}
        <Rahmen x={4} y={88} w={352} h={176} titel="Gartenhaus" />
        <Box x={95} y={98} w={170} h={36} titel="DC-Trennschalter" />
        <path d="M180,134 V152" fill="none" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth={1.6} markerEnd="url(#mgi-pfeil-s)" />
        <rect x={40} y={154} width={280} height={96} rx={12} className="fill-mgi-rot stroke-mgi-rot-dunkel" strokeWidth={1.5} />
        <text x={180} y={177} textAnchor="middle" className="fill-white" fontSize={16} fontWeight={800}>Bluetti AC200MAX</text>
        <text x={180} y={195} textAnchor="middle" className="fill-white" fontSize={11}>+ 2 × B300 · 8.192 Wh LiFePO₄</text>
        <text x={180} y={212} textAnchor="middle" className="fill-white" fontSize={10} opacity={0.9}>PV max. 900 W · 10–145 V · 15 A</text>
        <text x={180} y={228} textAnchor="middle" className="fill-white" fontSize={10} opacity={0.9}>230 V Sinus 2.200 W · 12 V DC</text>
        <text x={180} y={243} textAnchor="middle" className="fill-white" fontSize={10} opacity={0.9}>Status in der App unter „Strom“</text>

        {/* 12 V */}
        <path d="M100,250 V278 H24 V408" fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={2.2} />
        <text x={30} y={292} fontSize={11} fontWeight={700} className="fill-sky-700 dark:fill-sky-300">12 V DC</text>
        {[312, 356, 400].map((y) => (
          <path key={y} d={`M24,${y} H40`} fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={2.2} markerEnd="url(#mgi-pfeil-s)" />
        ))}
        <Box x={42} y={296} w={130} h={34} titel="Wetterstation" art="aus" />
        <Box x={42} y={340} w={130} h={34} titel="WLAN-Router" art="aus" />
        <Box x={42} y={384} w={130} h={34} titel="DC-DC-Wandler" art="aus" />

        {/* 230 V */}
        <path d="M260,250 V278 H200 V408" fill="none" className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={2.2} />
        <text x={206} y={292} fontSize={11} fontWeight={700} className="fill-amber-700 dark:fill-amber-300">230 V AC</text>
        {[312, 356, 400].map((y) => (
          <path key={y} d={`M200,${y} H216`} fill="none" className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={2.2} markerEnd="url(#mgi-pfeil-s)" />
        ))}
        <Box x={218} y={296} w={134} h={34} titel="Mähroboter" />
        <Box x={218} y={340} w={134} h={34} titel="RTK-Antenne" />
        <Box x={218} y={384} w={134} h={34} titel="Kühlschrank" />

        {/* Tische */}
        <path d="M107,418 V458" fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={2.2} markerEnd="url(#mgi-pfeil-s)" />
        <Rahmen x={4} y={436} w={352} h={174} titel="Vorne bei den Tischen" rechts />
        <Box x={42} y={458} w={276} h={42} titel="Pufferbatterie" unter="LiFePO₄ · 12,8 V · 100 Ah (≈ 1.280 Wh)" />
        {/* je Tisch 2 XT60-Ladeanschlüsse, jeder einzeln mit 15 A abgesichert */}
        <path d="M180,500 V508 M55,508 H305" fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={2.2} />
        {[
          { x: 18, mitte: 95, titel: 'Tisch 1' },
          { x: 188, mitte: 265, titel: 'Tisch 2' },
        ].map((t) => (
          <g key={t.titel}>
            <rect x={t.x} y={512} width={154} height={92} rx={10} fill="none" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1} strokeDasharray="4 3" />
            <text x={t.mitte} y={598} textAnchor="middle" fontSize={11.5} fontWeight={700} className="fill-slate-600 dark:fill-slate-300">{t.titel}</text>
          </g>
        ))}
        {[55, 135, 225, 305].map((c) => (
          <g key={c}>
            <path d={`M${c},508 V518 M${c},538 V548`} fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={2.2} />
            <rect x={c - 32} y={518} width={64} height={20} rx={5} className="fill-white stroke-mgi-rot dark:fill-slate-900" strokeWidth={1.6} />
            <text x={c} y={532} textAnchor="middle" fontSize={10.5} fontWeight={700} className="fill-mgi-rot">15 A</text>
            <Box x={c - 32} y={548} w={64} h={30} titel="XT60" />
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-slate-500">Stromversorgung am Platz</figcaption>
    </figure>
  );
}

/** Blockschaltbild der Ladeanschlüsse an den Tischen: Pufferbatterie → je Tisch 2 × XT60, jeder einzeln mit 15 A abgesichert */
export function BlockschaltbildLadung() {
  const leitung = 'stroke-sky-600 dark:stroke-sky-400';
  return (
    <figure className="my-2">
      <svg viewBox="0 0 360 352" className="h-auto w-full" role="img" aria-labelledby="bsl-titel">
        <title id="bsl-titel">Blockschaltbild der Ladeanschlüsse: Das Bluetti im Gartenhaus lädt über einen DC-DC-Wandler die Pufferbatterie an den Tischen. Daran hängen an Tisch 1 und Tisch 2 je zwei XT60-Ladeanschlüsse, jeder einzeln mit 15 Ampere abgesichert.</title>
        <defs>
          <marker id="mgi-pfeil-l" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="fill-slate-500 dark:fill-slate-400" />
          </marker>
        </defs>

        <text x={180} y={14} textAnchor="middle" fontSize={10.5} className="fill-slate-600 dark:fill-slate-300">vom Bluetti im Gartenhaus · 12 V DC</text>
        <path d="M180,20 V38" fill="none" className={leitung} strokeWidth={2.2} markerEnd="url(#mgi-pfeil-l)" />
        <Box x={105} y={40} w={150} h={32} titel="DC-DC-Wandler" art="aus" />
        <path d="M180,72 V92" fill="none" className={leitung} strokeWidth={2.2} markerEnd="url(#mgi-pfeil-l)" />
        <Box x={42} y={94} w={276} h={42} titel="Pufferbatterie" unter="LiFePO₄ · 12,8 V · 100 Ah (≈ 1.280 Wh)" />

        {/* Verteilung auf 4 Anschlüsse */}
        <path d="M180,136 V146 M55,146 H305" fill="none" className={leitung} strokeWidth={2.2} />
        {[
          { x: 18, mitte: 95, titel: 'Tisch 1' },
          { x: 188, mitte: 265, titel: 'Tisch 2' },
        ].map((t) => (
          <g key={t.titel}>
            <rect x={t.x} y={150} width={154} height={160} rx={10} fill="none" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1} strokeDasharray="4 3" />
            <text x={t.mitte} y={304} textAnchor="middle" fontSize={11.5} fontWeight={700} className="fill-slate-600 dark:fill-slate-300">{t.titel}</text>
          </g>
        ))}
        {[55, 135, 225, 305].map((c) => (
          <g key={c}>
            <path d={`M${c},146 V158 M${c},178 V190`} fill="none" className={leitung} strokeWidth={2.2} />
            <rect x={c - 32} y={158} width={64} height={20} rx={5} className="fill-white stroke-mgi-rot dark:fill-slate-900" strokeWidth={1.6} />
            <text x={c} y={172} textAnchor="middle" fontSize={10.5} fontWeight={700} className="fill-mgi-rot">15 A</text>
            <Box x={c - 32} y={190} w={64} h={30} titel="XT60" />
            <path d={`M${c},220 V240`} fill="none" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth={1.6} strokeDasharray="3 3" markerEnd="url(#mgi-pfeil-l)" />
            <rect x={c - 32} y={242} width={64} height={44} rx={8} fill="none" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1.2} strokeDasharray="4 3" />
            <text x={c} y={260} textAnchor="middle" fontSize={10.5} fontWeight={600} className="fill-slate-600 dark:fill-slate-300">Ladegerät</text>
            <text x={c} y={275} textAnchor="middle" fontSize={10} className="fill-slate-500 dark:fill-slate-400">→ Akku</text>
          </g>
        ))}

        <text x={180} y={332} textAnchor="middle" fontSize={11} fontWeight={700} className="fill-tinte dark:fill-slate-100">je XT60-Anschluss max. 15 A</text>
        <text x={180} y={346} textAnchor="middle" fontSize={10} className="fill-slate-600 dark:fill-slate-300">bei 12,8 V rund 190 W Ladeleistung je Anschluss</text>
      </svg>
      <figcaption className="mt-1 text-center text-xs text-slate-500">Ladeanschlüsse an den Tischen</figcaption>
    </figure>
  );
}
