// Drama-Modus: Rollenname (nur Anzeige, wird nicht gesprochen).
// Farbe je Figur (CK 13.10.2026): Erzaehler/Regie = Schriftfarbe (weiss im Nachtmodus),
// Frauen = Rottoene, Maenner = Blautoene, je Figur eigene Nuance (stabil aus dem Namen).
// Geschlecht kommt aus dem Manifest (sprecher_geschlecht, Quelle: casting.json).
let GESCHLECHT = {};
export function setSprecherGeschlecht(map) {
  GESCHLECHT = {};
  for (const [k, v] of Object.entries(map || {})) GESCHLECHT[norm(k)] = v;
}
function norm(n) { return (n || "").toUpperCase().replace(/[^A-ZÄÖÜ]/g, ""); }
function hash(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

// CSS-Variablen fuer eine Figur: --sp-h (Farbton), --sp-s (Saettigung). Helligkeit kommt aus dem Theme.
export function sprecherStil(name) {
  if (!name) return {};
  const g = GESCHLECHT[norm(name)];
  const x = hash(name);
  if (g === "w") return { "--sp-h": String((345 + (x % 30)) % 360), "--sp-s": `${55 + (x % 4) * 8}%` };   // Rosé .. Weinrot
  if (g === "m") return { "--sp-h": String(198 + (x % 38)), "--sp-s": `${50 + (x % 4) * 9}%` };            // Hellblau .. Marine
  return { "--sp-h": "0", "--sp-s": "0%" };                                                               // unbekannt: grau
}

function anzeige(name) {
  return name.toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
}

export default function SprecherLabel({ name }) {
  if (!name) return null;
  return <span className="sprecher-label" style={sprecherStil(name)}>{anzeige(name)}</span>;
}
