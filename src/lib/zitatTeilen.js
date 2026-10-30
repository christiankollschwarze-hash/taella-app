// Zitat-Teilen (TÆLLA): Satz-Clip + Karte → kurzes Video (MediaRecorder) → Teilen-Blatt oder Download.
// Die Karte trägt Wortmarke mit rotem Punkt, KI-Kennzeichnung, Cover, Zitat und Link.
const W = 720, H = 1280;
const RED = "#E0201B", INK = "#111111", GREY = "#555555", HAIR = "#DDDDDD";
const SANS = '"Instrument Sans", system-ui, sans-serif';
const SERIF = '"Newsreader", Georgia, serif';
export const SHARE_TEXT = "Hör dir den Satz aus meinem TÆLLA-Hörbuch an! KI-Stimme · taella.io";

// Zitat-Teilen je Werk abschaltbar (manifest: "zitat_teilen": false, z. B. bei Verlagstiteln ohne Freigabe)
export function zitatTeilbar(meta) { return meta?.zitat_teilen !== false; }

export function ladeBild(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

// Clip dekodieren (ohne Nutzergeste nötig)
export async function ladeClip(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  return new OfflineAudioContext(1, 1, 44100).decodeAudioData(buf);
}

function wrap(ctx, text, maxW) {
  const out = []; let zeile = "";
  for (const wort of text.split(/\s+/)) {
    const t = zeile ? zeile + " " + wort : wort;
    if (ctx.measureText(t).width > maxW && zeile) { out.push(zeile); zeile = wort; }
    else zeile = t;
  }
  if (zeile) out.push(zeile);
  return out;
}

function rund(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Wortmarke TÆLLA, roter Punkt auf dem letzten Buchstaben
function wortmarke(ctx, x, y, size) {
  ctx.font = `600 ${size}px ${SANS}`; ctx.fillStyle = INK;
  const kopf = "TÆLL", a = "A";
  ctx.fillText(kopf, x, y);
  const ax = x + ctx.measureText(kopf).width;
  ctx.fillText(a, ax, y);
  const aw = ctx.measureText(a).width;
  ctx.fillStyle = RED; ctx.beginPath();
  ctx.arc(ax + aw - size * 0.02, y + size * 0.02, size * 0.075, 0, Math.PI * 2); ctx.fill();
}

function zeit(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, "0")}`; }

// Karte zeichnen. t = Sekunden seit Clip-Start (0 = Vorschau)
export function zeichneKarte(ctx, d, t) {
  const dauer = d.dauer || 0;
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

  wortmarke(ctx, 56, 130, 56);

  // KI-Kennzeichnung oben rechts
  ctx.font = `500 22px ${SANS}`;
  const pille = "KI-Stimme", pw = ctx.measureText(pille).width + 32;
  rund(ctx, W - 56 - pw, 92, pw, 44, 22); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = INK; ctx.fillText(pille, W - 56 - pw + 16, 122);

  ctx.font = `400 26px ${SANS}`; ctx.fillStyle = GREY;
  ctx.fillText("Hör dir den Satz aus meinem TÆLLA-Hörbuch an!", 56, 215);

  // Cover, zentriert im Feld 280×400
  if (d.cover) {
    const k = Math.min(280 / d.cover.width, 400 / d.cover.height);
    const cw = d.cover.width * k, ch = d.cover.height * k;
    ctx.drawImage(d.cover, (W - cw) / 2, 260 + (400 - ch) / 2, cw, ch);
  }

  // Zitat in Serifen, Größe so gewählt, dass es in den Bereich 730–1020 passt
  let size = 40, lines = [];
  for (const s of [40, 36, 32, 28, 24]) {
    ctx.font = `400 ${s}px ${SERIF}`;
    size = s; lines = wrap(ctx, d.text || "", W - 112);
    if (lines.length * s * 1.42 <= 290) break;
  }
  ctx.font = `400 ${size}px ${SERIF}`; ctx.fillStyle = INK;
  lines.forEach((l, i) => ctx.fillText(l, 56, 760 + i * size * 1.42));

  ctx.font = `400 24px ${SANS}`; ctx.fillStyle = GREY;
  ctx.fillText(`${d.titel || ""}${d.autor ? " · " + d.autor : ""}`, 56, 1060);

  // Zeitleiste mit rotem Playhead
  const f = dauer > 0 ? Math.min(1, t / dauer) : 0;
  const x = 56 + (W - 112) * f;
  ctx.strokeStyle = HAIR; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(56, 1120); ctx.lineTo(W - 56, 1120); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(56, 1120); ctx.lineTo(x, 1120); ctx.stroke();
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, 1120, 9, 0, Math.PI * 2); ctx.fill();
  ctx.font = `400 22px ${SANS}`; ctx.fillStyle = GREY;
  ctx.fillText(`${zeit(Math.min(t, dauer))} / ${zeit(dauer)}`, 56, 1162);

  // Fußzeile: Link + Pille „Jetzt lesen“
  ctx.font = `500 28px ${SANS}`; ctx.fillStyle = INK;
  ctx.fillText("taella.io", 56, 1236);
  rund(ctx, W - 56 - 220, 1190, 220, 60, 30); ctx.fillStyle = INK; ctx.fill();
  ctx.font = `500 24px ${SANS}`; ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center";
  ctx.fillText("Jetzt lesen", W - 56 - 110, 1229);
  ctx.textAlign = "left";
}

// Clip + Karte als Video aufnehmen (Echtzeit: so lang wie der Satz). Fallback: PNG.
export async function karteAufnehmen(d, onFort) {
  const audio = await ladeClip(d.clipUrl);
  const cover = await ladeBild(d.coverSrc);
  const karte = { ...d, cover, dauer: audio.duration };
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  zeichneKarte(ctx, karte, 0);

  const typ = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"]
    .find((t) => window.MediaRecorder?.isTypeSupported?.(t));
  if (!typ) {
    const png = await new Promise((r) => canvas.toBlob(r, "image/png"));
    return { blob: png, ext: "png" };
  }

  const actx = new (window.AudioContext || window.webkitAudioContext)();
  const ziel = actx.createMediaStreamDestination();
  const quelle = actx.createBufferSource();
  quelle.buffer = audio;
  quelle.connect(ziel); quelle.connect(actx.destination);
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...ziel.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: typ, videoBitsPerSecond: 2500000 });
  const teile = [];
  rec.ondataavailable = (e) => { if (e.data.size) teile.push(e.data); };
  const gestoppt = new Promise((r) => { rec.onstop = r; });

  const ende = audio.duration + 0.8;          // kurze Stille am Ende
  const t0 = performance.now();
  let rahmen = null;
  const schritt = () => {
    const t = Math.min((performance.now() - t0) / 1000, ende);
    zeichneKarte(ctx, karte, Math.min(t, audio.duration));
    onFort?.(t / ende);
    if (t < ende) rahmen = requestAnimationFrame(schritt);
  };
  rec.start(250);
  quelle.start();
  schritt();
  setTimeout(() => rec.stop(), ende * 1000);
  await gestoppt;
  cancelAnimationFrame(rahmen);
  quelle.disconnect();
  actx.close();
  return { blob: new Blob(teile, { type: typ.split(";")[0] }), ext: typ.startsWith("video/mp4") ? "mp4" : "webm" };
}

export function speichern(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Muss aus einer Klick-Geste heraus laufen (Teilen-Blatt)
export async function teilen(datei, titel) {
  const name = `taella-zitat.${datei.ext}`;
  const file = new File([datei.blob], name, { type: datei.blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: SHARE_TEXT, title: titel });
      return "geteilt";
    } catch (e) {
      if (e?.name === "AbortError") return "abgebrochen";
    }
  }
  speichern(datei.blob, name);
  return "gespeichert";
}
