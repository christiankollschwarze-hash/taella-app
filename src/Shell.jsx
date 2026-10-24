import { useState, useEffect, useCallback } from "react";
import App from "./App.jsx";
import Onboarding from "./screens/Onboarding.jsx";
import BookShop from "./screens/BookShop.jsx";
import Settings from "./screens/Settings.jsx";
import { settings, applyTheme, applyTextSize } from "./lib/settings.js";
import "./module.css";

// Rahmen der App: Einführung → Book-Shop (Entdecken / Meine Bücher) → Reader/Hören.
// Einstellungen liegen als eigene Ebene darüber und sind überall erreichbar.
export default function Shell() {
  const [onboarded, setOnboarded] = useState(() => settings.onboarded());
  const [open, setOpen] = useState(null);          // geöffnetes Werk { slug, base, cover }
  const [showSettings, setShowSettings] = useState(false);
  const [rev, setRev] = useState(0);               // nach Einstellungen Reader neu aufbauen

  useEffect(() => { applyTheme(); applyTextSize(); }, []);

  const openWork = useCallback((w, mode) => {
    settings.setMode(mode);
    // Fallback-Bild (cover.png o. ä.) nur, wenn kein sprachspezifisches Cover existiert
    const fallback = (w.cover || []).find((c) => !/^cover_\w+\.jpg$/.test(c)) || null;
    setOpen({ slug: w.slug, base: w.base, cover: fallback, privat: !!w.privat });
  }, []);

  const closeSettings = useCallback((changed) => {
    setShowSettings(false);
    if (changed) setRev((r) => r + 1);
  }, []);

  if (!onboarded) {
    return <Onboarding onDone={() => { settings.setOnboarded(true); setOnboarded(true); }} />;
  }

  return (
    <>
      {open ? (
        <App key={`${open.base}|${rev}`} base={open.base} cover={open.cover} privat={open.privat}
             onBack={() => setOpen(null)} onSettings={() => setShowSettings(true)} />
      ) : (
        <BookShop key={rev} onOpen={openWork} onSettings={() => setShowSettings(true)} />
      )}
      {showSettings && (
        <Settings onClose={closeSettings}
                  onRestartIntro={() => { settings.setOnboarded(false); setShowSettings(false); setOpen(null); setOnboarded(false); }} />
      )}
    </>
  );
}
