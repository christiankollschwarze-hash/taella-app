import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { settings } from "../lib/settings.js";
import { useListen, tokenTimes } from "../lib/useListen.js";
import { hatAnkerzeiten, wortpaarZustand, laeufe, tokenZustand } from "../lib/wortpaar.js";
import DotWord from "../design/DotWord.jsx";
import { IconPlay, IconPause, IconWortVor, IconWortZurueck, IconSatzVor, IconSatzZurueck, IconMenu, IconBook, IconZurueck } from "../design/Icons.jsx";
import ChapterSheet from "./ChapterSheet.jsx";
import SprecherLabel, { sprecherStil } from "./SprecherLabel.jsx";
import KuratorSheet from "./KuratorSheet.jsx";
import { setHoerzustand } from "../lib/hoerzustand.js";
import { IconHoeren } from "../design/Icons.jsx";

// Audio-Ansicht (Design D): Untertitel als Typografie-Bühne mit Karaoke-Punkt,
// ohne Untertitel das Cover groß; Wellen-Zeitleiste mit rotem Punkt (nur Anzeige);
// schwarzes Dock mit Satz/Wort-Spulen, Kapitel, Sprache, Untertitel.
// AP 54c (26.10.2026): Untertitel CC → andere Sprache → beide (EN·DE) → aus; Wort + Gegenwort aus
// Ankerzeiten t/tz/zspans (lib/wortpaar.js), Teil-Token zeichengenau, ohne Anker kein Gegenwort.

const SUB_KEY = "taella_subs"; // 0 aus · 1 gehörte Sprache · 2 andere Sprache · 3 beide (AP 54c)



const TEMPI = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

// AP 56: versteckt = Lesemodus bei laufendem Hören → nur Steuerpille; Hörzustand geht an Satz.jsx (lib/hoerzustand.js).
export default function ListenView({ work, lang, nativeLang, onLangSwitch, startTag, autoplay, onSentenceStart, onToReader, onBack = null,
                                     versteckt = false, onZumHoeren = null, onSchliessen = null }) {
  const other = lang === "en" ? "de" : "en";
  const [subs, setSubs] = useState(() => {
    try { return Number(localStorage.getItem(SUB_KEY)) || 0; } catch { return 0; }
  });
  const [showChapters, setShowChapters] = useState(false);
  const [kurNode, setKurNode] = useState(null);   // Kuratormodus: Anmerkung zum aktuellen Satz

  // Erzähler | Hörspiel (N-3): nur bei Werken mit Hörspiel-Schicht in der Hörsprache; Wahl je Werk gemerkt,
  // Default Hörspiel. Wechsel wirkt ab dem nächsten Satz (useListen).
  const hatHs = !!work.meta.hoerspiel?.[lang];
  const [hoerModus, setHoerModus] = useState(() => settings.hoerModus(work.meta.slug) || "hoerspiel");
  const wechsleModus = (m) => { setHoerModus(m); settings.setHoerModus(work.meta.slug, m); };

  const p = useListen({ nodes: work.nodes, lang, wordtimes: work.wordtimes, wordtimesHs: work.wordtimesHs,
                        hoerspiel: hatHs && hoerModus === "hoerspiel", onSentenceStart });
  const wtAktiv = p.hsAktiv ? work.wordtimesHs : work.wordtimes;
  // Sprechername: bei Werken mit Hörspiel-Schicht nur im Hörspiel-Modus, sonst wie bisher (Drama-Modus)
  const figur = p.uppsLang || !p.node ? null
    : hatHs ? (p.modusAktiv === "hoerspiel" ? (p.hsAktiv && p.node[lang]?.sprecher_hs) || p.node.sprecher || null : null)
    : p.node.sprecher || null;

  // Einstieg beim Lesezeichen
  useEffect(() => {
    const i = Math.max(0, work.nodes.findIndex((n) => n.tag_id === startTag));
    p.load(i, autoplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { localStorage.setItem(SUB_KEY, String(subs)); } catch {} }, [subs]);

  const kapitel = p.node?.kapitel || work.kapitel[0]?.titel || "";
  const kapitelNode = useMemo(
    () => work.kapitel.find((k) => k.titel === kapitel),
    [work.kapitel, kapitel]
  );
  // Cover in der Muttersprache (wie Titelei), unabhängig von der Hörsprache
  const coverSrc = work.coverSrc ? work.coverSrc(nativeLang) : null;
  // AP 58: Abbildung statt Cover - letztes Bild vor dem gehoerten Satz im selben Kapitel
  const bildNode = useMemo(() => {
    for (let k = p.idx; k >= 0; k--) {
      const n = work.nodes[k];
      if (!n) continue;
      if (n.typ === "bild" && n.bild) return n;
      if (n.typ === "h") return null;
    }
    return null;
  }, [work.nodes, p.idx]);
  // Während eines Upps zeigt die Bühne immer den Upps-Satz (andere Sprache, mit Karaoke)
  const subLang = p.uppsLang || (subs === 1 || subs === 3 ? lang : subs === 2 ? other : null);
  const subText = subLang && p.node ? (p.node[subLang]?.text || "") : "";

  // Kapitel 1 frei: ab Kapitel 2 ohne Konto gesperrt (gilt auch beim Springen/Spulen)
  const kap2Idx = useMemo(() => work.kapitel[1] ? work.nodes.findIndex((n) => n.tag_id === work.kapitel[1].tag_id) : -1, [work]);
  const gesperrt = !settings.konto() && kap2Idx >= 0 && p.idx >= kap2Idx;
  useEffect(() => { if (gesperrt && p.playing) p.pause(); }, [gesperrt, p.playing, p]);

  // Kapitelmarken auf der Zeitleiste
  const marken = useMemo(() => work.kapitel.slice(1).map((k) => {
    const i = work.nodes.findIndex((n) => n.tag_id === k.tag_id);
    return i > 0 ? p.fracOf(i) : null;
  }).filter((f) => f != null), [work, p.fracOf]);

  // Spulen per Tippen/Ziehen auf der Zeitleiste
  const zeitRef = useRef(null);
  const [zieh, setZieh] = useState(null);
  const fracAus = (e) => {
    const r = zeitRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  const onZeitDown = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setZieh(fracAus(e)); };
  const onZeitMove = (e) => { if (zieh != null) setZieh(fracAus(e)); };
  const onZeitUp = (e) => {
    if (zieh == null) return;
    const i = p.idxOfFrac(fracAus(e));
    setZieh(null);
    if (i >= 0) p.load(i, p.playing);
  };

  const jump = useCallback((tagId) => {
    const i = work.nodes.findIndex((n) => n.tag_id === tagId);
    if (i >= 0) p.load(i, true);
  }, [work.nodes, p]);

  // Sperrbildschirm / Kopfhörer-Tasten
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms) return;
    try {
      ms.metadata = new MediaMetadata({
        title: kapitel, artist: work.meta.autor, album: work.meta.titel,
        artwork: coverSrc ? [{ src: coverSrc, sizes: "600x900" }] : [],
      });
      ms.setActionHandler("play", p.play);
      ms.setActionHandler("pause", p.pause);
      ms.setActionHandler("nexttrack", p.nextSentence);
      ms.setActionHandler("previoustrack", p.prevSentence);
      ms.setActionHandler("seekforward", p.nextWord);
      ms.setActionHandler("seekbackward", p.prevWord);
    } catch {}
  }, [kapitel, coverSrc, work.meta, p.play, p.pause, p.nextSentence, p.prevSentence, p.nextWord, p.prevWord]);

  // Tastatur (Desktop): Leertaste = Upps, Enter/K = Play/Pause, ←/→ Wort, Shift+←/→ Satz
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input,textarea")) return;
      if (versteckt) { if (e.key === "Enter" || e.key === "k" || e.key === "K") { e.preventDefault(); p.toggle(); } return; }
      if (e.code === "Space") { e.preventDefault(); p.triggerUpps(); }
      else if (e.key === "Enter" || e.key === "k" || e.key === "K") { e.preventDefault(); p.toggle(); }
      else if (e.key === "ArrowRight") (e.shiftKey ? p.nextSentence : p.nextWord)();
      else if (e.key === "ArrowLeft") (e.shiftKey ? p.prevSentence : p.prevWord)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p, versteckt]);

  // AP 56: Hörzustand an den Reader (nur solange der Reader sichtbar ist; Upps-Clip zählt nicht)
  useEffect(() => {
    if (!versteckt || !p.node || p.uppsLang) { setHoerzustand(null); return; }
    setHoerzustand({ tag: p.node.tag_id, lang, time: p.time, duration: p.duration, hs: !!p.hsAktiv,
                     wt: p.hsAktiv ? work.wordtimesHs : work.wordtimes, quelle: work.meta.originalsprache || "en" });
  }, [versteckt, p.node, p.time, p.duration, p.hsAktiv, p.uppsLang, lang, work]);
  useEffect(() => () => setHoerzustand(null), []);

  // Karaoke (AP 54c, 26.10.2026): gesprochenes Wort + Gegenwort in der anderen Sprache.
  // Gehörte Sprache: Token-Wortzeiten (Stage 520) als Grundlage, innerhalb des Tokens die Ankerzeit
  // (Teil-Token/Kompositum). Andere Sprache: Anker mit t/tz/zspans (s525 → s710); ohne Anker kein Gegenwort.
  // Hörspiel-Clip (AP 55): Ankerzeiten ths/tzhs aus der Hörspiel-Wortbrücke. Fallback ohne Ankerzeiten: Token-Karaoke + Spans.
  const zeilen = useMemo(() => {
    if (!p.node) return [];
    const heard = p.uppsLang || lang, gegen = heard === "en" ? "de" : "en";
    const zeig = p.uppsLang ? [heard] : subs === 1 ? [heard] : subs === 2 ? [gegen] : subs === 3 ? [heard, gegen] : [];
    if (!zeig.length) return [];
    const hText = p.node[heard]?.text || "", oText = p.node[gegen]?.text || "";
    const { times } = tokenTimes(p.node, heard, p.duration, wtAktiv);
    const tok = tokenZustand(hText, times, p.time);
    const quelle = work.meta.originalsprache || "en";
    const hs = !!p.hsAktiv;   // AP 55: laufender Clip ist Hörspiel → ths/tzhs
    const wp = hatAnkerzeiten(p.node, hs)
      ? wortpaarZustand(p.node, heard, p.time, quelle, hText.length, oText.length, hs) : null;
    const hState = tok.st;
    if (wp?.aktiv && tok.curSpan) {
      const [a, b] = tok.curSpan;
      let first = -1, last = -1;
      for (let c = a; c < b; c++) if (wp.heard[c] === 2) { if (first < 0) first = c; last = c; }
      if (first >= 0) for (let c = a; c < b; c++) hState[c] = c < first ? 1 : c > last ? 0 : 2;
    }
    let oState = wp ? wp.other : null;
    if (!wp && p.node.align?.length && tok.curSpan) {           // bisheriger Weg: Span-Überlappung
      const hKey = `${heard}_span`, sKey = `${gegen}_span`;
      oState = new Uint8Array(oText.length);
      const [cs, ce] = tok.curSpan;
      for (const al of p.node.align) {
        const h = al[hKey], t = al[sKey];
        if (!Array.isArray(h) || !Array.isArray(t) || t[1] > oText.length) continue;
        const v = h[0] < ce && h[1] > cs ? 2 : h[1] <= cs ? 1 : 0;
        if (v) for (let c = t[0]; c < t[1]; c++) oState[c] = Math.max(oState[c], v);
      }
    }
    return zeig.map((l) => l === heard
      ? { lang: l, rolle: "heard", runs: laeufe(hText, hState) }
      : { lang: l, rolle: "other", runs: laeufe(oText, oState), ohne: !oState });
  }, [subs, p.node, p.time, p.duration, p.hsAktiv, lang, p.uppsLang, wtAktiv, work.meta.originalsprache]);
  const uppsLabel = p.upps === "armed"
    ? (nativeLang === "de" ? `Upps – gleich auf ${other === "de" ? "Deutsch" : "Englisch"}` : `Upps – next in ${other === "de" ? "German" : "English"}`)
    : p.uppsLang ? `Upps · ${p.uppsLang.toUpperCase()}` : null;

  // EN·DE (AP 54c): Größe aus der Gesamtlänge beider Zeilen (zweite Zeile 0,8×), damit nichts in die Zeitleiste ragt
  const subLen = zeilen.length > 1
    ? zeilen.reduce((n, z, zi) => n + z.runs.reduce((m, r) => m + r.text.length, 0) * (zi ? 0.64 : 1), 0)
    : subText.length;
  const subSize = subLen < 90 ? 36 : subLen < 170 ? 30 : subLen < 280 ? 25 : subLen < 400 ? 21 : 18;
  const kapitelAnzeige = (lang === "de" ? kapitelNode?.titel_de : kapitelNode?.titel) || kapitel;
  const pct = Math.min(100, (zieh != null ? zieh : p.progress) * 100);
  const W = 1000; // Zeitleisten-Raster (viewBox), Strich skaliert nicht mit


  if (versteckt) {
    return <HoerMini p={p} de={nativeLang === "de"} onZumHoeren={onZumHoeren} onSchliessen={onSchliessen} />;
  }

  return (
    <div className="listen" onClick={(e) => e.stopPropagation()}>
      <header className="listen-head">
        {onBack && <button className="icon-btn" onClick={onBack} aria-label={nativeLang === "de" ? "Zur Bibliothek" : "To library"}><IconZurueck /></button>}
        {coverSrc && <img className="listen-thumb" src={coverSrc} alt="" />}
        <div className="listen-meta">
          <div className="listen-titel">{work.meta.titel}</div>
          <div className="listen-kapitel">{kapitelAnzeige}</div>
        </div>
        <button className="tempo-btn" onClick={() => p.setTempo(TEMPI[(TEMPI.indexOf(p.tempo) + 1) % TEMPI.length] || 1)}
                aria-label={nativeLang === "de" ? "Hörtempo" : "Playback speed"}>
          {(nativeLang === "de" ? p.tempo.toLocaleString("de-DE") : String(p.tempo)) + "×"}
        </button>
        <button className="icon-btn listen-reader-btn" onClick={onToReader} aria-label="Zum Reader"><IconBook size={26} /></button>
      </header>

      <main className="listen-stage" onClick={p.triggerUpps}
            aria-label={nativeLang === "de" ? "Tippen für Upps: Satz in der anderen Sprache" : "Tap for Upps: sentence in the other language"}>
        {uppsLabel && <div className="upps-chip" role="status"><DotWord text={uppsLabel} /></div>}
        {subText && figur && (
          <div className="listen-sprecher"><SprecherLabel name={figur} /></div>
        )}
        {subText ? (
          <div className={"listen-subs" + (zeilen.length > 1 ? " listen-subs--zwei" : "")}>
            {zeilen.map((z, zi) => (
              <p key={p.node.tag_id + z.lang}
                 className={"listen-sub" + (z.rolle === "other" ? " listen-sub--gegen" : "") + (z.ohne ? " listen-sub--other" : "")
                            + (p.uppsLang ? " listen-sub--upps" : "") + (figur && zi === 0 ? " listen-sub--figur" : "")}
                 lang={z.lang} style={{ ...(figur && zi === 0 ? sprecherStil(figur) : {}), fontSize: zi === 0 ? subSize : Math.round(subSize * 0.8), lineHeight: 1.16 }}>
                {z.runs.map((r, i) => r.cls ? <span key={i} className={r.cls}>{r.text}</span> : r.text)}
              </p>
            ))}
          </div>
        ) : (
          bildNode ? <img key={bildNode.tag_id} className="listen-bild" src={bildNode.bild} alt={bildNode.alt} />
          : coverSrc && <img className="listen-cover-big" src={coverSrc} alt={work.meta.titel} />
        )}
      </main>

      <div className={"listen-time" + (zieh != null ? " listen-time--zieh" : "")} role="slider" aria-label="Gesamtfortschritt"
           aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} ref={zeitRef}
           onPointerDown={onZeitDown} onPointerMove={onZeitMove} onPointerUp={onZeitUp}
           onPointerCancel={() => setZieh(null)}>
        <svg viewBox={`0 0 ${W} 28`} preserveAspectRatio="none" aria-hidden="true">
          <defs><clipPath id="lt-played"><rect x="0" y="0" width={pct * W / 100} height="28" /></clipPath></defs>
          <path className="listen-time-rest" d={`M0 14 H${W}`} strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" />
          <rect x="0" y="10" width={pct * W / 100} height="8" fill="var(--paper)" />
          <g clipPath="url(#lt-played)">
            <path className={"listen-time-wave" + (p.playing ? " wave-run" : "")} fill="none"
                  strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  d={`M0 14 ${Array.from({ length: Math.ceil(W / 32) + 2 }, (_, k) => `Q${k * 32 + 8} ${p.playing ? 3 : 13} ${k * 32 + 16} 14 T${k * 32 + 32} 14`).join(" ")}`} />
          </g>
          {marken.map((f, i) => (
            <path key={i} className="listen-time-mark" d={`M${f * W} 7 V21`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <span className={"listen-time-dot" + (p.playing ? " listen-time-dot--run" : "")} style={{ left: `${pct}%` }} />
      </div>

      <div className="listen-dock">
        {hatHs && (
          <div className="hoermodus" role="radiogroup" aria-label={nativeLang === "de" ? "Hörfassung" : "Audio version"}>
            {[["erzaehler", nativeLang === "de" ? "Erzähler" : "Narrator"], ["hoerspiel", nativeLang === "de" ? "Hörspiel" : "Full cast"]].map(([m, t]) => (
              <button key={m} role="radio" aria-checked={hoerModus === m}
                      className={"hoermodus-btn" + (hoerModus === m ? " is-on" : "")} onClick={() => wechsleModus(m)}>{t}</button>
            ))}
          </div>
        )}
        <div className="dock-row">
          <button className="icon-btn" onClick={p.prevSentence} aria-label="Satz zurück"><IconSatzZurueck size={34} /></button>
          <button className="icon-btn" onClick={p.prevWord} aria-label="Wort zurück"><IconWortZurueck size={34} /></button>
          <button className="play-btn" onClick={p.toggle} aria-label={p.playing ? "Pause" : "Abspielen"}>
            {p.playing ? <IconPause size={40} /> : <IconPlay size={40} />}
          </button>
          <button className="icon-btn" onClick={p.nextWord} aria-label="Wort vor"><IconWortVor size={34} /></button>
          <button className="icon-btn" onClick={p.nextSentence} aria-label="Satz vor"><IconSatzVor size={34} /></button>
        </div>
        <div className="dock-row2">
          <button className="icon-btn" onClick={() => setShowChapters(true)} aria-label={lang === "de" ? "Kapitel" : "Chapters"}><IconMenu size={30} /></button>
          <button className="icon-btn lang-btn" onClick={onLangSwitch} aria-label="Sprache wechseln"><DotWord text={other.toUpperCase()} /></button>
          <button className={"icon-btn lang-btn" + (subs ? " is-on" : "")} onClick={() => setSubs((s) => (s + 1) % 4)}
                  aria-label={subs === 0 ? "Untertitel an" : subs === 1 ? "Untertitel in der anderen Sprache" : subs === 2 ? "Untertitel in beiden Sprachen" : "Untertitel aus"} aria-pressed={subs > 0}>
            <DotWord text={subs === 2 ? other.toUpperCase() : subs === 3 ? "EN·DE" : "CC"} dotColor={subs ? undefined : "var(--dock-ink-2)"} />
          </button>
          {settings.kurator() && p.node && (
            <button className="icon-btn lang-btn kur-btn" onClick={() => { p.pause(); setKurNode(p.node); }}
                    aria-label={nativeLang === "de" ? "Anmerkung zu diesem Satz" : "Note on this sentence"}>✎</button>
          )}
        </div>
      </div>

      {kurNode && (
        <KuratorSheet work={work} node={kurNode} lang={lang} uiDe={nativeLang === "de"} modus="hoeren"
                      zeit={p.time} onClose={() => setKurNode(null)} />
      )}

      {gesperrt && (
        <div className="paywall" onClick={(e) => e.stopPropagation()}>
          <DotWord text="TÆLLA" className="wordmark" style={{ fontSize: 26 }} />
          <p className="paywall-titel">{nativeLang === "de" ? "Kapitel 1 war frei." : "Chapter 1 was free."}</p>
          <p className="paywall-text">{nativeLang === "de"
            ? "Weiterhören und -lesen mit deinem TÆLLA-Konto. Konto und Zugang richtest du auf taella.io ein."
            : "Keep listening and reading with your TÆLLA account. Set it up on taella.io."}</p>
          <div className="paywall-actions">
            <button className="btn btn--ink" onClick={() => p.load(Math.max(0, work.nodes.findIndex((n) => n.tag_id === work.kapitel[0].tag_id)), false)}>
              {nativeLang === "de" ? "Zurück zu Kapitel 1" : "Back to chapter 1"}</button>
            {onBack && <button className="btn" onClick={onBack}>{nativeLang === "de" ? "Bibliothek" : "Library"}</button>}
          </div>
        </div>
      )}

      {showChapters && (
        <ChapterSheet
          kapitel={work.kapitel}
          currentKapitel={kapitelNode?.tag_id}
          onJump={jump}
          lang={lang}
          onClose={() => setShowChapters(false)}
        />
      )}
    </div>
  );
}


// AP 57b (26.10.2026): Lesen beim Hören – Miniatur (weißer Knopf, roter Punkt) auf der Position des Hören-Icons,
// auf Höhe der Fußzeile (überdeckt keinen Text); Tipp klappt die Steuerung auf (Pause/Play · Hören · beenden).
function HoerMini({ p, de, onZumHoeren, onSchliessen }) {
  const [offen, setOffen] = useState(false);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const app = document.querySelector(".app");
    const nav = document.querySelector("nav.chrome-bottom");
    if (!app) return;
    const messen = () => {
      const a = app.getBoundingClientRect();
      const h = nav?.querySelector('button[aria-label="Hören"]')?.getBoundingClientRect();
      const navAuf = nav && !nav.classList.contains("chrome--hidden");
      const foot = document.querySelector(".read-foot")?.getBoundingClientRect();
      const x = h ? h.left + h.width / 2 - a.left : a.width / 2;
      const y = navAuf && h ? h.top + h.height / 2 - a.top : foot ? foot.top + foot.height / 2 - a.top : a.height - 24;
      setPos({ x, y });
    };
    messen();
    const ro = new ResizeObserver(messen); ro.observe(app);
    const mo = nav ? new MutationObserver(() => setTimeout(messen, 340)) : null;   // nach der Chrome-Animation
    mo?.observe(nav, { attributes: true, attributeFilter: ["class"] });
    return () => { ro.disconnect(); mo?.disconnect(); };
  }, []);
  useEffect(() => {
    if (!offen) return;
    const zu = () => setOffen(false);
    const t = setTimeout(() => document.addEventListener("click", zu), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", zu); };
  }, [offen]);
  if (!pos) return null;
  return (
    <div className="hoer-mini-wrap" style={{ left: pos.x, top: pos.y }} onClick={(e) => e.stopPropagation()}>
      {offen && (
        <div className="hoer-pille">
          <button className="icon-btn" aria-label={p.playing ? "Pause" : "Play"} onClick={p.toggle}>
            {p.playing ? <IconPause size={22} /> : <IconPlay size={22} />}
          </button>
          <button className="icon-btn" aria-label={de ? "Zur Hören-Ansicht" : "To listening view"} onClick={onZumHoeren}><IconHoeren size={22} /></button>
          <button className="icon-btn hoer-pille-x" aria-label={de ? "Hören beenden" : "Stop listening"} onClick={onSchliessen}>×</button>
        </div>
      )}
      <button className={"hoer-mini" + (p.playing ? " hoer-mini--laeuft" : "")} aria-expanded={offen}
              aria-label={de ? "Wiedergabe-Steuerung" : "Playback controls"} onClick={() => setOffen((o) => !o)}>
        <span className="hoer-mini-dot" />
      </button>
    </div>
  );
}
