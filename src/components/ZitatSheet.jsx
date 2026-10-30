import { useEffect, useRef, useState } from "react";
import DotWord from "../design/DotWord.jsx";
import { zeichneKarte, karteAufnehmen, ladeBild, ladeClip, teilen, speichern } from "../lib/zitatTeilen.js";

// Teilen-Blatt für einen Satz: Vorschau der Karte, Aufnahme, dann Teilen oder Speichern.
export default function ZitatSheet({ titel, autor, text, de, clipUrl, coverSrc, onClose, onFertig }) {
  const canvasRef = useRef(null);
  const datei = useRef(null);
  const [status, setStatus] = useState("vorschau");   // vorschau | rendert | fertig | fehler
  const [fort, setFort] = useState(0);
  const [hinweis, setHinweis] = useState("");
  const d = { titel, autor, text, clipUrl, coverSrc };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [audio, cover] = await Promise.all([ladeClip(clipUrl), ladeBild(coverSrc)]);
        if (!alive || !canvasRef.current) return;
        zeichneKarte(canvasRef.current.getContext("2d"), { ...d, cover, dauer: audio.duration }, 0);
        setStatus("bereit");
      } catch { if (alive) setStatus("fehler"); }
    })();
    return () => { alive = false; };
  }, [clipUrl, coverSrc]);

  async function aufnehmen() {
    setStatus("rendert"); setFort(0); setHinweis("");
    try {
      datei.current = await karteAufnehmen(d, setFort);
      setStatus("fertig");
    } catch {
      setStatus("fehler");
      setHinweis(de ? "Aufnahme auf diesem Gerät nicht möglich." : "Recording not possible on this device.");
    }
  }

  async function teilenKlick() {
    const art = await teilen(datei.current, titel);
    if (art === "abgebrochen") return;          // Blatt bleibt offen, Audio bleibt pausiert
    if (art === "gespeichert") setHinweis(de ? "Als Datei gespeichert." : "Saved as file.");
    onFertig?.();                                 // geteilt/gespeichert: Blatt schließen, Audio weiter
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="sheet zitat-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={de ? "Zitat teilen" : "Share quote"}>
        <div className="sheet-handle" />
        <div className="sheet-title"><DotWord text={de ? "Zitat teilen" : "Share quote"} /></div>
        <canvas ref={canvasRef} width={720} height={1280} className="zitat-vorschau"
                aria-label={de ? "Vorschau der Zitat-Karte" : "Preview of the quote card"} />
        <div className="zitat-aktionen">
          {status === "bereit" && (
            <button className="zitat-btn zitat-btn--primary" onClick={aufnehmen}>{de ? "Karte erstellen" : "Create card"}</button>
          )}
          {status === "rendert" && (
            <p className="zitat-info">{de ? "Aufnahme läuft" : "Recording"} … {Math.round(fort * 100)} %</p>
          )}
          {status === "fertig" && (
            <>
              <button className="zitat-btn zitat-btn--primary" onClick={teilenKlick}>{de ? "Teilen" : "Share"}</button>
              <button className="zitat-btn" onClick={() => speichern(datei.current.blob, `taella-zitat.${datei.current.ext}`)}>
                {de ? "Speichern" : "Save"}
              </button>
            </>
          )}
        </div>
        {status === "fehler" && !hinweis && (
          <p className="zitat-info">{de ? "Vorschau konnte nicht geladen werden." : "Preview could not be loaded."}</p>
        )}
        {hinweis && <p className="zitat-info">{hinweis}</p>}
        <p className="zitat-info">{de ? "Der Clip wird in Echtzeit aufgenommen, so lang wie der Satz." : "The clip is recorded in real time, as long as the sentence."}</p>
      </div>
    </div>
  );
}
