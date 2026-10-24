import DotWord from "../design/DotWord.jsx";

// Bottom-Sheet mit Kapitelliste (Design D): Nummer serifenlos, Titel in Serifen,
// aktives Kapitel trägt den roten Punkt.
function split(titel) {
  const m = (titel || "").match(/^(?:Chapter|Kapitel)\s+([IVXLC\d]+)\.?\s*(.*)$/i);
  return m ? { nr: m[1], name: m[2] || titel } : { nr: "", name: titel };
}

export default function ChapterSheet({ kapitel, currentKapitel, onJump, onClose, lang = "en" }) {
  return (
    <div className="sheet-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={lang === "de" ? "Kapitel" : "Chapters"}>
        <div className="sheet-handle" />
        <div className="sheet-title"><DotWord text={lang === "de" ? "Kapitel" : "Chapters"} /></div>
        <ul className="chapter-list">
          {kapitel.map((k) => {
            const { nr, name } = split(lang === "de" ? k.titel_de : k.titel);
            const active = k.tag_id === currentKapitel;
            return (
              <li key={k.tag_id}>
                <button className={"chapter-item" + (active ? " chapter-item--active" : "")}
                        onClick={() => { onJump(k.tag_id); onClose(); }}>
                  <span className="chapter-nr">{nr}</span>
                  <span className="chapter-name">{name}</span>
                  {active && <span className="chapter-dot" aria-label="aktuell" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
