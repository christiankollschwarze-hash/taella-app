// Einstellungen & Nutzerzustand (nur lokal, kein Konto nötig).
// Schlüssel bleiben kompatibel zu den bestehenden: taella_native, taella_dark,
// taella_default_lang, taella_mode, taella_bookmark_<slug>_all.

const K = {
  native: "taella_native",          // Muttersprache "de" | "en"
  onboarded: "taella_onboarded",    // "1" nach der Einführung
  dark: "taella_dark",              // "1" = Nacht
  defaultLang: "taella_default_lang",
  mode: "taella_mode",              // "read" | "listen"
  textSize: "taella_text_size",     // "s" | "m" | "l"
  konto: "taella_konto_demo",       // Demo: Vollzugang Standard; "0" = Kapitel-1-Sperre testen
  favs: "taella_favs",
  tempo: "taella_tempo",           // Hoertempo (playbackRate), Standard 1
  kurator: "taella_kurator",       // "1" = Kuratormodus (Demo/Testumgebung): Saetze markieren + Anmerkungen              // JSON-Liste von slugs
};

function get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }
function set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }

export const settings = {
  native: () => get(K.native),
  setNative: (l) => set(K.native, l),
  onboarded: () => get(K.onboarded) === "1",
  setOnboarded: (on) => set(K.onboarded, on ? "1" : null),
  dark: () => get(K.dark) === "1",
  setDark: (on) => { set(K.dark, on ? "1" : "0"); applyTheme(); },
  defaultLang: () => get(K.defaultLang),
  setDefaultLang: (l) => set(K.defaultLang, l),
  setMode: (m) => set(K.mode, m),
  textSize: () => get(K.textSize, "m"),
  setTextSize: (s) => { set(K.textSize, s); applyTextSize(); },
  konto: () => get(K.konto) !== "0",              // Demo: Vollzugang ist Standard, "0" = Sperre testen
  setKonto: (on) => set(K.konto, on ? "1" : "0"),
  tempo: () => { const t = parseFloat(get(K.tempo, "1")); return t >= 0.5 && t <= 2 ? t : 1; },
  setTempo: (t) => set(K.tempo, String(t)),
  // Hören: Erzähler | Hörspiel je Werk (N-3); null = noch nicht gewählt (Default Hörspiel)
  hoerModus: (slug) => get(`taella_hoermodus_${slug}`),
  setHoerModus: (slug, m) => set(`taella_hoermodus_${slug}`, m),
  kurator: () => get(K.kurator) === "1",
  setKurator: (on) => set(K.kurator, on ? "1" : null),
};

export function favs() {
  try { return JSON.parse(get(K.favs, "[]")) || []; } catch { return []; }
}
export function toggleFav(slug) {
  const f = favs();
  const next = f.includes(slug) ? f.filter((s) => s !== slug) : [...f, slug];
  set(K.favs, JSON.stringify(next));
  return next;
}

export function applyTheme() {
  document.documentElement.setAttribute("data-theme", settings.dark() ? "dark" : "light");
}
const SIZES = { s: "17px", m: "19px", l: "22px" };
export function applyTextSize() {
  document.documentElement.style.setProperty("--text-size", SIZES[settings.textSize()] || SIZES.m);
}

// Lesefortschritt aller Werke löschen (Lesezeichen), Einstellungen bleiben
export function resetProgress() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("taella_bookmark_")).forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// Oberflächensprache: Muttersprache, sonst Gerät
export function uiLang() {
  const n = settings.native();
  if (n === "de" || n === "en") return n;
  const l = (navigator.language || "en").slice(0, 2).toLowerCase();
  return l === "de" ? "de" : "en";
}
