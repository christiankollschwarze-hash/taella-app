// Katalog für den Book-Shop: Demo-Werke aus public/demo/katalog.json
// (vom Read-Layer-Cockpit befüllt, tools/export_demo.py).
//
// Sonderfall: "Der Ruf der Wildnis" liegt zusätzlich MIT Audio im public-Wurzelordner
// (Entwicklungsstand). Dann nehmen wir die Wurzel-Fassung (base ""), damit Hören geht.

const ROOT_WORK = {
  slug: "call-of-the-wild",
  titel: { en: "The Call of the Wild", de: "Der Ruf der Wildnis" },
  autor: "Jack London",
  erscheinungsjahr: 1903,
  sprachen: ["de", "en"],
  cover: ["cover_de.jpg", "cover_en.jpg"],
  kapitel: 7,
  woerter: 31754,
  audio_vorhanden: { en: true, de: true },
  audio_im_demo: true,
  regal: "abenteuer",
};

async function optionalJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return null;
    return await r.json();
  } catch { return null; }
}

export async function loadKatalog() {
  const k = await optionalJson("/demo/katalog.json");
  const werke = (k?.werke || []).map((w) => ({ ...w, base: `/demo/${w.slug}` }));
  const i = werke.findIndex((w) => w.slug === ROOT_WORK.slug);
  const root = { ...ROOT_WORK, base: "" };
  if (i >= 0) werke[i] = { ...werke[i], ...root };
  else if (await optionalJson("/blurb.json")) werke.unshift(root);
  return werke;
}

// Cover-URL eines Katalog-Eintrags in der gewünschten Sprache
export function coverOf(w, lang) {
  const c = w.cover || [];
  const pick = c.find((f) => f === `cover_${lang}.jpg`) || c.find((f) => f === "cover_en.jpg") || c[0];
  return pick ? `${w.base}/${pick}` : null;
}

export function titelOf(w, lang) {
  return w.titel?.[lang] || w.titel?.en || w.titel?.de || w.slug;
}

// Hörbar heißt: Audio liegt auch wirklich in der Demo/App
export function hoerbar(w) {
  return !!w.audio_im_demo && Object.values(w.audio_vorhanden || {}).some(Boolean);
}

// Privates Regal (17.10.2026): eigene ePub-Uploads eines TÆLLA-Users, nie im Katalog.
// Read Layer legt sie mit tools/export_demo.py nach public/privat/<uid>/ (eigene katalog.json).
// Demo: fester Testnutzer, bis es Konten gibt.
export const DEMO_USER = { uid: "mikemustermann", name: "MikeMustermann" };

export async function loadPrivat(user = DEMO_USER) {
  const k = await optionalJson(`/privat/${user.uid}/katalog.json`);
  return (k?.werke || []).map((w) => ({ ...w, base: `/privat/${user.uid}/${w.slug}`, privat: true, owner: user.name }));
}
