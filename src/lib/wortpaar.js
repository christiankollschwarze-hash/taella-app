// AP 54c (26.10.2026): Wort + Gegenwort synchron zur Audiozeit aus den Ankerzeiten der Wortbrücke (s525 → s710).
// Anker (im Manifest der Originalsprache, align[]):
//   <quelle>_span  Zeichen im Quellsatz   t  = [t0,t1]  Wortzeit im Quell-Audio (s, clip-relativ, Tempo 1.0)
//   <ziel>_span    Zeichen im Zielsatz     tz = [[t0,t1],…] Wortzeit(en) im Ziel-Audio, je Ziel-Span ein Fenster
//   zspans         mehrteiliges Gegenstück ("schlug … auf"), Index wie tz; Teil-Token = Span innerhalb eines Wortes
// Anker ohne Ziel ("none") oder ohne Zeit bleiben ohne Gegenstück. Hörspiel-Clips haben andere Zeiten → nicht nutzen.
const TOL = 0.02;     // wie Karaoke: Wort gilt ab t0 − 20 ms
const NACH = 0.15;    // Fenster bleibt kurz nach t1 aktiv (Übergang zum nächsten Wort)

export function hatAnkerzeiten(node) {
  return !!node?.align?.some((a) => Array.isArray(a.t) || Array.isArray(a.tz));
}

// Fenster je Anker in der gehörten Sprache: [{t0,t1,heard:[a,b],other:[[a,b],…]}]
function fenster(node, heard, quelle) {
  const ziel = quelle === "de" ? "en" : "de";
  const qs = `${quelle}_span`, zs = `${ziel}_span`;
  const out = [];
  for (const a of node.align || []) {
    const zielSpans = a.zspans?.length ? a.zspans : Array.isArray(a[zs]) ? [a[zs]] : [];
    const hatZiel = zielSpans.length > 0 && (a[ziel] != null || a.zspans);
    if (heard === quelle) {
      if (!Array.isArray(a.t) || !Array.isArray(a[qs])) continue;
      out.push({ t0: a.t[0], t1: a.t[1], heard: [a[qs]], other: hatZiel ? zielSpans : [] });
    } else {
      if (!Array.isArray(a.tz) || !hatZiel || !Array.isArray(a[qs])) continue;
      a.tz.forEach((w, j) => {
        const sp = zielSpans[j] || zielSpans[0];
        if (Array.isArray(w) && sp) out.push({ t0: w[0], t1: w[1], heard: [sp], other: [a[qs]] });
      });
    }
  }
  // gleiche Zeit + gleiche Stelle (n:1, z. B. zwei EN-Wörter → ein DE-Wort) zusammenfassen
  out.sort((x, y) => x.t0 - y.t0 || x.heard[0][0] - y.heard[0][0]);
  const m = [];
  for (const f of out) {
    const g = m[m.length - 1];
    if (g && Math.abs(g.t0 - f.t0) < 1e-3 && g.heard[0][0] === f.heard[0][0]) g.other.push(...f.other);
    else m.push({ ...f, other: [...f.other] });
  }
  return m;
}

// Zustand je Zeichen für gehörten Satz und Gegensatz: 0 grau · 1 gesprochen · 2 jetzt.
// null = keine Ankerzeiten → Aufrufer nimmt die bisherige Karaoke.
export function wortpaarZustand(node, heard, time, quelle, lenHeard, lenOther) {
  const fs = fenster(node, heard, quelle);
  if (!fs.length) return null;
  const T = time + TOL;
  const h = new Uint8Array(lenHeard), o = new Uint8Array(lenOther);
  let aktiv = null;
  for (const f of fs) {
    if (f.t0 > T) break;
    if (T <= f.t1 + NACH) aktiv = f;                      // spätestes laufendes Fenster gewinnt
  }
  const setze = (arr, sp, v) => { for (let c = Math.max(0, sp[0]); c < Math.min(arr.length, sp[1]); c++) arr[c] = Math.max(arr[c], v); };
  for (const f of fs) {
    if (f.t0 > T) break;
    if (f === aktiv) continue;
    if (f.t1 + NACH < T || (aktiv && f.t0 < aktiv.t0)) { f.heard.forEach((s) => setze(h, s, 1)); f.other.forEach((s) => setze(o, s, 1)); }
  }
  if (aktiv) { aktiv.heard.forEach((s) => setze(h, s, 2)); aktiv.other.forEach((s) => setze(o, s, 2)); }
  return { heard: h, other: o, aktiv: !!aktiv };
}

// Text + Zeichenzustand → Läufe [{text, cls}] (Teil-Token: Markierung mitten im Wort möglich)
export function laeufe(text, state) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const v = state ? state[i] : 0;
    let j = i + 1;
    while (j < text.length && (state ? state[j] : 0) === v && !(v && /\s/.test(text[j]))) j++;
    out.push({ text: text.slice(i, j), cls: v === 2 ? "w-now" : v === 1 ? "w-done" : "" });
    i = j;
  }
  return out;
}

// Bisherige Token-Karaoke als Zeichenzustand (gehörte Sprache, auch Wörter ohne Anker)
export function tokenZustand(text, tokStarts, time) {
  const st = new Uint8Array(text.length);
  const toks = [...text.matchAll(/\S+/g)];
  let cur = -1;
  for (let i = 0; i < tokStarts.length; i++) if (tokStarts[i] <= time + TOL) cur = i;
  toks.forEach((m, i) => { const v = i < cur ? 1 : i === cur ? 2 : 0; if (v) st.fill(v, m.index, m.index + m[0].length); });
  return { st, cur, curSpan: cur >= 0 ? [toks[cur].index, toks[cur].index + toks[cur][0].length] : null };
}
