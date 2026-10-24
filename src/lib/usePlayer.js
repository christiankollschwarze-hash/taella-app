// Satz-für-Satz Audio-Player. Unterstützt:
//   - EN / DE Sprache
//   - onSentenceDone(tagId): Callback nach jedem gespielten Satz (für Bookmark)
//   - triggerUpps(): nach aktuellem Satz => anderen Sprache abspielen, dann weiter
import { useRef, useState, useCallback, useEffect } from "react";

function audioUrl(node, lang) {
  const url = node[lang]?.audio;
  return url || null;
}

export function usePlayer(nodes, lang, onSentenceDone, onUppsDone) {
  const [playingId, setPlayingId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [subtitle, setSubtitle] = useState({ en: null, de: null });

  const audioRef = useRef(null);
  const playIndex = useRef(-1);
  const stopReq = useRef(false);
  const uppsFlag = useRef(false);  // gesetzt von triggerUpps()
  const onUppsDoneRef = useRef(onUppsDone);
  useEffect(() => { onUppsDoneRef.current = onUppsDone; }, [onUppsDone]);
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const stop = useCallback(() => {
    stopReq.current = true;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingId(null);
    setIsPlaying(false);
    setSubtitle({ en: null, de: null });
    playIndex.current = -1;
  }, []);

  const playFrom = useCallback((startIdx, overrideLang, extraOnDone) => {
    if (!nodesRef.current) return;
    stopReq.current = false;
    setIsPlaying(true);

    const step = (idx) => {
      if (stopReq.current) return;
      const ns = nodesRef.current;
      if (!ns || idx >= ns.length) { stop(); return; }
      const node = ns[idx];
      playIndex.current = idx;
      const useLang = overrideLang || langRef.current;
      const url = audioUrl(node, useLang);
      if (!url) { step(idx + 1); return; }

      setPlayingId(node.tag_id);
      setSubtitle({
        en: node.en?.text ?? null,
        de: node.de?.text ?? null,
      });

      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => {
        if (stopReq.current) return;
        if (onSentenceDone) onSentenceDone(node.tag_id);
        if (extraOnDone) { extraOnDone(idx); return; }

        // Ups-Modus: anderen Sprache abspielen, danach weiter
        if (uppsFlag.current) {
          uppsFlag.current = false;
          const otherLang = langRef.current === "en" ? "de" : "en";
          // rekursiv: einzelnen Satz in anderer Sprache, dann weiter
          playFrom(idx, otherLang, (_doneIdx) => {
            if (onUppsDoneRef.current) onUppsDoneRef.current();
            step(idx + 1);
          });
          return;
        }
        setTimeout(() => step(idx + 1), 300);
      };
      a.onerror = () => { if (!stopReq.current) step(idx + 1); };
      a.play().catch(() => { if (!stopReq.current) step(idx + 1); });
    };
    step(startIdx);
  }, [stop, onSentenceDone]);

  const togglePlay = useCallback(() => {
    if (isPlaying) { stop(); return; }
    const startIdx = Math.max(0, playIndex.current);
    playFrom(startIdx);
  }, [isPlaying, stop, playFrom]);

  const triggerUpps = useCallback(() => {
    if (!isPlaying) return;
    uppsFlag.current = true;
  }, [isPlaying]);

  return { playingId, isPlaying, subtitle, togglePlay, stop, playFrom, playIndex, triggerUpps };
}
