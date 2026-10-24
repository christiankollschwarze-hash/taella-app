// Kuratormodus (Demo/Testumgebung): Anmerkungen zu Saetzen -> read_layer work/kuration.jsonl
// ueber den lokalen Dev-Server (vite.config.js). Ohne Server: Fallback im Browser.
const LOKAL = "taella_kuration_lokal";

export const KATEGORIEN = [
  ["sprecher", "Sprecher falsch", "Wrong speaker"],
  ["aussprache", "Aussprache", "Pronunciation"],
  ["uebersetzung", "Übersetzung", "Translation"],
  ["text", "Text / Modernisierung", "Text / modernisation"],
  ["audio", "Audio (Betonung, Störung)", "Audio (stress, glitch)"],
  ["wortzeit", "Wortzeit / Hervorhebung", "Word timing"],
  ["sonstiges", "Sonstiges", "Other"],
];

export async function laden(slug) {
  try {
    const r = await fetch(`/api/kuration?slug=${encodeURIComponent(slug)}`);
    if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
      // Offline gespeicherte Anmerkungen nachreichen (z. B. private Werke vor dem 17.10.2026)
      const offen = lokal().filter((e) => e.slug === slug);
      if (offen.length) {
        for (const e of offen) {
          const { id, zeit, status, ...rest } = e;
          await fetch("/api/kuration", { method: "POST", headers: { "Content-Type": "application/json" },
                                         body: JSON.stringify({ ...rest, zeit_offline: zeit }) }).catch(() => {});
        }
        try { localStorage.setItem(LOKAL, JSON.stringify(lokal().filter((e) => e.slug !== slug))); } catch {}
        const r2 = await fetch(`/api/kuration?slug=${encodeURIComponent(slug)}`);
        if (r2.ok) return await r2.json();
      }
      return await r.json();
    }
  } catch {}
  return { liste: lokal().filter((e) => e.slug === slug), unsicher: [], offline: true };
}

export async function speichern(eintrag) {
  try {
    const r = await fetch("/api/kuration", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eintrag),
    });
    if (r.ok) return { ok: true, eintrag: await r.json() };
  } catch {}
  const e = { ...eintrag, id: Date.now().toString(36), zeit: new Date().toISOString(), status: "offen" };
  try { localStorage.setItem(LOKAL, JSON.stringify([...lokal(), e])); } catch {}
  return { ok: true, eintrag: e, offline: true };
}

function lokal() {
  try { return JSON.parse(localStorage.getItem(LOKAL) || "[]"); } catch { return []; }
}
