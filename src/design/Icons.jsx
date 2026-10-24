// TÆLLA Icon-Set (Design D): Strich in Tinte (currentColor), der rote Punkt (var(--dot))
// liegt AUF dem Strichende – nie daneben. Raster 40×40, Strich 2.6.

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" };
const Dot = ({ cx, cy, r = 2.9 }) => <circle cx={cx} cy={cy} r={r} fill="var(--dot)" />;
const Svg = ({ size = 28, children, label }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden={label ? undefined : "true"} role={label ? "img" : undefined} aria-label={label}>
    {children}
  </svg>
);

export const IconPlay = (p) => (
  <Svg {...p}><path d="M13 9 L28 18.2 L28 21.8 L13 31 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><Dot cx={29.5} cy={20} r={3.4} /></Svg>
);
export const IconPause = (p) => (
  <Svg {...p}><rect x="11" y="9" width="5.5" height="22" rx="1.5" fill="currentColor" /><rect x="22" y="9" width="5.5" height="18.5" rx="1.5" fill="currentColor" /><Dot cx={24.75} cy={29.5} r={3.4} /></Svg>
);
export const IconWortVor = (p) => (
  <Svg {...p}><path d="M15 11 L23.5 19.5 M23.5 20.5 L15 29" {...S} /><Dot cx={24.5} cy={20} /></Svg>
);
export const IconWortZurueck = (p) => (
  <Svg {...p}><path d="M25 11 L16.5 19.5 M16.5 20.5 L25 29" {...S} /><Dot cx={15.5} cy={20} /></Svg>
);
export const IconSatzVor = (p) => (
  <Svg {...p}><path d="M8 11 L17 20 L8 29 M18 11 L26.5 19.5 M26.5 20.5 L18 29" {...S} /><Dot cx={27.5} cy={20} /></Svg>
);
export const IconSatzZurueck = (p) => (
  <Svg {...p}><path d="M32 11 L23 20 L32 29 M22 11 L13.5 19.5 M13.5 20.5 L22 29" {...S} /><Dot cx={12.5} cy={20} /></Svg>
);
export const IconMenu = (p) => (
  <Svg {...p}><path d="M9 13 H31 M9 20 H31 M9 27 H23" {...S} /><Dot cx={24.5} cy={27} /></Svg>
);
export const IconHeart = ({ on, ...p }) => (
  <Svg {...p}>
    <path d="M20 29.5 C11 24 8 19 10.5 14.5 C13 10.5 17.6 11.5 20 15 C22.4 11.5 27 10.5 29.5 14.5 C32 19 29 24 20 29.5" {...S} strokeWidth="2.4" />
    {on && <Dot cx={20} cy={30} r={3.4} />}
  </Svg>
);
export const IconBook = (p) => (
  <Svg {...p}><path d="M20 12 C16 9.5 11 9.5 7 11 V29 C11 27.5 16 27.5 20 30 C24 27.5 29 27.5 33 29 V11 C29 9.5 24 9.5 20 12 V26.5" {...S} strokeWidth="2.2" /><Dot cx={20} cy={28} r={2.7} /></Svg>
);
export const IconHoeren = (p) => (
  <Svg {...p}><path d="M5 20 Q9 12 13 20 T21 20 T29 20" {...S} strokeWidth="2.4" /><Dot cx={30.5} cy={20} r={3.2} /></Svg>
);
export const IconMond = (p) => (
  <Svg {...p}><path d="M26 9 C18.5 10.5 15.5 17 17.5 23 C19.5 28.5 25.5 31 31 29 C27.5 33 19.5 33 14.5 28.5 C9 23.5 9.5 14 16.5 10 C19.5 8.4 23 8.3 26 9" {...S} strokeWidth="2.2" /><Dot cx={26} cy={9} r={2.6} /></Svg>
);
export const IconSonne = (p) => (
  <Svg {...p}><circle cx="20" cy="20" r="6" {...S} strokeWidth="2.2" /><path d="M20 5 V9 M20 31 V35 M5 20 H9 M31 20 H33.5 M9.4 9.4 L12.2 12.2 M27.8 27.8 L30.6 30.6 M9.4 30.6 L12.2 27.8 M27.8 12.2 L30.6 9.4" {...S} strokeWidth="2.2" /><Dot cx={34.5} cy={20} r={2.5} /></Svg>
);
export const IconZurueck = (p) => (
  <Svg {...p}><path d="M24 11 L15.5 19.5 M15.5 20.5 L24 29" {...S} /><Dot cx={14.5} cy={20} /></Svg>
);
// Einstellungen: drei Regler, der Punkt sitzt auf dem Ende des letzten Reglers
export const IconEinstellungen = (p) => (
  <Svg {...p}><path d="M9 13 H31 M9 20 H31 M9 27 H25" {...S} /><circle cx="15" cy="13" r="2.6" fill="var(--paper)" {...S} strokeWidth="2.2" /><circle cx="25" cy="20" r="2.6" fill="var(--paper)" {...S} strokeWidth="2.2" /><Dot cx={26.5} cy={27} /></Svg>
);
// Schließen: Kreuz, Punkt auf dem Ende des zweiten Strichs
export const IconSchliessen = (p) => (
  <Svg {...p}><path d="M12 12 L28 28 M28 12 L13.2 26.8" {...S} /><Dot cx={12.2} cy={27.8} /></Svg>
);
