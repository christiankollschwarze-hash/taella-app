// Minimaler ZIP-Leser für EPUB (lokal im Browser, ohne Upload).
// Liest das Zentralverzeichnis; Einträge „stored“ (0) werden als Blob-Ausschnitt gereicht,
// „deflate“ (8) über die native DecompressionStream("deflate-raw").

function u16(v, o) { return v.getUint16(o, true); }
function u32(v, o) { return v.getUint32(o, true); }

export async function openZip(source) {
  let blob;
  if (source instanceof Blob) blob = source;
  else {
    const r = await fetch(source);
    if (!r.ok) throw new Error(`EPUB nicht gefunden: ${source}`);
    blob = await r.blob();
  }
  const size = blob.size;
  // Ende des Zentralverzeichnisses (EOCD) in den letzten 64 KB suchen
  const tailLen = Math.min(size, 65557);
  const tail = new DataView(await blob.slice(size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Keine gültige EPUB-/ZIP-Datei");
  const count = u16(tail, eocd + 10);
  const cdSize = u32(tail, eocd + 12);
  const cdOff = u32(tail, eocd + 16);
  const cd = new DataView(await blob.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  const entries = new Map();
  let p = 0;
  for (let n = 0; n < count && u32(cd, p) === 0x02014b50; n++) {
    const method = u16(cd, p + 10);
    const compSize = u32(cd, p + 20);
    const nameLen = u16(cd, p + 28), extraLen = u16(cd, p + 30), commLen = u16(cd, p + 32);
    const local = u32(cd, p + 42);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    entries.set(name, { method, compSize, local });
    p += 46 + nameLen + extraLen + commLen;
  }

  async function data(e) {
    const h = new DataView(await blob.slice(e.local, e.local + 30).arrayBuffer());
    const start = e.local + 30 + u16(h, 26) + u16(h, 28);
    const raw = blob.slice(start, start + e.compSize);
    if (e.method === 0) return raw;
    if (e.method === 8) return new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
    throw new Error(`ZIP-Methode ${e.method} nicht unterstützt`);
  }

  return {
    has: (name) => entries.has(name),
    async blob(name, type = "") {
      const e = entries.get(name);
      if (!e) return null;
      const b = await data(e);
      return type ? new Blob([b], { type }) : b;
    },
    async text(name) {
      const e = entries.get(name);
      return e ? (await data(e)).text() : null;
    },
  };
}
