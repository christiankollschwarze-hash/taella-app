// Lesezeichen-Helfer — speichert tag_id pro Werk+Sprache im localStorage.

function _key(slug, lang) {
  return `taella_bookmark_${slug}_${lang}`;
}

export function getBookmark(slug, lang) {
  try { return localStorage.getItem(_key(slug, lang)) || null; }
  catch { return null; }
}

export function setBookmark(slug, lang, tagId) {
  try { localStorage.setItem(_key(slug, lang), tagId); }
  catch { /* storage nicht verfügbar */ }
}

export function clearBookmark(slug, lang) {
  try { localStorage.removeItem(_key(slug, lang)); }
  catch { /* storage nicht verfügbar */ }
}
