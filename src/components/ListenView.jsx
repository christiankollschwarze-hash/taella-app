import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { settings } from "../lib/settings.js";
import { useListen, tokenTimes } from "../lib/useListen.js";
import DotWord from "../design/DotWord.jsx";
import { IconPlay, IconPause, IconWortVor, IconWortZurueck, IconSatzVor, IconSatzZurueck, IconMenu, IconBook, IconZurueck } from "../design/Icons.jsx";
import ChapterSheet from "./ChapterSheet.jsx";
import SprecherLabel, { sprecherStil } from "./SprecherLabel.jsx";
import KuratorSheet from "./KuratorSheet.jsx";

// Audio-Ansicht (Design D): Untertitel als Typografie-Bühne mit Karaoke-Punkt,
// ohne Untertitel das Cover groß; Wellen-Zeitleiste mit rotem Punkt (nur Anzeige);
// schwarzes Dock mit Satz/Wort-Spulen, Kapitel, Sprache, Untertitel.

const SUB_KEY = "taella_subs"; // 0 aus · 1 gehörte Sprache · 2 andere Sprache



const TEMPI = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

export default function ListenView({ work, lang, nativeLang, onLangSwitch, startTag, autoplay, onSentenceStart, onToReader, onBack = null }) {
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
  // Während eines Upps zeigt die Bühne immer den Upps-Satz (andere Sprache, mit Karaoke)
  const subLang = p.uppsLang || (subs === 1 ? lang : subs === 2 ? other : null);
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
      if (e.code === "Space") { e.preventDefault(); p.triggerUpps(); }
      else if (e.key === "Enter" || e.key === "k" || e.key === "K") { e.preventDefault(); p.toggle(); }
      else if (e.key === "ArrowRight") (e.shiftKey ? p.nextSentence : p.nextWord)();
      else if (e.key === "ArrowLeft") (e.shiftKey ? p.prevSentence : p.prevWord)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]);

  // Karaoke: gesprochene Wörter schwarz, aktuelles mit rotem Punkt darunter, Rest grau.
  // Gleiche Sprache: direkt über die Wortzeiten. Andere Sprache (CC in der Übersetzung):
  // gehörtes Wort → Wortanker aus Stage 54a (en_span ↔ de_span) → Wort im Untertitel.
  const karaoke = useMemo(() => {
    if (!p.node) return null;
    const sameLang = p.uppsLang || (subs === 1 ? lang : null);
    if (sameLang) {
      const { toks, times } = tokenTimes(p.node, sameLang, p.duration, wtAktiv);
      let cur = -1;
      for (let i = 0; i < times.length; i++) if (times[i] <= p.time + 0.02) cur = i;
      return toks.map((w, i) => ({ w, cls: i < cur ? "w-done" : i === cur ? "w-now" : "" }));
    }
    if (subs !== 2 || !p.node.align?.length) return null;
    // gehörte Sprache = lang, Untertitel = other
    const heardText = p.node[lang]?.text || "", subTxt = p.node[other]?.text || "";
    const { times } = tokenTimes(p.node, lang, p.duration, wtAktiv);
    const heardSpans = [...heardText.matchAll(/\S+/g)].map((m) => [m.index, m.index + m[0].length]);
    let hc = -1;
    for (let i = 0; i < times.length; i++) if (times[i] <= p.time + 0.02) hc = i;
    if (hc < 0) return null;
    const curStart = heardSpans[hc][0], curEnd = heardSpans[hc][1];
    const hKey = lang === "en" ? "en_span" : "de_span", sKey = lang === "en" ? "de_span" : "en_span";
    const state = new Uint8Array(subTxt.length);          // 0 grau · 1 gesprochen · 2 jetzt
    for (const a of p.node.align) {
      const h = a[hKey], t = a[sKey];
      if (!Array.isArray(h) || !Array.isArray(t) || t[1] > subTxt.length) continue;
      const v = h[0] < curEnd && h[1] > curStart ? 2 : h[1] <= curStart ? 1 : 0;
      if (v) for (let c = t[0]; c < t[1]; c++) state[c] = Math.max(state[c], v);
    }
    return [...subTxt.matchAll(/\S+/g)].map((m) => {
      let v = 0;
      for (let c = m.index; c < m.index + m[0].length; c++) v = Math.max(v, state[c]);
      return { w: m[0], cls: v === 2 ? "w-now" : v === 1 ? "w-done" : "" };
    });
  }, [subs, p.node, p.time, p.duration, lang, other, p.uppsLang, wtAktiv]);
  const uppsLabel = p.upps === "armed"
    ? (nativeLang === "de" ? `Upps – gleich auf ${other === "de" ? "Deutsch" : "Englisch"}` : `Upps – next in ${other === "de" ? "German" : "English"}`)
    : p.uppsLang ? `Upps · ${p.uppsLang.toUpperCase()}` : null;

  const subSize = subText.length < 90 ? 36 : subText.length < 170 ? 30 : subText.length < 280 ? 25 : 21;
  const kapitelAnzeige = (lang === "de" ? kapitelNode?.titel_de : kapitelNode?.titel) || kapitel;
  const pct = Math.min(100, (zieh != null ? zieh : p.progress) * 100);
  const W = 1000; // Zeitleisten-Raster (viewBox), Strich skaliert nicht mit

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
          <p className={"listen-sub" + (subs === 2 && !p.uppsLang && !karaoke ? " listen-sub--other" : "") + (p.uppsLang ? " listen-sub--upps" : "")
                         + (figur ? " listen-sub--figur" : "")}
             key={p.node.tag_id + subLang} lang={subLang} style={{ ...(figur ? sprecherStil(figur) : {}),  fontSize: subSize, lineHeight: 1.16 }}>
            {karaoke
              ? karaoke.map((t, i) => <span key={i}><span className={t.cls}>{t.w}</span>{" "}</span>)
              : subText}
          </p>
        ) : (
          coverSrc && <img className="listen-cover-big" src={coverSrc} alt={work.meta.titel} />
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
          <button className={"icon-btn lang-btn" + (subs ? " is-on" : "")} onClick={() => setSubs((s) => (s + 1) % 3)}
                  aria-label={subs === 0 ? "Untertitel an" : subs === 1 ? "Untertitel in der anderen Sprache" : "Untertitel aus"} aria-pressed={subs > 0}>
            <DotWord text={subs === 2 ? other.toUpperCase() : "CC"} dotColor={subs ? undefined : "var(--dock-ink-2)"} />
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
