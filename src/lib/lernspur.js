// Lernspur: merkt sich still alles, was sich der Nutzer übersetzen lässt.
//   - "phrase":       Wort/Phrase im Lesetext angetippt (Flyover)
//   - "klappentext":  dasselbe im Klappentext
//   - "upps_hoeren":  Satz-Upps beim Hören (ganzer Satz in der anderen Sprache)
// Rohdaten für eine spätere Lernschicht (Vokabeln, Wiederholung, Schwierigkeitsgrad).
// Nur lokal (localStorage), nichts verlässt das Gerät.

const KEY = "taella_lernspur";
const MAX = 10000;                  // älteste Einträge fallen raus
let werk = null;                    // aktuell geöffnetes Werk (slug)

export function setLernWerk(slug) { werk = slug || null; }

export function lernspur() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch { return []; }
}

export function merke({ art, tag_id, von, nach, quelle, ziel, satz }) {
  if (!quelle && !ziel) return;
  const e = {
    zeit: new Date().toISOString(),
    werk, art, tag_id,
    von, nach: nach || (von === "en" ? "de" : "en"),
    quelle: (quelle || "").trim(),     // was angetippt wurde (in der Lesesprache)
    ziel: (ziel || "").trim(),         // was gezeigt/gespielt wurde (andere Sprache)
  };
  if (satz && satz !== e.quelle) e.satz = satz;   // Kontext: ganzer Satz
  try {
    const l = lernspur();
    l.push(e);
    localStorage.setItem(KEY, JSON.stringify(l.length > MAX ? l.slice(-MAX) : l));
  } catch { /* Speicher voll/gesperrt: Lernspur ist optional */ }
}

export function loescheLernspur() { try { localStorage.removeItem(KEY); } catch {} }

// Download als JSON (für Auswertung/Entwicklung der Lernschicht)
export function exportiereLernspur() {
  const blob = new Blob([JSON.stringify(lernspur(), null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `taella_lernspur_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Statistik je Werk: wie oft nachgeschlagen, verteilt auf Kapitel (c001 …).
// Sinkt die Zahl über die Kapitel, wächst der Kenntnisstand.
export function statistik(slug) {
  const l = lernspur().filter((e) => e.werk === slug);
  const woerter = l.filter((e) => e.art === "phrase");
  const upps = l.filter((e) => e.art === "upps_hoeren");
  const proKapitel = {};
  for (const e of l) {
    const k = (String(e.tag_id || "").match(/^c(\d+)/) || [])[1];
    if (!k) continue;
    const n = Number(k);
    proKapitel[n] = proKapitel[n] || { woerter: 0, upps: 0 };
    proKapitel[n][e.art === "upps_hoeren" ? "upps" : "woerter"] += 1;
  }
  const verschieden = new Set(woerter.map((e) => e.quelle.toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, ""))).size;
  return { woerter: woerter.length, verschieden, upps: upps.length, proKapitel };
}
