import { setSprecherGeschlecht } from "../components/SprecherLabel.jsx";
// Werke liegen unter /demo/<slug> (Book-Shop) bzw. /privat/<uid>/<slug>; Audio-Pfade im Manifest
// relativ zum Werkordner ("audio/<lang>/<tag>.wav"). Das alte Startwerk im public-Wurzelordner
// (gs://-Pfade → /audio/<lang>/) ist seit N-3 archiviert.
const LOCAL_AUDIO_EXT = ".wav";   // Hörspiel-Schicht: audio_hoerspiel/<lang>/<tag>.wav

function localAudio(path, base) {
  if (!path || /^\w+:\/\//.test(path)) return null;
  return path.startsWith("/") ? path : `${base}/${path}`;
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

  // Hörspiel-Schicht (N-3): je Sprache optional, Overlay-Sätze unter audio_hoerspiel/<lang>/
  const hs = {};
  for (const [l, m] of [["en", en], ["de", de]]) {
    if (m.hoerspiel && Array.isArray(m.hoerspiel_saetze))
      hs[l] = { saetze: new Set(m.hoerspiel_saetze), sprecher: m.hoerspiel_sprecher || {} };
  }
  const hsEntry = (l, tag) => hs[l]?.saetze.has(tag)
    ? { audio_hs: `${BASE}/audio_hoerspiel/${l}/${tag}${LOCAL_AUDIO_EXT}`, sprecher_hs: hs[l].sprecher[tag] || null }
    : {};

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
      en: { text: e.text || "", audio: localAudio(e.audio_path, BASE), ...hsEntry("en", s.tag_id) },
      de: { text: d.text || "", audio: localAudio(d.audio_path, BASE), ...hsEntry("de", s.tag_id) },
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
  const [wtEn, wtDe, wtHsEn, wtHsDe] = await Promise.all([
    optionalJson(`${BASE}/wordtimes_en.json`),
    optionalJson(`${BASE}/wordtimes_de.json`),
    hs.en ? optionalJson(`${BASE}/wordtimes_en_hoerspiel.json`) : null,
    hs.de ? optionalJson(`${BASE}/wordtimes_de_hoerspiel.json`) : null,
  ]);

  setSprecherGeschlecht(en.sprecher_geschlecht);
  return {
    meta: { originalsprache: quelle, titel: en.titel, autor: en.autor, slug: en.book_slug, base: BASE, modus: en.modus || "", sprecherGeschlecht: en.sprecher_geschlecht || {},
            hoerspiel: { en: !!hs.en, de: !!hs.de } },
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
    // Hörspiel-Sätze: eigene Wortzeiten, sonst Schätzung (nie die Erzähler-Zeiten)
    wordtimesHs: { en: wtHsEn?.tags || {}, de: wtHsDe?.tags || {} },
  };
}
