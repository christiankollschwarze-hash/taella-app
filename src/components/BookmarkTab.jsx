import DotWord from "../design/DotWord.jsx";

// Lesezeichen-Lasche (Design D): schwarze Lasche gleitet von rechts herein,
// der rote Punkt sitzt an ihrem vorderen Ende. Dazu ein kurzer Hinweis.
const T = {
  en: { set: "Bookmark set", removed: "Bookmark removed" },
  de: { set: "Lesezeichen gesetzt", removed: "Lesezeichen entfernt" },
};

export function BookmarkRibbon({ fresh }) {
  return (
    <div className={"bm-tab" + (fresh ? " bm-tab--fresh" : "")} role="img" aria-label="Lesezeichen">
      <span className="bm-tab-dot" />
    </div>
  );
}

export function BookmarkToast({ kind, uiLang }) {
  if (!kind) return null;
  const t = T[uiLang] || T.en;
  return (
    <div className="bm-toast" role="status">
      <DotWord text={kind === "set" ? t.set : t.removed} />
    </div>
  );
}
