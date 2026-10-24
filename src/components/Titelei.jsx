import Satz from "./Satz.jsx";

const T = {
  en: { autor: "About the author" },
  de: { autor: "Über den Autor" },
};

// EN/DE-Satzpaar → Node im Manifest-Format, ganzer Satz als Flyover-Phrase
function pairNode(pair, id) {
  const en = pair.en || "", de = pair.de || "";
  return {
    tag_id: id, typ: "s",
    en: { text: en }, de: { text: de },
    align: [{ en_span: [0, en.length], de, de_span: [0, de.length] }],
  };
}

export function CoverPage({ src, titel, autor }) {
  return (
    <div className="titelei titelei--cover">
      {src ? (
        <img className="cover-img" src={src} alt={`${titel} – ${autor}`} />
      ) : (
        <div className="cover-fallback"><div>{titel}</div><div>{autor}</div></div>
      )}
    </div>
  );
}

export function BlurbPage({ blurb, lang, activeBid, setActive }) {
  const t = T[lang] || T.en;
  const block = (arr, prefix) =>
    (arr || []).map((p, i) => {
      const n = pairNode(p, `${prefix}${i}`);
      return <Satz key={n.tag_id} node={n} lang={lang} isActive={activeBid === n.tag_id} setActive={setActive} />;
    });
  return (
    <div className="titelei titelei--blurb">
      <p className="blurb-einordnung">{block(blurb.einordnung, "blurb-e")}</p>
      <blockquote className="blurb-koeder">{block(blurb.koeder, "blurb-k")}</blockquote>
      {blurb.autor_info?.length > 0 && (
        <>
          <div className="blurb-label">{t.autor}</div>
          <p className="blurb-autor">{block(blurb.autor_info, "blurb-a")}</p>
        </>
      )}
    </div>
  );
}
