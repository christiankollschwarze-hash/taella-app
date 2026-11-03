import { setSprecherGeschlecht } from "../components/SprecherLabel.jsx";
// Werke liegen unter /demo/<slug> (Book-Shop) bzw. /privat/<uid>/<slug>; Pfade im Manifest relativ zum Werkordner.
// AP 710c (03.11.2026): Paket aus read_layer Stage 710 (Manifest-Schema 2). Sprachen aus Katalog/Manifest statt
// fest en/de, Schema-Version geprüft, Hörspiel-Pfad je Satz aus dem Manifest (audio_hs_path), Wortzeiten/Cover/
// Teaser über manifest.dateien, EPUB-Download aus dem Katalogfeld downloads. Altpakete (Schema 1, export_demo)
// laufen weiter: fehlt schema → 1, Hörspiel dann audio_hoerspiel/<lang>/<tag>.wav.
export const APP_SCHEMA = 2;          // höchste Manifest-Version, die diese App kennt (read_layer s710 APP_SCHEMA)
const ALT_SPRACHEN = ["en", "de"];    // Schema 1: feste Manifeste manifest_en/de
const ALT_HS_EXT = ".wav";

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

export function schemaPruefen(m, lang) {
  const v = Number(m?.schema || 1);
  if (v > APP_SCHEMA) throw new Error(`manifest_${lang}.json hat Schema ${v}, diese App kennt bis ${APP_SCHEMA} – App aktualisieren`);
  return v;
}

export async function loadWork(base = "", extra = {}) {
  // EPUB 3 (A-004): Datei oder URL → gleiches Werk-Format, lokal im Browser umgewandelt
  if (extra.epub) return (await import("../epub/epubLoader.js")).loadEpub(extra.epub);
  const BASE = base;

  // Sprachen: Katalog (extra.sprachen) → sonst Altpaar en/de; danach aus dem Manifest ergänzt
  let sprachen = (extra.sprachen && extra.sprachen.length ? extra.sprachen : ALT_SPRACHEN).slice();
  const man = {};
  const laden = async (ls) => {
    const r = await Promise.all(ls.map((l) => optionalJson(`${BASE}/manifest_${l}.json`)));
    ls.forEach((l, i) => { if (r[i]) man[l] = r[i]; });
  };
  await laden(sprachen);
  const erstes = Object.values(man)[0];
  if (!erstes) throw new Error(`Kein Manifest unter ${BASE || "/"} (${sprachen.map((l) => `manifest_${l}.json`).join(", ")})`);
  const nachgeladen = (erstes.sprachen || []).filter((l) => !man[l]);
  if (nachgeladen.length) await laden(nachgeladen);
  for (const [l, m] of Object.entries(man)) schemaPruefen(m, l);
  sprachen = (erstes.sprachen || sprachen).filter((l) => man[l]);
  if (!sprachen.length) sprachen = Object.keys(man);

  // Anker = Quell-/Originalsprache des Werks; Gegenüber = erste andere Sprache (UI ist zweisprachig)
  const quelle = erstes.quellsprache || erstes.originalsprache || (man.en ? "en" : sprachen[0]);
  const anker = man[quelle] || erstes;
  const ziel = sprachen.find((l) => l !== quelle) || null;
  const byId = {};
  for (const l of sprachen) { byId[l] = {}; for (const s of man[l].saetze || []) byId[l][s.tag_id] = s; }

  // Hörspiel-Schicht je Sprache: Schema 2 → audio_hs_path je Satz; Schema 1 → Liste + fester .wav-Pfad
  const hs = {};
  for (const l of sprachen) {
    const m = man[l];
    if (m.hoerspiel && Array.isArray(m.hoerspiel_saetze))
      hs[l] = { saetze: new Set(m.hoerspiel_saetze), sprecher: m.hoerspiel_sprecher || {}, schema: Number(m.schema || 1) };
  }
  const hsEntry = (l, tag, m = {}) => {
    const h = hs[l];
    if (!h || !h.saetze.has(tag)) return {};
    const pfad = m.audio_hs_path || (h.schema < 2 ? `audio_hoerspiel/${l}/${m.basis_tag || tag}${ALT_HS_EXT}` : null);
    if (!pfad) return {};
    return { audio_hs: localAudio(pfad, BASE), begin_hs: m.hs_begin, end_hs: m.hs_end, sprecher_hs: h.sprecher[tag] || null };
  };
  // Satzweise Knoten (Schema 1): Clip-Fenster clip_begin/clip_end
  const clip = (m) => ({ begin: m.clip_begin, end: m.clip_end });
  const slot = (l, tag) => {
    const m = byId[l]?.[tag] || {};
    return { text: m.text || "", audio: localAudio(m.audio_path, BASE), ...clip(m), ...hsEntry(l, tag, m) };
  };

  const kapitel = [];
  const seenKap = new Set();
  const nodes = (anker.saetze || []).map((s) => {
    const n = {
      tag_id: s.tag_id,
      typ: s.typ,
      kapitel: s.kapitel,
      // Anker zur Gegenüber-Sprache: Schema 2 align_<ziel>, sonst align (= erste Zielsprache)
      align: (ziel && s[`align_${ziel}`]) || s.align || null,
      pause: s.pause_after_ms || 0,
      sprecher: s.sprecher || null,   // Drama-Modus: Rollenname (nur Anzeige)
      rolle: s.rolle || null,         // "regie" = Regieanweisung
      bild: s.typ === "bild" && s.bild ? localAudio(s.bild, BASE) : null,   // AP 58: Abbildung
      alt: s.alt || "",
    };
    for (const l of new Set([...sprachen, ...ALT_SPRACHEN])) n[l] = slot(l, s.tag_id);
    if (s.typ === "h" && !seenKap.has(s.tag_id)) {
      seenKap.add(s.tag_id);
      kapitel.push({ tag_id: s.tag_id, titel: n.en.text || n[quelle].text, titel_de: n.de.text || n[quelle].text,
                     titel_je: Object.fromEntries(sprachen.map((l) => [l, n[l].text])) });
    }
    return n;
  });

  // Klappentext + Cover (blurb.json je Werk), Wortzeiten je Sprache/Spur über manifest.dateien
  const blurb = await optionalJson(`${BASE}/blurb.json`);
  const datei = (l, k, alt) => { const d = man[l]?.dateien; return d ? d[k] : alt; };
  const wtUrls = sprachen.flatMap((l) => [
    [l, "hb", datei(l, "wordtimes", `wordtimes_${l}.json`)],
    [l, "hs", hs[l] ? datei(l, "wordtimes_hoerspiel", `wordtimes_${l}_hoerspiel.json`) : null],
  ]);
  const wtDaten = await Promise.all(wtUrls.map(([, , u]) => (u ? optionalJson(`${BASE}/${u}`) : null)));
  const wordtimes = {}, wordtimesHs = {};
  wtUrls.forEach(([l, spur], i) => {
    if (spur === "hb") wordtimes[l] = wtDaten[i]?.tags || null;
    else wordtimesHs[l] = wtDaten[i]?.tags || {};
  });
  for (const l of ALT_SPRACHEN) { if (!(l in wordtimes)) wordtimes[l] = null; if (!(l in wordtimesHs)) wordtimesHs[l] = {}; }

  const teaser = {};
  for (const l of sprachen) { const t = datei(l, "teaser", null); if (t) teaser[l] = `${BASE}/${t.replace(/\/$/, "")}`; }
  const downloads = {};
  for (const [l, v] of Object.entries(extra.downloads || {}))
    downloads[l] = Object.fromEntries(Object.entries(v || {}).map(([var_, p]) => [var_, localAudio(p, BASE)]));

  setSprecherGeschlecht(anker.sprecher_geschlecht);
  return {
    meta: { originalsprache: quelle, quellsprache: quelle, zielsprache: ziel, sprachen, schema: Number(anker.schema || 1),
            titel: anker.titel, titel_je: Object.fromEntries(sprachen.map((l) => [l, man[l].titel])),
            autor: anker.autor, slug: anker.book_slug, base: BASE, modus: anker.modus || "",
            zitat_teilen: anker.zitat_teilen, sprecherGeschlecht: anker.sprecher_geschlecht || {},
            hoerspiel: Object.fromEntries([...new Set([...sprachen, ...ALT_SPRACHEN])].map((l) => [l, !!hs[l]])),
            teaser, downloads },
    // Cover-URL je Sprache: manifest.dateien.cover, sonst blurb.covers; Demo-Werke ohne cover_<lang>.jpg → Fallback
    coverSrc(lang) {
      const d = datei(lang, "cover", null);
      if (d) return `${BASE}/${d}`;
      const c = blurb?.covers || [];
      const l = c.includes(lang) ? lang : c.includes(quelle) ? quelle : c[0];
      if (l) return `${BASE}/cover_${l}.jpg`;
      return extra.cover ? `${BASE}/${extra.cover}` : null;
    },
    nodes,
    kapitel,
    soloNote: anker.solo_note || null,
    blurb,
    wordtimes,
    // Hörspiel-Sätze: eigene Wortzeiten, sonst Schätzung (nie die Erzähler-Zeiten)
    wordtimesHs,
  };
}
