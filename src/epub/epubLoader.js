// EPUB 3 (mit/ohne Media Overlays) → internes Werk-Format von loader.js (A-004, 24.10.2026).
// container.xml → OPF → Spine → je XHTML: SMIL-<par> = Satz (Text per #id, Audio + clipBegin/clipEnd).
// Ohne Media Overlay: Kapitel nur lesbar (Sätze aus den Absätzen, kein Audio).
// Alles lokal im Browser; Audio als Blob-URL. Wortzeiten gibt es bei EPUB nicht → nur Satzebene.
import { openZip } from "./zip.js";
import { setSprecherGeschlecht } from "../components/SprecherLabel.jsx";

const XML = "application/xml";
const BLOCK = "p,h1,h2,h3,h4,h5,h6,li,blockquote,dd,dt,figcaption,pre,td,th";

const parse = (txt, type = XML) => new DOMParser().parseFromString(txt, type);
const byLocal = (root, name) => [...root.getElementsByTagName("*")].filter((e) => e.localName === name);
const first = (root, name) => byLocal(root, name)[0] || null;
const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

// Pfad relativ zu einer Datei im ZIP auflösen (ohne Fragment)
function resolve(baseFile, href) {
  const [p] = decodeURIComponent(href).split("#");
  if (!p) return baseFile;
  const parts = baseFile.split("/").slice(0, -1);
  for (const seg of p.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
const fragOf = (href) => (href.includes("#") ? decodeURIComponent(href.split("#")[1]) : "");

// SMIL-Zeit: Clock (h:mm:ss.fff / mm:ss.fff) oder Timecount (1.2s, 1200ms, 2min, 1h) → Sekunden
export function smilTime(v) {
  if (v == null || v === "") return null;
  let s = String(v).trim().replace(/^npt=/, "");
  if (s.includes(":")) {
    const p = s.split(":").map(Number);
    while (p.length < 3) p.unshift(0);
    return p[0] * 3600 + p[1] * 60 + p[2];
  }
  const m = s.match(/^([\d.]+)\s*(h|min|s|ms)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return { h: n * 3600, min: n * 60, ms: n / 1000 }[m[2]] ?? n;
}

// Sätze eines Absatzes (nur für Kapitel ohne Media Overlay)
function sentences(text, lang) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter(lang, { granularity: "sentence" });
    return [...seg.segment(text)].map((x) => clean(x.segment)).filter(Boolean);
  }
  return text.match(/[^.!?…]+[.!?…]*["“”»«')\]]*\s*/g)?.map(clean).filter(Boolean) || [text];
}

const slugify = (s) => clean(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// source: File/Blob (lokal gewählt) oder URL (Demo-Werk)
export async function loadEpub(source) {
  const zip = await openZip(source);
  const container = parse(await zip.text("META-INF/container.xml") || "");
  const opfPath = first(container, "rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("EPUB ohne container.xml/OPF");
  const opf = parse(await zip.text(opfPath));

  // Metadaten
  const md = first(opf, "metadata");
  const dc = (n) => clean(first(md, n)?.textContent);
  const titel = dc("title") || "Ohne Titel";
  const autor = dc("creator");
  const sprache = (dc("language") || "en").slice(0, 2).toLowerCase();
  const lang = sprache === "de" ? "de" : "en";
  const ident = dc("identifier");

  // Manifest + Spine
  const items = {};
  for (const it of byLocal(opf, "item")) {
    items[it.getAttribute("id")] = {
      href: resolve(opfPath, it.getAttribute("href")),
      type: it.getAttribute("media-type") || "",
      overlay: it.getAttribute("media-overlay"),
      props: (it.getAttribute("properties") || "").split(/\s+/),
    };
  }
  const spine = byLocal(opf, "itemref")
    .filter((r) => r.getAttribute("linear") !== "no")
    .map((r) => items[r.getAttribute("idref")])
    .filter((it) => it && /html/.test(it.type));

  // Kapiteltitel aus dem Navigationsdokument (EPUB 3 nav), Schlüssel = Datei
  const tocTitel = {};
  const navItem = Object.values(items).find((it) => it.props.includes("nav"));
  if (navItem) {
    const nav = parse(await zip.text(navItem.href), "application/xhtml+xml");
    const tocNav = byLocal(nav, "nav").find((n) => /toc/.test(n.getAttribute("epub:type") || n.getAttributeNS("http://www.idpf.org/2007/ops", "type") || "")) || first(nav, "nav");
    for (const a of tocNav ? byLocal(tocNav, "a") : []) {
      const f = resolve(navItem.href, a.getAttribute("href") || "");
      if (!tocTitel[f]) tocTitel[f] = clean(a.textContent);
    }
  }

  // Audio: je Datei eine Blob-URL (stored-Einträge bleiben Ausschnitte der Datei, kein Kopieren)
  const audioUrls = {};
  const typeOf = Object.fromEntries(Object.values(items).map((it) => [it.href, it.type]));
  async function audioUrl(path) {
    if (!(path in audioUrls)) {
      const b = await zip.blob(path, typeOf[path] || "audio/mpeg");
      audioUrls[path] = b ? URL.createObjectURL(b) : null;
    }
    return audioUrls[path];
  }

  const nodes = [];
  const kapitel = [];
  let mitAudio = 0;

  for (let ci = 0; ci < spine.length; ci++) {
    const it = spine[ci];
    const html = await zip.text(it.href);
    if (html == null) continue;
    let doc = parse(html, "application/xhtml+xml");
    if (doc.getElementsByTagName("parsererror").length) doc = parse(html, "text/html");
    const body = first(doc, "body") || doc.documentElement;
    const pre = `c${ci + 1}`;
    const heading = body.querySelector("h1,h2,h3,h4,h5,h6");
    const kapTitel = tocTitel[it.href] || clean(heading?.textContent) || `${ci + 1}`;

    // Satzliste dieses Kapitels: [{ el, text, audio, begin, end }]
    let saetze = [];
    const smilItem = it.overlay && items[it.overlay];
    if (smilItem) {
      const smil = parse(await zip.text(smilItem.href));
      const pars = byLocal(smil, "par").map((par) => {
        const t = first(par, "text"), a = first(par, "audio");
        return {
          id: fragOf(t?.getAttribute("src") || ""),
          audioPath: a ? resolve(smilItem.href, a.getAttribute("src")) : null,
          begin: smilTime(a?.getAttribute("clipBegin")) ?? 0,
          end: smilTime(a?.getAttribute("clipEnd")),
        };
      });
      for (let k = 0; k < pars.length; k++) {
        const p = pars[k];
        const el = p.id ? doc.getElementById(p.id) : null;
        const text = clean(el?.textContent);
        if (!el || !text) continue;
        let end = p.end;   // fehlt clipEnd: Beginn des nächsten Clips derselben Datei
        if (end == null) { const nx = pars[k + 1]; if (nx && nx.audioPath === p.audioPath) end = nx.begin; }
        saetze.push({ el, text, audio: p.audioPath ? await audioUrl(p.audioPath) : null, begin: p.begin, end });
      }
      if (saetze.some((s) => s.audio)) mitAudio++;
    }
    if (!saetze.length) {
      // nur lesbar: Blockelemente ohne verschachtelte Blöcke, Absätze in Sätze teilen
      for (const el of body.querySelectorAll(BLOCK)) {
        if (el.querySelector(BLOCK)) continue;
        const text = clean(el.textContent);
        if (!text) continue;
        if (/^h\d$/i.test(el.localName)) saetze.push({ el, text });
        else for (const s of sentences(text, sprache)) saetze.push({ el, text: s });
      }
    }
    if (!saetze.length) continue;

    // Kapitelanfang: vorhandene Überschrift nutzen, sonst eine Titelzeile einfügen
    const isHead = (el) => !!el.closest?.("h1,h2,h3,h4,h5,h6");
    let n = 0;
    const id = () => `${pre}-${++n}`;
    let kapGesetzt = false;
    if (!isHead(saetze[0].el)) {
      const tid = id();
      nodes.push(mk(tid, "h", kapTitel, { text: kapTitel }));
      kapitel.push({ tag_id: tid, titel: kapTitel, titel_de: kapTitel });
      kapGesetzt = true;
    }
    let block = null;
    for (const s of saetze) {
      const head = isHead(s.el);
      const blk = s.el.closest?.(BLOCK) || s.el;
      if (!head && block && blk !== block) nodes.push(mk(id(), "p", kapTitel, { text: "" }));
      block = head ? null : blk;
      const tid = id();
      nodes.push(mk(tid, head ? "h" : "s", kapTitel, s));
      if (head && !kapGesetzt) {
        kapitel.push({ tag_id: tid, titel: kapTitel, titel_de: kapTitel });
        kapGesetzt = true;
      }
    }
  }

  // Cover (EPUB 3 cover-image, sonst EPUB 2 <meta name="cover">)
  let coverUrl = null;
  const coverId = byLocal(md, "meta").find((m) => m.getAttribute("name") === "cover")?.getAttribute("content");
  const coverItem = Object.values(items).find((it) => it.props.includes("cover-image")) || items[coverId];
  if (coverItem && /^image\//.test(coverItem.type)) {
    const b = await zip.blob(coverItem.href, coverItem.type);
    if (b) coverUrl = URL.createObjectURL(b);
  }

  setSprecherGeschlecht({});
  return {
    meta: {
      originalsprache: lang, titel, autor,
      slug: "epub-" + (slugify(ident) || slugify(titel)),
      base: "", modus: "", sprecherGeschlecht: {},
      quelle: "epub", einsprachig: true, mediaOverlay: mitAudio > 0,
    },
    coverSrc: () => coverUrl,
    nodes,
    kapitel,
    soloNote: null,
    blurb: null,
    wordtimes: { en: null, de: null },   // EPUB: nur Satzebene
  };

  // Einsprachig: beide Sprachfelder tragen denselben Satz (Sprachweiche bleibt ohne Sonderweg lauffähig)
  function mk(tag_id, typ, kap, s) {
    const e = { text: s.text || "", audio: s.audio || null, begin: s.audio ? s.begin : undefined, end: s.audio ? s.end : undefined };
    return { tag_id, typ, kapitel: kap, en: e, de: e, align: null, pause: 0, sprecher: null, rolle: null };
  }
}
