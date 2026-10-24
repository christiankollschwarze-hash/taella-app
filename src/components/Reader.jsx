// Rendert Knoten in Lesefolge.
// onBookmark: null im Hörmodus, gesetzt im Lesemodus (Rechtsklick => Lesezeichen)
// bookmarkedId: tag_id des aktuellen Lesezeichens
// readLang: "en" | "de" – welche Sprache im Lesemodus angezeigt wird
import Satz from "./Satz.jsx";

export default function Reader({ work, activeBid, playingId, setActive, registerRef,
                                  onBookmark, bookmarkedId, readLang }) {
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ typ: "p", saetze: para }); para = []; } };
  for (const n of work.nodes) {
    if (n.typ === "h") { flush(); blocks.push({ typ: "h", node: n }); }
    else if (n.typ === "p") { flush(); }
    else { para.push(n); }
  }
  flush();

  const handleContext = onBookmark
    ? (e, tagId) => { e.preventDefault(); onBookmark(tagId); }
    : null;

  return (
    <div className="reader">
      {blocks.map((b, i) =>
        b.typ === "h" ? (
          <h2 key={i} className="kapitel-titel"
              onContextMenu={handleContext ? (e) => handleContext(e, b.node.tag_id) : undefined}>
            <Satz node={b.node} activeBid={activeBid} playing={playingId === b.node.tag_id}
                  setActive={setActive} registerRef={registerRef}
                  isBookmarked={bookmarkedId === b.node.tag_id} />
          </h2>
        ) : (
          <p key={i} className="absatz">
            {b.saetze.map((n) => (
              <span key={n.tag_id}
                    onContextMenu={handleContext ? (e) => handleContext(e, n.tag_id) : undefined}>
                <Satz node={n} activeBid={activeBid} playing={playingId === n.tag_id}
                      setActive={setActive} registerRef={registerRef}
                      isBookmarked={bookmarkedId === n.tag_id} />
              </span>
            ))}
          </p>
        )
      )}
    </div>
  );
}
