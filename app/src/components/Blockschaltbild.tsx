/**
 * Blockschaltbild der MGI-Wetterstation (nach der Firmware „Wetterstation-5.0“).
 * Reines SVG, passt sich hell/dunkel über currentColor und Tailwind-Klassen an.
 */
function Box({ x, y, w, h, titel, unter, art = 'sensor' }: { x: number; y: number; w: number; h: number; titel: string; unter?: string; art?: 'sensor' | 'mcu' | 'aus' | 'netz' }) {
  const fuell = {
    sensor: 'fill-himmel-50 stroke-himmel-400 dark:fill-slate-800 dark:stroke-himmel-600',
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
