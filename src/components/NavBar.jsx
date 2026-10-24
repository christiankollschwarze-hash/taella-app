// Navigationsleiste: ‹ | ☰ 🔊 🌐 ☀️/🌙 | ›
export default function NavBar({ onPrev, onNext, hasPrev, hasNext,
                                  lang, onLangSwitch,
                                  onChapterMenu, onAudio,
                                  darkMode, onToggleDark }) {
  const flagOther = lang === "en" ? "🇩🇪" : "🇬🇧";

  return (
    <nav className="navbar">
      <button className="nav-btn nav-arrow" onClick={onPrev} disabled={!hasPrev}
              aria-label="Vorherige Seite">‹</button>

      <div className="nav-center">
        <button className="nav-btn" onClick={onChapterMenu} aria-label="Kapitel">☰</button>
        <button className="nav-btn" onClick={onAudio} aria-label="Audio">🔊</button>
        <button className="nav-btn nav-flag" onClick={onLangSwitch} aria-label="Sprache wechseln">
          {flagOther}
        </button>
        <button className="nav-btn" onClick={onToggleDark} aria-label="Hell/Dunkel">
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>

      <button className="nav-btn nav-arrow" onClick={onNext} disabled={!hasNext}
              aria-label="Nächste Seite">›</button>
    </nav>
  );
}
