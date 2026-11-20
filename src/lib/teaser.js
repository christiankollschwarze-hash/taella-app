// Hör-Teaser im Book-Shop (20.11.2026): gesprochener Klappentext aus read_layer Stage 640,
// ausgeliefert von 710 als teaser/<lg>/audio/<id>.mp3 + manifest.json (snippets in Lesefolge
// Köder → Einordnung → Autor). Vorbild ElevenReader: beim Durchblättern spielt die Karte, die
// mittig liegt; Weiterwischen, Buch öffnen oder Shop verlassen beendet den Teaser.
// Ein einziges <audio>-Element für die ganze App; Zustand per subscribe() für die Anzeige.

const AN_KEY = "taella_teaser";              // "0" = Teaser stumm (Nutzerwahl, bleibt gespeichert)
const PAUSE_SATZ = 350, PAUSE_BLOCK = 800;   // ms, wie in Stage 640 (PROZESS_klappentext_erzaehler.md)
const FADE_MS = 220;

let audio = null;
let lauf = 0;                 // Generation: jeder Start/Stopp macht laufende Ketten ungültig
let timer = null;
let zustand = { slug: null, status: "aus" };   // status: aus | laedt | spielt | blockiert
const hoerer = new Set();
const cache = new Map();      // `${base}|${lg}` → Promise<Liste|null>

function melden(z) { zustand = { ...zustand, ...z }; hoerer.forEach((f) => f(zustand)); }
export function subscribe(f) { hoerer.add(f); f(zustand); return () => hoerer.delete(f); }
export const teaserZustand = () => zustand;

export function teaserAn() { try { return localStorage.getItem(AN_KEY) !== "0"; } catch { return true; } }
export function setTeaserAn(on) {
  try { localStorage.setItem(AN_KEY, on ? "1" : "0"); } catch {}
  if (!on) teaserStop();
  melden({});
}

// Sprache des Teasers: Oberflächensprache, sonst Quellsprache, sonst irgendeine vorhandene
export function teaserSprache(w, ui) {
  const t = w?.teaser;
  if (!t) return null;
  const da = (l) => (Array.isArray(t) ? t.includes(l) : !!t[l]);
  const kand = [ui, w.quellsprache, ...(Array.isArray(t) ? t : Object.keys(t))];
  return kand.find((l) => l && da(l)) || null;
}
export const hatTeaser = (w, ui) => !!teaserSprache(w, ui);

async function liste(w, lg) {
  const key = `${w.base}|${lg}`;
  if (!cache.has(key)) {
    const dir = `${w.base}/teaser/${lg}/audio`;
    cache.set(key, fetch(`${dir}/manifest.json`)
      .then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : null))
      .then((m) => {
        const sn = Array.isArray(m?.snippets) ? m.snippets
          : m?.snippets ? Object.entries(m.snippets).map(([id, v]) => ({ id, ...v })) : [];
        const l = sn.filter((s) => s && (s.id || s.datei || s.file)).map((s) => ({
          src: `${dir}/${s.datei || s.file || `${s.id}.mp3`}`,
          block: s.block || String(s.id || "").replace(/_\d+$/, ""),
        }));
        return l.length ? l : null;
      })
      .catch(() => null));
  }
  return cache.get(key);
}

function el() {
  if (!audio) { audio = new Audio(); audio.preload = "auto"; }
  return audio;
}

function ausblenden(a, fertig) {
  const start = a.volume, t0 = performance.now();
  const schritt = (t) => {
    const k = Math.min(1, (t - t0) / FADE_MS);
    a.volume = start * (1 - k);
    if (k < 1 && !a.paused) requestAnimationFrame(schritt); else { a.pause(); a.volume = 1; fertig?.(); }
  };
  requestAnimationFrame(schritt);
}

export function teaserStop() {
  lauf++;
  clearTimeout(timer);
  if (audio && !audio.paused) ausblenden(audio); else if (audio) audio.pause();
  if (zustand.slug || zustand.status !== "aus") melden({ slug: null, status: "aus" });
}

// Teaser eines Werks starten; läuft derselbe schon, passiert nichts
export async function teaserSpielen(w, ui) {
  if (!w || !teaserAn()) return;
  if (zustand.slug === w.slug && zustand.status !== "aus" && zustand.status !== "blockiert") return;
  const lg = teaserSprache(w, ui);
  if (!lg) { teaserStop(); return; }
  teaserStop();
  const meinLauf = lauf;
  melden({ slug: w.slug, status: "laedt" });
  const l = await liste(w, lg);
  if (meinLauf !== lauf) return;
  if (!l) { melden({ slug: null, status: "aus" }); return; }
  const a = el();
  const spiele = async (i) => {
    if (meinLauf !== lauf) return;
    if (i >= l.length) { melden({ slug: null, status: "aus" }); return; }
    a.src = l[i].src;
    a.volume = 1;
    a.onended = () => {
      if (meinLauf !== lauf) return;
      const pause = l[i + 1] && l[i + 1].block !== l[i].block ? PAUSE_BLOCK : PAUSE_SATZ;
      timer = setTimeout(() => spiele(i + 1), pause);
    };
    try {
      await a.play();
      if (meinLauf === lauf) melden({ slug: w.slug, status: "spielt" });
    } catch (e) {
      if (meinLauf !== lauf) return;
      // Browser blockt Autoplay ohne vorherige Berührung → beim nächsten Tippen erneut
      if (e?.name === "NotAllowedError") {
        melden({ slug: w.slug, status: "blockiert" });
        const nochmal = () => { if (meinLauf === lauf) { lauf++; melden({ status: "aus" }); teaserSpielen(w, ui); } };
        window.addEventListener("pointerdown", nochmal, { once: true, capture: true });
      } else {
        spiele(i + 1);   // defekte Datei überspringen
      }
    }
  };
  spiele(0);
}
