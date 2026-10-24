// Player-Leiste: Play/Stop, Sprache, Modus (Lesen/Hören/Hybrid), Untertitel-Toggle
export default function Player({ isPlaying, lang, mode, setMode, subtitleLang, setSubtitleLang,
                                  togglePlay, stop, canStop, onSwitchLang }) {
  return (
    <div className="player">
      <button className="play-btn" onClick={togglePlay}>
        {isPlaying ? "⏸" : "▶"}
      </button>
      <button className="stop-btn" disabled={!canStop} onClick={stop}>■</button>

      {/* Sprache */}
      <div className="lang-switch">
        <button className={"lang" + (lang === "en" ? " lang--on" : "")} onClick={() => onSwitchLang("en")}>EN</button>
        <button className={"lang" + (lang === "de" ? " lang--on" : "")} onClick={() => onSwitchLang("de")}>DE</button>
      </div>

      {/* Modus */}
      <div className="lang-switch" style={{ marginLeft: 12 }}>
        <button className={"lang" + (mode === "read" ? " lang--on" : "")} onClick={() => setMode("read")}
                title="Lesemodus">📖</button>
        <button className={"lang" + (mode === "hybrid" ? " lang--on" : "")} onClick={() => setMode("hybrid")}
                title="Lesen + Hören">⊕</button>
        <button className={"lang" + (mode === "listen" ? " lang--on" : "")} onClick={() => setMode("listen")}
                title="Hörmodus">🎧</button>
      </div>

      {/* Untertitel (nur Hör-/Hybridmodus) */}
      {(mode === "listen" || mode === "hybrid") && (
        <div className="lang-switch" style={{ marginLeft: 8 }}>
          <button className={"lang" + (subtitleLang === null ? " lang--on" : "")}
                  onClick={() => setSubtitleLang(null)} title="Kein Untertitel">—</button>
          <button className={"lang" + (subtitleLang === "en" ? " lang--on" : "")}
                  onClick={() => setSubtitleLang(subtitleLang === "en" ? null : "en")}>EN</button>
          <button className={"lang" + (subtitleLang === "de" ? " lang--on" : "")}
                  onClick={() => setSubtitleLang(subtitleLang === "de" ? null : "de")}>DE</button>
        </div>
      )}

      <div className="player-note">Gemini · Charon</div>
    </div>
  );
}
