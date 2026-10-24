import { useLayoutEffect, useRef, useState } from "react";

// Wort mit rotem Punkt AUF dem Strichende des letzten Buchstabens (Design D).
// Die Position wird an der echten Glyphe gemessen (Canvas measureText → Tinten-Ausdehnung),
// damit der Punkt in jeder Schrift/Größe auf dem Fuß sitzt statt daneben.

const STEM_CHARS = /[IilJj1|!]/;              // Ein-Strich-Glyphen: Punkt mittig unter den Strich
let ctx = null;

function measure(el, text) {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  const cs = getComputedStyle(el);
  const fs = parseFloat(cs.fontSize) || 16;
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const last = text.slice(-1);
  const m = ctx.measureText(last);
  const ls = parseFloat(cs.letterSpacing) || 0;
  const bold = parseInt(cs.fontWeight, 10) >= 600;
  const stem = fs * (bold ? 0.105 : 0.08);           // Strichstärke der Schrift (Näherung je Gewicht)
  const d = Math.max(4, stem * (bold ? 1.75 : 2.1));  // Punkt etwas kräftiger als der Strich
  // Lage relativ zum Ende der Vorschubbreite des letzten Zeichens (dort sitzt der Anker)
  const inkL = -m.actualBoundingBoxLeft, inkR = m.actualBoundingBoxRight;
  const cx = STEM_CHARS.test(last) ? (inkL + inkR) / 2 : inkR - stem / 2;
  return { dx: cx - m.width - ls, d };
}

export default function DotWord({ text, className, style, dotColor }) {
  const ref = useRef(null);
  const [g, setG] = useState(null);

  useLayoutEffect(() => {
    let alive = true;
    const run = () => { if (alive && ref.current) setG(measure(ref.current, text)); };
    run();
    document.fonts?.ready.then(run);
    return () => { alive = false; };
  }, [text]);

  return (
    <span ref={ref} className={className} style={{ whiteSpace: "nowrap", ...style }}>
      {text}
      <span aria-hidden="true" style={{ display: "inline-block", width: 0, height: 0, position: "relative", verticalAlign: "baseline" }}>
        {g && (
          <span style={{
            position: "absolute", left: g.dx - g.d / 2, bottom: -g.d * 0.12,
            width: g.d, height: g.d, borderRadius: "50%",
            background: dotColor || "var(--dot)", display: "block",
          }} />
        )}
      </span>
    </span>
  );
}
