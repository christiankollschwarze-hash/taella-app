import Satz from "./Satz.jsx";
import SprecherLabel from "./SprecherLabel.jsx";

export default function Page({ nodes, lang, activeBid, playingId, setActive, registerRef, bookmarkedId, onBookmark }) {
  const blocks = [];
  let currentBlock = [];

  // Drama-Modus: neuer Block bei Sprecherwechsel / Regieanweisung; Rollenname ueber der Replik
  let blockSprecher = null;
  let blockRegie = false;
  const flushBlock = () => {
    if (currentBlock.length) {
      blocks.push({ type: "absatz", nodes: [...currentBlock], sprecher: blockSprecher, regie: blockRegie });
      currentBlock = [];
    }
  };

  for (const n of nodes) {
    if (n.typ === "h") {
      flushBlock();
      blocks.push({ type: "h", node: n });
    } else if (n.typ === "p") {
      flushBlock();
    } else if (n.typ === "bild") {
      flushBlock();
      blocks.push({ type: "bild", node: n });
    } else {
      const sp = n.sprecher || null;
      const rg = n.rolle === "regie";
      if ((sp || rg || blockSprecher || blockRegie) && (sp !== blockSprecher || rg !== blockRegie)) {
        flushBlock();
        blockSprecher = sp;
        blockRegie = rg;
      }
      currentBlock.push(n);
    }
  }
  flushBlock();

  return (
    <div className="page">
      {blocks.map((b, bi) => {
        if (b.type === "h") {
          return (
            <div key={b.node.tag_id} className="kapitel-titel">
              {b.node[lang]?.text || b.node.en?.text}
            </div>
          );
        }
        if (b.type === "bild") {
          return (
            <figure key={b.node.tag_id} className="abbildung" data-tag={b.node.tag_id}>
              {b.node.bild && <img src={b.node.bild} alt={b.node.alt} loading="lazy" />}
            </figure>
          );
        }
        return (
          <p key={bi} className={"absatz" + (b.regie ? " absatz--regie" : "") + (b.sprecher ? " absatz--replik" : "")}>
            {b.sprecher && <SprecherLabel name={b.sprecher} />}
            {b.nodes.map((n) => (
              <Satz
                key={n.tag_id}
                node={n}
                lang={lang}
                isActive={activeBid === n.tag_id}
                isPlaying={playingId === n.tag_id}
                isBookmarked={bookmarkedId === n.tag_id}
                setActive={setActive}
                registerRef={registerRef}
                onBookmark={onBookmark}
              />
            ))}
          </p>
        );
      })}
    </div>
  );
}
