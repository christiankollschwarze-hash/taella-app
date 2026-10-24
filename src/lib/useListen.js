// Satz-für-Satz-Player für die Audio-Ansicht.
//  - ein einziges <audio>-Element (mobil: Autoplay nach erster Geste bleibt erlaubt)
//  - Satz vor/zurück, Wort vor/zurück (echte Wortzeiten aus Stage 58c, sonst Schätzung)
//  - onSentenceStart(tagId): Lesezeichen satzgenau mitführen
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { settings as _st } from "./settings.js";
import { merke } from "./lernspur.js";

const DEFAULT_PAUSE_MS = 250;   // Pause zwischen Sätzen, wenn das Manifest keine vorgibt
const RESTART_AFTER_S = 1.5;    // „Satz zurück“ nach so vielen Sekunden: aktuellen Satz neu

// Wortanfänge (Sekunden) eines Satzes: Stage-58c-Zeiten oder Schätzung über Textlänge
export function wordStarts(node, lang, duration, wordtimes) {
  const real = wordtimes?.[lang]?.[node.tag_id];
  if (Array.isArray(real) && real.some((t) => t != null)) {
    return real.filter((t) => t != null);
  }
  const text = node[lang]?.text || "";
  if (!text || !duration) return [0];
  const starts = [];
  for (const m of text.matchAll(/\S+/g)) starts.push((m.index / text.length) * duration);
  return starts.length ? starts : [0];
}

// Startzeit je \S+-Token (für die Karaoke-Markierung): echte Zeiten, Lücken interpoliert,
// sonst Schätzung über die Textposition.
export function tokenTimes(node, lang, duration, wordtimes) {
  const text = node?.[lang]?.text || "";
  const toks = [...text.matchAll(/\S+/g)];
  if (!toks.length) return { toks: [], times: [] };
  const real = wordtimes?.[lang]?.[node.tag_id];
  let times;
  if (Array.isArray(real) && real.some((t) => t != null)) {
    times = toks.map((_, i) => (real[i] != null ? real[i] : null));
    let last = 0;
    for (let i = 0; i < times.length; i++) { if (times[i] == null) times[i] = last; else last = times[i]; }
  } else {
    times = toks.map((m) => (duration ? (m.index / text.length) * duration : 0));
  }
  return { toks: toks.map((m) => m[0]), times };
}

export function useListen({ nodes, lang, wordtimes, onSentenceStart }) {
  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== "undefined") {
    const a = new Audio();
    a.preservesPitch = true;                       // Tempo ohne Mickymaus-Effekt
    a.defaultPlaybackRate = a.playbackRate = _st.tempo();
    audioRef.current = a;
  }
  // Tempo-Regler (17.10.2026): defaultPlaybackRate ueberlebt den Wechsel der Satzdatei
  const [tempo, setTempoState] = useState(() => _st.tempo());
  const setTempo = useCallback((t) => {
    const a = audioRef.current;
    if (a) { a.defaultPlaybackRate = t; a.playbackRate = t; }
    _st.setTempo(t); setTempoState(t);
  }, []);

  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const idxRef = useRef(-1);
  const playingRef = useRef(false);
  const pauseTimer = useRef(null);
  const langRef = useRef(lang);
  // Upps: nach dem aktuellen Satz denselben Satz in der anderen Sprache, dann weiter
  const uppsArmed = useRef(false);
  const uppsActive = useRef(null);           // Sprache, in der gerade der Upps-Satz läuft
  const playUppsRef = useRef(null);
  const [upps, setUpps] = useState(null);    // null | "armed" | "de" | "en"
  const curLang = () => uppsActive.current || langRef.current;
  const cbRef = useRef(onSentenceStart);
  useEffect(() => { cbRef.current = onSentenceStart; }, [onSentenceStart]);

  const hasAudio = useCallback((i, l = langRef.current) => !!nodes[i]?.[l]?.audio, [nodes]);

  // nächster/vorheriger Satz mit Audio in der aktuellen Sprache
  const findFrom = useCallback((i, dir) => {
    for (let k = i; k >= 0 && k < nodes.length; k += dir) if (hasAudio(k)) return k;
    return -1;
  }, [nodes, hasAudio]);

  // AbortError = Wiedergabe durch neuen Satz/Pause ersetzt → kein Fehler
  const onPlayError = (e) => {
    if (e?.name === "AbortError") return;
    playingRef.current = false;
    setPlaying(false);
  };

  const clearPause = () => { clearTimeout(pauseTimer.current); pauseTimer.current = null; };

  // Satz laden; seek: Sekunden oder "lastWord"
  const load = useCallback((i, autoplay, seek = 0) => {
    const a = audioRef.current;
    if (!a) return;
    clearPause();
    uppsArmed.current = false; uppsActive.current = null; setUpps(null);
    const k = findFrom(Math.max(0, i), 1);
    if (k < 0) { a.pause(); setPlaying(false); playingRef.current = false; return; }
    idxRef.current = k;
    setIdx(k);
    setTime(0);
    cbRef.current?.(nodes[k].tag_id);
    a.src = nodes[k][langRef.current].audio;
    a.onloadedmetadata = () => {
      setDuration(a.duration || 0);
      let t = seek;
      if (seek === "lastWord") {
        const ws = wordStarts(nodes[k], langRef.current, a.duration, wordtimes);
        t = ws[ws.length - 1] || 0;
      }
      if (t > 0) a.currentTime = t;
    };
    if (autoplay) {
      playingRef.current = true;
      setPlaying(true);
      a.play().catch(onPlayError);
    }
  }, [nodes, findFrom, wordtimes]);

  // Audio-Events einmalig verdrahten
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onEnded = () => {
      if (!playingRef.current) return;
      const cur = idxRef.current;
      if (uppsArmed.current && !uppsActive.current) { playUppsRef.current?.(cur); return; }
      if (uppsActive.current) { uppsActive.current = null; setUpps(null); }
      const p = parseInt(nodes[cur]?.pause, 10);
      const ms = Number.isFinite(p) && p > 0 ? p : DEFAULT_PAUSE_MS;
      pauseTimer.current = setTimeout(() => load(cur + 1, true), ms);
    };
    const onError = () => { if (playingRef.current) load(idxRef.current + 1, true); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [nodes, load]);

  // Upps-Satz abspielen: gleicher Satz, andere Sprache (Lesezeichen bleibt stehen)
  const playUpps = useCallback((i) => {
    const a = audioRef.current;
    const other = langRef.current === "en" ? "de" : "en";
    uppsArmed.current = false;
    const n = nodes[i];
    if (n) merke({ art: "upps_hoeren", tag_id: n.tag_id, von: langRef.current, nach: other,
                   quelle: n[langRef.current]?.text, ziel: n[other]?.text });
    const url = nodes[i]?.[other]?.audio;
    if (!a || !url) { setUpps(null); load(i + 1, true); return; }
    clearPause();
    uppsActive.current = other;
    setUpps(other);
    setTime(0);
    a.src = url;
    a.onloadedmetadata = () => setDuration(a.duration || 0);
    playingRef.current = true;
    setPlaying(true);
    a.play().catch(onPlayError);
  }, [nodes, load]);
  playUppsRef.current = playUpps;

  // Upps auslösen: während des Satzes → nach dessen Ende; in der Pause danach → sofort für diesen Satz.
  // Ein zweiter Tipp vor Satzende nimmt das Upps zurück.
  const triggerUpps = useCallback(() => {
    if (!playingRef.current || uppsActive.current) return;
    if (pauseTimer.current) { playUpps(idxRef.current); return; }
    uppsArmed.current = !uppsArmed.current;
    setUpps(uppsArmed.current ? "armed" : null);
  }, [playUpps]);

  // Aufräumen beim Verlassen der Ansicht
  useEffect(() => () => { clearPause(); audioRef.current?.pause(); }, []);

  // Sprachwechsel: aktuellen Satz in der anderen Sprache von vorn
  useEffect(() => {
    if (langRef.current === lang) return;
    langRef.current = lang;
    if (idxRef.current >= 0) load(idxRef.current, playingRef.current);
  }, [lang, load]);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (idxRef.current < 0 || !a.src) { load(Math.max(0, idxRef.current), true); return; }
    if (pauseTimer.current) return;
    playingRef.current = true;
    setPlaying(true);
    if (a.ended) { load(idxRef.current + 1, true); return; }
    a.play().catch(onPlayError);
  }, [load]);

  const pause = useCallback(() => {
    clearPause();
    playingRef.current = false;
    setPlaying(false);
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [play, pause]);

  const nextSentence = useCallback(() => {
    const k = findFrom(idxRef.current + 1, 1);
    if (k >= 0) load(k, playingRef.current);
  }, [findFrom, load]);

  const prevSentence = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > RESTART_AFTER_S) { a.currentTime = 0; return; }
    const k = findFrom(idxRef.current - 1, -1);
    if (k >= 0) load(k, playingRef.current);
  }, [findFrom, load]);

  const nextWord = useCallback(() => {
    const a = audioRef.current;
    const node = nodes[idxRef.current];
    if (!a || !node) return;
    const ws = wordStarts(node, curLang(), a.duration, wordtimes);
    const t = ws.find((s) => s > a.currentTime + 0.05);
    if (t != null) a.currentTime = t; else nextSentence();
  }, [nodes, wordtimes, nextSentence]);

  const prevWord = useCallback(() => {
    const a = audioRef.current;
    const node = nodes[idxRef.current];
    if (!a || !node) return;
    const ws = wordStarts(node, curLang(), a.duration, wordtimes);
    let k = -1;
    for (let j = 0; j < ws.length; j++) if (ws[j] <= a.currentTime + 0.05) k = j;
    if (k > 0) { a.currentTime = ws[k - 1]; return; }
    const prev = findFrom(idxRef.current - 1, -1);
    if (prev >= 0) load(prev, playingRef.current, "lastWord"); else a.currentTime = 0;
  }, [nodes, wordtimes, findFrom, load]);

  // Gesamtfortschritt: Textlänge als Gewicht (Dauer aller Sätze ist vorab unbekannt)
  const weights = useMemo(() => {
    const cum = new Array(nodes.length + 1).fill(0);
    for (let i = 0; i < nodes.length; i++) cum[i + 1] = cum[i] + (nodes[i][lang]?.text?.length || 0);
    return cum;
  }, [nodes, lang]);

  const progress = useMemo(() => {
    const total = weights[nodes.length] || 1;
    if (idx < 0) return 0;
    const len = weights[idx + 1] - weights[idx];
    const frac = duration ? Math.min(1, time / duration) : 0;
    return (weights[idx] + frac * len) / total;
  }, [weights, nodes.length, idx, time, duration]);

  // Zeitleiste: Satzindex -> Anteil (Kapitelmarken) und Anteil -> Satzindex (Spulen)
  const fracOf = useCallback((i) => (weights[Math.max(0, i)] || 0) / (weights[nodes.length] || 1), [weights, nodes.length]);
  const idxOfFrac = useCallback((f) => {
    const ziel = Math.max(0, Math.min(1, f)) * (weights[nodes.length] || 0);
    let lo = 0, hi = nodes.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (weights[m] <= ziel) lo = m; else hi = m - 1; }
    const v = findFrom(lo, 1);
    return v >= 0 ? v : findFrom(lo, -1);
  }, [weights, nodes.length, findFrom]);

  return {
    idx, node: nodes[idx] || null, playing, time, duration, progress, fracOf, idxOfFrac,
    upps, uppsLang: upps === "de" || upps === "en" ? upps : null, triggerUpps,
    load, play, pause, toggle, nextSentence, prevSentence, nextWord, prevWord, tempo, setTempo,
  };
}
