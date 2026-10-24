import { useState, useMemo } from "react";
import DotWord from "../design/DotWord.jsx";
import { KATEGORIEN, speichern } from "../lib/kuration.js";

// Kuratormodus: Anmerkung zu einem Satz (Kategorie, freie Notiz, bei Sprecher: richtiger Sprecher).
export default function KuratorSheet({ work, node, lang, uiDe, modus, zeit, onClose, onSaved }) {
  const [kat, setKat] = useState(null);
  const [notiz, setNotiz] = useState("");
  const [sprecher, setSprecher] = useState("");
  const [status, setStatus] = useState(null);
  const sprecherListe = useMemo(
    () => [...new Set(work.nodes.map((n) => n.sprecher).filter(Boolean))].sort(),
    [work.nodes]
  );
  if (!node) return null;

  const sichern = async () => {
    if (!kat) return;
    setStatus("…");
    const r = await speichern({
      slug: work.meta.slug, tag_id: node.tag_id, kategorie: kat, notiz: notiz.trim(),
      sprecher_neu: kat === "sprecher" ? sprecher.trim() : undefined, sprecher_alt: node.sprecher || undefined,
      sprache: lang, modus, sekunde: zeit != null ? Math.round(zeit * 10) / 10 : undefined,
      text_en: node.en?.text || "", text_de: node.de?.text || "",
    });
    setStatus(r.offline ? (uiDe ? "Nur lokal gespeichert (kein Server)" : "Saved locally only") : (uiDe ? "Gespeichert" : "Saved"));
    onSaved?.(r.eintrag);
    setTimeout(onClose, 700);
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="sheet kur-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kuration">
        <div className="sheet-handle" />
        <div className="sheet-title"><DotWord text={uiDe ? "Anmerkung" : "Note"} /></div>
        <div className="kur-satz">
          <span className="kur-id">{node.tag_id}{node.sprecher ? ` · ${node.sprecher}` : ""}</span>
          <p lang="en">{node.en?.text}</p>
          <p lang="de" className="kur-de">{node.de?.text}</p>
        </div>
        <div className="kur-kats" role="radiogroup">
          {KATEGORIEN.map(([k, de, en]) => (
            <button key={k} role="radio" aria-checked={kat === k} className={"regal" + (kat === k ? " regal--on" : "")}
                    onClick={() => setKat(k)}>{uiDe ? de : en}</button>
          ))}
        </div>
        {kat === "sprecher" && (
          <div className="kur-feld">
            <input className="shop-suche-feld" list="kur-sprecher" value={sprecher} onChange={(e) => setSprecher(e.target.value)}
                   placeholder={uiDe ? "Richtiger Sprecher (oder Erzähler)" : "Correct speaker (or narrator)"} />
            <datalist id="kur-sprecher">
              {["Erzaehler", ...sprecherListe].map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        )}
        <div className="kur-feld">
          <textarea className="kur-notiz" rows={3} value={notiz} onChange={(e) => setNotiz(e.target.value)}
                    placeholder={uiDe ? "Was ist falsch / wie soll es sein?" : "What is wrong / how should it be?"} />
        </div>
        <div className="kur-aktionen">
          <button className="btn" onClick={onClose}>{uiDe ? "Abbrechen" : "Cancel"}</button>
          <button className="btn btn--ink" disabled={!kat} onClick={sichern}>{status || (uiDe ? "Speichern" : "Save")}</button>
        </div>
      </div>
    </div>
  );
}
