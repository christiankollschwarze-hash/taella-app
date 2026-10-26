import { useCallback, useRef } from "react";
import { merke } from "../lib/lernspur.js";
import { useHoerSatz } from "../lib/hoerzustand.js";
import { hoerZeichen, laeufe } from "../lib/wortpaar.js";

const DOUBLE_TAP_MS = 350;

function segmentize(node, lang) {
  const text = node[lang]?.text || "";
  const align = node.align;
  if (!align || !align.length) return [{ text, other: null, off: 0 }];
  // Richtungsneutral (22.10.2026): Anker kann en_span (EN-Werk) oder de_span (DE-Werk) tragen.
  const other = lang === "en" ? "de" : "en";
  const spanKey = `${lang}_span`, otherSpan = `${other}_span`;
  const spans = align
    .filter((p) => {
      const sp = p[spanKey];
      return Array.isArray(sp) && sp.length === 2 && sp[0] >= 0 &&
        sp[1] <= text.length && sp[0] < sp[1] &&
        (!!p[other] || Array.isArray(p[otherSpan]));
    })
    .sort((a, b) => a[spanKey][0] - b[spanKey][0]);
  const segs = []; let cursor = 0;
  for (const p of spans) {
    const [a, b] = p[spanKey];
    if (a < cursor) continue;
    if (a > cursor) segs.push({ text: text.slice(cursor, a), other: null });
    const bubble = p[other]
      || (node[other]?.text && Array.isArray(p[otherSpan])
          ? node[other].text.slice(p[otherSpan][0], p[otherSpan][1]) : null);
    segs.push({ text: text.slice(a, b), other: bubble || null });
    cursor = b;
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor), other: null });
  let off = 0;
  for (const sg of segs) { sg.off = off; off += sg.text.length; }
  return segs;
}

// Einfach-Tipp auf Phrase → Flyover; Doppel-Tipp auf Satz → Lesezeichen (onBookmark)
export default function Satz({ node, lang, isActive, isPlaying, isBookmarked, setActive, registerRef, onBookmark }) {
  const segments = segmentize(node, lang);
  const lastTap = useRef(0);
  // AP 56: Lesen beim Hören – gehörter Satz + Wort (Teil-Token) aus dem Hörzustand
  const hoer = useHoerSatz(node.tag_id);
  const zeichen = hoer && hoer.lang === lang
    ? hoerZeichen(node, lang, hoer.time, hoer.duration, hoer.wt, hoer.quelle, hoer.hs) : null;

  // Phrase: Einfach-Tipp öffnet den Flyover. Normaler Text: Einfach-Tipp geht an die Seite
  // weiter (Tippzonen: blättern / Menü). Doppel-Tipp irgendwo im Satz: Lesezeichen.
  const handleTap = useCallback((e, seg) => {
    const now = Date.now();
    if (onBookmark && now - lastTap.current < DOUBLE_TAP_MS) {
      e.stopPropagation();
      lastTap.current = 0;
      window.getSelection?.()?.removeAllRanges();
      setActive(null);
      onBookmark(node.tag_id);
      return;
    }
    lastTap.current = now;
    if (seg.other) {
      e.stopPropagation();
      merke({
        art: String(node.tag_id).startsWith("blurb") ? "klappentext" : "phrase",
        tag_id: node.tag_id, von: lang, quelle: seg.text, ziel: seg.other, satz: node[lang]?.text,
      });
      setActive({ key: node.tag_id, el: e.currentTarget, text: seg.other });
    }
  }, [node, lang, setActive, onBookmark]);

  let cls = "satz";
  if (node.typ === "dl" && !node.sprecher) cls += " satz--dl";   // Drama-Repliken nicht kursiv
  if (node.rolle === "regie") cls += " satz--regie";
  if (isPlaying || hoer) cls += " satz--playing";
  if (isBookmarked) cls += " satz--bookmark";

  return (
    <span className={cls} data-tag={node.tag_id}>
      {segments.map((seg, i) => (
        <span
          key={i}
          className={seg.other ? "phrase" + (isActive ? " phrase--active" : "") : undefined}
          onClick={(e) => handleTap(e, seg)}
        >
          {zeichen ? laeufe(seg.text, zeichen.subarray(seg.off, seg.off + seg.text.length)).map((r, j) =>
            r.cls ? <span key={j} className={r.cls}>{r.text}</span> : r.text) : seg.text}
        </span>
      ))}{" "}
    </span>
  );
}
