import { useState, useRef } from "react";
import DotWord from "../design/DotWord.jsx";
import { IconSchliessen } from "../design/Icons.jsx";
import { settings, resetProgress, uiLang } from "../lib/settings.js";
import { lernspur, loescheLernspur, exportiereLernspur } from "../lib/lernspur.js";

// Einstellungen: Sprache, Darstellung, Konto (nur Hinweis, keine Preise), Daten, Über.

const TXT = {
  de: {
    titel: "Einstellungen",
    sprache: "Sprache", muttersprache: "Muttersprache", hoerStart: "Hören startet in",
    nativeOpt: "Muttersprache", lernOpt: "Lernsprache",
    darstellung: "Darstellung", nacht: "Nachtmodus", schrift: "Schriftgröße",
    konto: "Konto", kontoText: "Ohne Konto ist Kapitel 1 jedes Buches frei. Konto und Zugang verwaltest du auf taella.io.",
    demo: "Vollzugang simulieren (Demo)",
    kurator: "Kuratormodus (Testumgebung)", kuratorText: "Lesen: Satz lang drücken. Hören: Stift-Taste. Anmerkungen landen direkt im Werkordner.",
    daten: "Daten", spur: "Lernspur", spurText: (n, w) => `${n} Übersetzungen gemerkt, davon ${w} beim Hören. Daraus entsteht später deine Lernschicht. Bleibt auf diesem Gerät.`, spurExport: "Lernspur exportieren (JSON)", spurLoeschen: "Lernspur löschen", spurGeloescht: "Gelöscht", reset: "Lesefortschritt zurücksetzen", resetOk: "Zurückgesetzt",
    intro: "Einführung erneut zeigen",
    ueber: "Über", ueberText: "Texte gemeinfrei, modernisiert und übersetzt von SOMNIO. Englische Hörbücher: LibriVox (gemeinfrei).",
  },
  en: {
    titel: "Settings",
    sprache: "Language", muttersprache: "Native language", hoerStart: "Listening starts in",
    nativeOpt: "Native", lernOpt: "Learning",
    darstellung: "Display", nacht: "Night mode", schrift: "Text size",
    konto: "Account", kontoText: "Without an account, chapter 1 of every book is free. Manage your account and access on taella.io.",
    demo: "Simulate full access (demo)",
    kurator: "Curator mode (test environment)", kuratorText: "Reading: long-press a sentence. Listening: pen button. Notes go straight to the work folder.",
    daten: "Data", spur: "Learning trail", spurText: (n, w) => `${n} translations saved, ${w} of them while listening. This will become your learning layer. Stays on this device.`, spurExport: "Export learning trail (JSON)", spurLoeschen: "Delete learning trail", spurGeloescht: "Deleted", reset: "Reset reading progress", resetOk: "Reset done",
    intro: "Show introduction again",
    ueber: "About", ueberText: "Public-domain texts, modernised and translated by SOMNIO. English audiobooks: LibriVox (public domain).",
  },
};

function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} className={"seg-btn" + (value === v ? " seg-btn--on" : "")} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function Switch({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={"switch" + (on ? " switch--on" : "")} onClick={() => onChange(!on)}>
      <span className="switch-knob" />
    </button>
  );
}

export default function Settings({ onClose, onRestartIntro }) {
  const [native, setNative] = useState(() => uiLang());
  const [startLang, setStartLang] = useState(() => settings.defaultLang() || native);
  const [dark, setDark] = useState(() => settings.dark());
  const [size, setSize] = useState(() => settings.textSize());
  const [konto, setKonto] = useState(() => settings.konto());
  const [kurator, setKurator] = useState(() => settings.kurator());
  const [resetDone, setResetDone] = useState(false);
  const [spur, setSpur] = useState(() => lernspur());
  const changed = useRef(false);
  const t = TXT[native] || TXT.en;
  const lern = native === "de" ? "en" : "de";
  const mark = () => { changed.current = true; };

  return (
    <div className="settings" role="dialog" aria-label={t.titel}>
      <header className="settings-top">
        <h1 className="settings-h"><DotWord text={t.titel} /></h1>
        <button className="icon-btn" aria-label="Schließen" onClick={() => onClose(changed.current)}><IconSchliessen /></button>
      </header>

      <div className="settings-body">
        <section className="set-group">
          <h2 className="set-label">{t.sprache}</h2>
          <div className="set-row">
            <span>{t.muttersprache}</span>
            <Seg label={t.muttersprache} value={native} options={[["de", "Deutsch"], ["en", "English"]]}
                 onChange={(v) => { setNative(v); settings.setNative(v); mark(); }} />
          </div>
          <div className="set-row">
            <span>{t.hoerStart}</span>
            <Seg label={t.hoerStart} value={startLang} options={[[native, t.nativeOpt], [lern, t.lernOpt]]}
                 onChange={(v) => { setStartLang(v); settings.setDefaultLang(v); mark(); }} />
          </div>
        </section>

        <section className="set-group">
          <h2 className="set-label">{t.darstellung}</h2>
          <div className="set-row">
            <span>{t.nacht}</span>
            <Switch label={t.nacht} on={dark} onChange={(v) => { setDark(v); settings.setDark(v); mark(); }} />
          </div>
          <div className="set-row">
            <span>{t.schrift}</span>
            <Seg label={t.schrift} value={size} options={[["s", "A"], ["m", "A"], ["l", "A"]].map(([v], i) => [v, <span key={v} style={{ fontSize: 13 + i * 3 }}>A</span>])}
                 onChange={(v) => { setSize(v); settings.setTextSize(v); mark(); }} />
          </div>
        </section>

        <section className="set-group">
          <h2 className="set-label">{t.konto}</h2>
          <p className="set-text">{t.kontoText}</p>
          <div className="set-row">
            <span>{t.demo}</span>
            <Switch label={t.demo} on={konto} onChange={(v) => { setKonto(v); settings.setKonto(v); mark(); }} />
          </div>
          <div className="set-row">
            <span>{t.kurator}</span>
            <Switch label={t.kurator} on={kurator} onChange={(v) => { setKurator(v); settings.setKurator(v); mark(); }} />
          </div>
          {kurator && <p className="set-text">{t.kuratorText}</p>}
        </section>

        <section className="set-group">
          <h2 className="set-label">{t.spur}</h2>
          <p className="set-text">{t.spurText(spur.length, spur.filter((e) => e.art === "upps_hoeren").length)}</p>
          {spur.length > 0 && (
            <ul className="spur-liste">
              {spur.slice(-5).reverse().map((e, i) => (
                <li key={i}><span className="spur-q">{e.quelle}</span><span className="spur-z">{e.ziel}</span></li>
              ))}
            </ul>
          )}
          <button className="set-link" disabled={!spur.length} onClick={exportiereLernspur}>{t.spurExport}</button>
          <button className="set-link" disabled={!spur.length} onClick={() => { loescheLernspur(); setSpur([]); }}>
            {spur.length ? t.spurLoeschen : t.spurGeloescht}
          </button>
        </section>

        <section className="set-group">
          <h2 className="set-label">{t.daten}</h2>
          <button className="set-link" onClick={() => { resetProgress(); setResetDone(true); mark(); }}>
            {resetDone ? t.resetOk : t.reset}
          </button>
          <button className="set-link" onClick={onRestartIntro}>{t.intro}</button>
        </section>

        <section className="set-group">
          <h2 className="set-label">{t.ueber}</h2>
          <p className="set-text">{t.ueberText}</p>
        </section>
      </div>
    </div>
  );
}
