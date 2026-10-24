import { setSprecherGeschlecht } from "../components/SprecherLabel.jsx";
// Werke liegen entweder im public-Wurzelordner (base "") oder unter /demo/<slug> (Book-Shop).

// Lokale Entwicklung: Satz-Audios liegen als WAV unter /public/audio/<lang>/<tag_id>.wav
// (Sync via read_layer/taella_audio_de_sync.bat). Produktion später: gs://…/<tag_id>.mp3
const LOCAL_AUDIO_EXT = ".wav";

function localAudio(gsPath, base) {
  if (!gsPath) return null;
  // Demo-Manifest: relativer Pfad "audio/<lang>/<tag>.wav" neben dem Manifest
  if (!/^\w+:\/\//.test(gsPath) && !gsPath.startsWith("/")) return `${base}/${gsPath}`;
  const m = gsPath.match(/\/audio\/(\w+)\/([^/]+)\.\w+$/);
  return m ? `/audio/${m[1]}/${m[2]}${LOCAL_AUDIO_EXT}` : null;
}

// Optionale JSON-Datei (fehlt sie, liefert der Dev-Server ggf. index.html → null)
async function optionalJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return null;
    return await r.json();
  } catch { return null; }
}

export async function loadWork(base = "", extra = {}) {
  // EPUB 3 (A-004): Datei oder URL → gleiches Werk-Format, lokal im Browser umgewandelt
  if (extra.epub) return (await import("../epub/epubLoader.js")).loadEpub(extra.epub);
  const BASE = base;
  const [en, de] = await Promise.all([
    fetch(`${BASE}/manifest_en.json`).then((r) => r.json()),
    fetch(`${BASE}/manifest_de.json`).then((r) => r.json()),
  ]);

  // Anker = Originalsprache des Werks (Sprachweiche 22.10.2026): EN-Werke wie bisher,
  // deutsche Originale (z. B. Die Spiegelschwestern) ankern im DE-Manifest.
  const quelle = en.originalsprache || de.originalsprache || "en";
  const anker = quelle === "de" ? de : en;
  const gegenueber = quelle === "de" ? en : de;
  const otherById = {};
  for (const s of gegenueber.saetze) otherById[s.tag_id] = s;

  const kapitel = [];
  const seenKap = new Set();

  const nodes = anker.saetze.map((s) => {
    const o = otherById[s.tag_id] || {};
    const e = quelle === "de" ? o : s;
    const d = quelle === "de" ? s : o;
    if (s.typ === "h" && !seenKap.has(s.tag_id)) {
      seenKap.add(s.tag_id);
      kapitel.push({ tag_id: s.tag_id, titel: e.text || d.text, titel_de: d.text || e.text });
    }
    return {
      tag_id: s.tag_id,
      typ: s.typ,
      kapitel: s.kapitel,
      en: { text: e.text || "", audio: localAudio(e.audio_path, BASE) },
      de: { text: d.text || "", audio: localAudio(d.audio_path, BASE) },
      align: s.align || null,
      pause: s.pause_after_ms || 0,
      sprecher: s.sprecher || null,   // Drama-Modus: Rollenname (nur Anzeige)
      rolle: s.rolle || null,         // "regie" = Regieanweisung
    };
  });

  const soloNote = en.solo_note || null;

  // Cover + Klappentext (aus read_layer/tools/export_app.py), optional
  const blurb = await optionalJson(`${BASE}/blurb.json`);

  // Wort-Zeitmarken (Stage 58c → export_app.py), optional: { tag_id: [t0, …] } je Sprache
  const [wtEn, wtDe] = await Promise.all([
    optionalJson(`${BASE}/wordtimes_en.json`),
    optionalJson(`${BASE}/wordtimes_de.json`),
  ]);

  setSprecherGeschlecht(en.sprecher_geschlecht);
  return {
    meta: { originalsprache: quelle, titel: en.titel, autor: en.autor, slug: en.book_slug, base: BASE, modus: en.modus || "", sprecherGeschlecht: en.sprecher_geschlecht || {} },
    // Cover-URL je Sprache; Demo-Werke ohne cover_<lang>.jpg nutzen das Fallback-Bild
    coverSrc(lang) {
      const c = blurb?.covers || [];
      const l = c.includes(lang) ? lang : c.includes("en") ? "en" : c[0];
      if (l) return `${BASE}/cover_${l}.jpg`;
      return extra.cover ? `${BASE}/${extra.cover}` : null;
    },
    nodes,
    kapitel,
    soloNote,
    blurb,
    wordtimes: { en: wtEn?.tags || null, de: wtDe?.tags || null },
  };
}
