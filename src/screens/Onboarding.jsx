import { useState } from "react";
import DotWord from "../design/DotWord.jsx";
import { settings, uiLang } from "../lib/settings.js";

// Einführung in vier Schritten. Bewusst OHNE Konto, Karte oder Abo-Frage:
// erst der Wert (ein Satz zum Antippen), dann die Bibliothek mit Kapitel 1 frei.

const TXT = {
  de: {
    claim: "Klassiker lesen und hören.\nIn zwei Sprachen.",
    los: "Los geht’s",
    sprache: "Deine Muttersprache?",
    spracheHint: "Klappentexte, Menüs und die Übersetzungshilfe erscheinen in dieser Sprache.",
    lernst: (l) => `Du liest und hörst auf ${l}.`,
    tippe: "Tippe auf den Satz.",
    tippeHint: "Verstehst du etwas nicht, zeigt ein Tipp den Satz in deiner Sprache. Ein zweiter Tipp blendet ihn wieder aus.",
    weiter: "Weiter",
    zuletzt: "Lesen und Hören an derselben Stelle.",
    zuletztHint: "Wechsle jederzeit zwischen Buch und Hörbuch – TÆLLA merkt sich den Satz.",
    frei: "Kein Konto, keine Karte. Das erste Kapitel jedes Buches ist frei.",
    start: "Zur Bibliothek",
  },
  en: {
    claim: "Read and listen to the classics.\nIn two languages.",
    los: "Let’s go",
    sprache: "Your native language?",
    spracheHint: "Blurbs, menus and the translation help appear in this language.",
    lernst: (l) => `You read and listen in ${l}.`,
    tippe: "Tap the sentence.",
    tippeHint: "If something is unclear, one tap shows the sentence in your language. Tap again to hide it.",
    weiter: "Next",
    zuletzt: "Reading and listening, same place.",
    zuletztHint: "Switch between book and audiobook anytime – TÆLLA remembers the sentence.",
    frei: "No account, no card. The first chapter of every book is free.",
    start: "To the library",
  },
};

const BEISPIEL = {
  en: "Buck did not read the newspapers, or he would have known that trouble was brewing.",
  de: "Buck las keine Zeitungen, sonst hätte er gewusst, dass sich Ärger zusammenbraute.",
};
const SPRACHNAME = { de: { en: "Englisch", de: "Deutsch" }, en: { en: "English", de: "German" } };

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [native, setNative] = useState(() => settings.native() || uiLang());
  const [upps, setUpps] = useState(false);
  const t = TXT[native] || TXT.en;
  const lern = native === "de" ? "en" : "de";

  const choose = (l) => { setNative(l); settings.setNative(l); };

  return (
    <div className="shell onb">
      <div className="onb-dots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <span key={i} className={"onb-dot" + (i === step ? " on" : "")} />)}
      </div>

      {step === 0 && (
        <section className="onb-step onb-step--hero">
          <DotWord text="TÆLLA" className="wordmark onb-wordmark" />
          <p className="onb-claim">{t.claim}</p>
          <button className="btn btn--ink btn--wide" onClick={() => setStep(1)}>{t.los}</button>
        </section>
      )}

      {step === 1 && (
        <section className="onb-step">
          <h1 className="onb-h">{t.sprache}</h1>
          <div className="onb-choices">
            {["de", "en"].map((l) => (
              <button key={l} className={"choice" + (native === l ? " choice--on" : "")} onClick={() => choose(l)}>
                <span className="choice-label">{l === "de" ? "Deutsch" : "English"}</span>
                {native === l && <span className="choice-dot" aria-label="gewählt" />}
              </button>
            ))}
          </div>
          <p className="onb-hint">{t.spracheHint}</p>
          <button className="btn btn--ink btn--wide" onClick={() => { settings.setNative(native); setStep(2); }}>{t.weiter}</button>
        </section>
      )}

      {step === 2 && (
        <section className="onb-step">
          <p className="onb-kicker">{t.lernst(SPRACHNAME[native][lern])}</p>
          <h1 className="onb-h">{t.tippe}</h1>
          <button className={"onb-satz" + (upps ? " onb-satz--upps" : "")} onClick={() => setUpps((u) => !u)}>
            <span className="onb-satz-text">{BEISPIEL[lern]}</span>
            {upps && <span className="onb-satz-upps">{BEISPIEL[native]}</span>}
          </button>
          <p className="onb-hint">{t.tippeHint}</p>
          <button className="btn btn--ink btn--wide" onClick={() => setStep(3)}>{t.weiter}</button>
        </section>
      )}

      {step === 3 && (
        <section className="onb-step">
          <h1 className="onb-h">{t.zuletzt}</h1>
          <p className="onb-hint">{t.zuletztHint}</p>
          <p className="onb-frei">{t.frei}</p>
          <button className="btn btn--ink btn--wide" onClick={onDone}>{t.start}</button>
        </section>
      )}
    </div>
  );
}
