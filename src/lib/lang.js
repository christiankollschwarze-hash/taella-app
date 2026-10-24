// Muttersprache des Nutzers: später aus dem Onboarding (localStorage "taella_native"),
// bis dahin aus den Geräte-Einstellungen. Fallback: en.
export function getNativeLang(supported = ["en", "de"]) {
  try {
    const saved = localStorage.getItem("taella_native");
    if (saved && supported.includes(saved)) return saved;
  } catch {}
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || "en"];
  for (const l of langs) {
    const p = (l || "").slice(0, 2).toLowerCase();
    if (supported.includes(p)) return p;
  }
  return "en";
}
