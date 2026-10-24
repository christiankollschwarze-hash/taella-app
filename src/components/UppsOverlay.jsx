import { useEffect, useRef } from "react";

export default function UppsOverlay({ anchor, text, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !anchor) return;
    const el = ref.current;
    const wrap = el.offsetParent; // .page-wrap (position: relative)
    const ar = anchor.getBoundingClientRect();
    const wr = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0 };
    const vw = window.innerWidth;

    let left = ar.left - wr.left;
    const top = ar.bottom - wr.top + (wrap ? wrap.scrollTop : 0) + 6;

    if (left + 280 > vw - 8) left = vw - wr.left - 288;
    if (left < 8) left = 8;

    el.style.left = left + "px";
    el.style.top = top + "px";
  }, [anchor]);

  if (!text) return null;
  return (
    <div ref={ref} className="upps-overlay" onClick={onClose}>
      <div className="upps-pfeil" />
      {text}
    </div>
  );
}
