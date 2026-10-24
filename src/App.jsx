import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { loadWork } from "./lib/loader.js";
import Page from "./components/Page.jsx";
import ChapterSheet from "./components/ChapterSheet.jsx";
import UppsOverlay from "./components/UppsOverlay.jsx";
import { CoverPage, BlurbPage } from "./components/Titelei.jsx";
import { getNativeLang } from "./lib/lang.js";
import { getBookmark, setBookmark } from "./lib/bookmark.js";
import { BookmarkRibbon, BookmarkToast } from "./components/BookmarkTab.jsx";
import ListenView from "./components/ListenView.jsx";
import KuratorSheet from "./components/KuratorSheet.jsx";
import { laden as kurLaden } from "./lib/kuration.js";
import DotWord from "./design/DotWord.jsx";
import { IconMenu, IconHoeren, IconMond, IconSonne, IconZurueck, IconEinstellungen } from "./design/Icons.jsx";
import { settings } from "./lib/settings.js";
import { setLernWerk } from "./lib/lernspur.js";

const TAP_DELAY_MS = 260;   // Einfach-Tipp kurz zurückhalten: könnte der Beginn eines Doppel-Tipps sein
const SWIPE_PX = 50;

const MODE_KEY = "taella_mode";            // "read" | "listen" — zuletzt genutzte Ansicht
const DEFAULT_LANG_KEY = "taella_default_lang"; // in der App änderbare Startsprache fürs Hören
import "./App.css";

// Dynamische Paginierung: misst die verfügbare Höhe und packt so viele Nodes
// rein wie passen, ohne zu scrollen.
function buildPages(nodes, availableHeight, measurer) {
  if (!measurer || availableHeight <= 0) return [nodes]; // Fallback

  const pages = [];
  let remaining = [...nodes];

  while (remaining.length > 0) {
    // Exponentielle Suche nach oben (Kosten ~ Seitengröße statt Buchlänge)
    let k = 1;
    while (k < remaining.length && measureFits(remaining.slice(0, k * 2), availableHeight, measurer)) k *= 2;
    k = Math.min(k, remaining.length);
    let lo = k + 1;
    let hi = Math.min(remaining.length, k * 2) - 1;
    let best = k;

    // Zuerst h-Nodes am Anfang immer mitnehmen (starten keine neue Seite wenn bereits eine läuft)
    // Eine neue Seite beginnt immer mit einem h-Node wenn vorhanden
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const slice = remaining.slice(0, mid);
      const fits = measureFits(slice, availableHeight, measurer);
      if (fits) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    pages.push(remaining.slice(0, best));
    remaining = remaining.slice(best);

    // Wenn der nächste Node ein h-Node ist, bleibt er vorne (neue Seite)
  }
  return pages;
}

function measureFits(nodes, availableHeight, measurer) {
  // Render-Höhe im unsichtbaren Messcontainer prüfen
  return measurer(nodes) <= availableHeight;
}

// Seiten-Index für einen tag_id finden
function pageOfTag(pages, tagId) {
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].some((n) => n.tag_id === tagId)) return i;
  }
  return 0;
}

export default function App({ base = "", cover = null, onBack = null, onSettings = null, privat = false }) {
  const [work, setWork] = useState(null);
  const [err, setErr] = useState(null);
  // Startet die App direkt im Hören: Standardsprache (Einstellung, sonst Muttersprache)
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) === "listen" ? "listen" : "read"; } catch { return "read"; }
  });
  const [lang, setLang] = useState(() => {
    if (mode !== "listen") return "en";
    try { const d = localStorage.getItem(DEFAULT_LANG_KEY); if (d === "en" || d === "de") return d; } catch {}
    return getNativeLang();
  });
  const [listenAutoplay, setListenAutoplay] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [active, setActive] = useState(null);
  const [showChapters, setShowChapters] = useState(false);
  const [textPages, setTextPages] = useState([]);
  const [nativeLang] = useState(() => getNativeLang());
  const [bookmark, setBm] = useState(null);       // tag_id, sprachunabhängig
  const [bmFresh, setBmFresh] = useState(false);  // Lasche gerade neu gesetzt → Einfahr-Animation
  const [toast, setToast] = useState(null);       // { kind: "set"|"removed", stamp }
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("taella_dark") === "1"; } catch { return false; }
  });

  const [chrome, setChrome] = useState(false);       // Bedienleisten sichtbar?
  const [hintSeen, setHintSeen] = useState(() => {
    try { return localStorage.getItem("taella_chrome_seen") === "1"; } catch { return false; }
  });
  const tapTimer = useRef(null);
  const swipe = useRef(null);
  const ignoreClickUntil = useRef(0);
  // Kuratormodus: langes Druecken auf einen Satz -> Anmerkung
  const kurator = settings.kurator();
  const [kurTag, setKurTag] = useState(null);
  const [kurDaten, setKurDaten] = useState({ liste: [], unsicher: [] });
  const langDruck = useRef(null);

  const pageWrapRef = useRef(null);
  const measureRef = useRef(null); // unsichtbarer Messcontainer

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    try { localStorage.setItem("taella_dark", darkMode ? "1" : "0"); } catch {}
  }, [darkMode]);

  useEffect(() => {
    loadWork(base, { cover })
      .then((w) => {
        setLernWerk(w.meta.slug);
        const bm = getBookmark(w.meta.slug, "all");
        // Lesezeichen = Lesefortschritt wie im physischen Buch → beim Öffnen dorthin
        if (bm) { setBm(bm); anchorRef.current = bm; startAtAnchor.current = true; }
        setWork(w);
      })
      .catch((e) => setErr(e.message));
  }, [base, cover]);

  // Doppel-Tipp: Lesezeichen gezielt auf diesen Satz legen (sichtbar mit Lasche + Hinweis)
  const placeBookmark = useCallback((tagId) => {
    if (!work) return;
    clearTimeout(tapTimer.current);   // der erste Tipp des Doppel-Tipps soll nicht blättern
    setBookmark(work.meta.slug, "all", tagId);
    setBm(tagId);
    setBmFresh(true);
    setToast({ kind: "set", stamp: Date.now() });
  }, [work]);

  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch {} }, [mode]);

  // Hören: Lesezeichen satzgenau mitführen (ohne Lasche/Hinweis)
  const onListenSentence = useCallback((tagId) => {
    if (!work) return;
    setBookmark(work.meta.slug, "all", tagId);
    setBm(tagId);
  }, [work]);

  const toListen = useCallback(() => {
    setActive(null);
    setListenAutoplay(true);
    setMode("listen");
  }, []);

  // Zurück zum Reader: Seite mit dem Lesezeichen-Satz (Lesezeichen bleibt satzgenau)
  const toReader = useCallback(() => {
    if (work && bookmark) {
      anchorRef.current = bookmark;
      setPageIdx(frontCount(work) + pageOfTag(textPages, bookmark));
    }
    setMode("read");
  }, [work, bookmark, textPages]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => { setToast(null); setBmFresh(false); }, 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // Lesposition (erster tag_id der aktuellen Textseite) über Neu-Paginierung hinweg halten
  const anchorRef = useRef(null);
  const startAtAnchor = useRef(false); // beim Öffnen direkt zum Lesezeichen

  // Paginierung: einmal beim Mount (ResizeObserver feuert initial) und bei Größen-/Sprachwechsel
  useEffect(() => {
    if (!work || !pageWrapRef.current || !measureRef.current) return;
    let raf = 0;
    const repaginate = () => {
      const availableHeight = pageWrapRef.current?.clientHeight || 0;
      const measureEl = measureRef.current;
      if (!measureEl || availableHeight <= 0) return;
      measureEl.style.width = pageWrapRef.current.clientWidth + "px";
      const measurer = (nodes) => {
        measureEl.innerHTML = renderToMeasure(nodes, lang);
        return measureEl.scrollHeight;
      };
      const newPages = buildPages(work.nodes, availableHeight, measurer);
      measureEl.innerHTML = "";
      setTextPages(newPages);
      const front = frontCount(work);
      const tag = anchorRef.current;
      if (startAtAnchor.current && tag) {
        startAtAnchor.current = false;
        setPageIdx(front + pageOfTag(newPages, tag));
      } else {
        setPageIdx((i) => (i < front || !tag) ? i : front + pageOfTag(newPages, tag));
      }
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(repaginate);
    });
    ro.observe(pageWrapRef.current);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [work, lang]);

  // Titelei (Cover, Klappentext) als Pseudo-Seiten vor dem Text
  const pages = useMemo(() => {
    if (!work) return textPages;
    const front = [];
    if (work.blurb) {
      front.push([{ typ: "cover" }]);
      front.push([{ typ: "blurb" }]);
    }
    return [...front, ...textPages];
  }, [work, textPages]);

  // Navigation durch den Nutzer setzt die Leseposition (nicht die Neu-Paginierung → kein Drift)
  const goTo = useCallback((idx) => {
    const i = Math.max(0, Math.min(pages.length - 1, idx));
    const first = pages[i]?.find((n) => n.tag_id);
    anchorRef.current = first ? first.tag_id : null;
    // Umblättern: Lesezeichen wandert still auf den ersten Satz der neuen Seite
    if (first && work) { setBookmark(work.meta.slug, "all", first.tag_id); setBm(first.tag_id); setBmFresh(false); }
    setPageIdx(i);
    setChrome(false);
  }, [pages, work]);

  const toggleChrome = useCallback(() => {
    setChrome((c) => !c);
    if (!hintSeen) { setHintSeen(true); try { localStorage.setItem("taella_chrome_seen", "1"); } catch {} }
  }, [hintSeen]);

  // Tippzonen: schmale Ränder blättern (haben Vorrang vor Phrasen, wie bei E-Readern),
  // Tipp auf freie Fläche in der Mitte blendet die Bedienung ein/aus. Phrasen behalten den Flyover.
  const onPageClickCapture = useCallback((e) => {
    if (Date.now() < ignoreClickUntil.current) { e.stopPropagation(); return; }
    // 17.10.2026: keine Blätter-Tippzonen mehr (Wörter am Rand wurden als Umblättern gelesen).
    // Blättern: sichtbare Pfeile in der Fußzeile, Wischen, Tasten ← / →.
  }, []);
  const onPageClick = useCallback(() => {
    setActive(null);
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(toggleChrome, TAP_DELAY_MS);
  }, [toggleChrome]);

  // Wischen: links = vor, rechts = zurück
  const onPointerDown = useCallback((e) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    clearTimeout(langDruck.current);
    const el = kurator && e.target.closest ? e.target.closest("[data-tag]") : null;
    if (el) langDruck.current = setTimeout(() => {
      ignoreClickUntil.current = Date.now() + 700;
      window.getSelection?.()?.removeAllRanges();
      setKurTag(el.dataset.tag);
    }, 550);
  }, [kurator]);
  const onPointerUp = useCallback((e) => {
    clearTimeout(langDruck.current);
    const s0 = swipe.current; swipe.current = null;
    if (!s0) return;
    const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dy) < 60) {
      ignoreClickUntil.current = Date.now() + 400;
      clearTimeout(tapTimer.current);
      goTo(pageIdx + (dx < 0 ? 1 : -1));
    }
  }, [goTo, pageIdx]);

  // Tastatur (Desktop): ← / → blättern, nur im Lesemodus
  useEffect(() => {
    if (mode !== "read" || showChapters) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") goTo(pageIdx + 1);
      else if (e.key === "ArrowLeft") goTo(pageIdx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, showChapters, goTo, pageIdx]);

  const currentKapitel = useMemo(() => {
    if (!pages[pageIdx]) return null;
    const hNode = [...pages[pageIdx]].reverse().find((n) => n.typ === "h" || n.kapitel);
    return hNode?.kapitel || null;
  }, [pages, pageIdx]);

  const currentKapitelTagId = useMemo(() => {
    if (!work) return null;
    const kap = work.kapitel.find((k) => k.titel === currentKapitel);
    return kap?.tag_id || null;
  }, [work, currentKapitel]);

  const jumpToTag = useCallback((tagId) => {
    goTo(pageOfTag(pages, tagId));
    setActive(null);
  }, [pages, goTo]);

  // Kuratormodus: vorhandene Anmerkungen und unsichere Sprecher laden, Saetze markieren
  useEffect(() => {
    if (!kurator || !work?.meta?.slug) return;
    kurLaden(work.meta.slug).then(setKurDaten);
  }, [kurator, work]);
  useEffect(() => {
    if (!kurator) return;
    const notiert = new Set(kurDaten.liste.filter((e) => e.status !== "erledigt").map((e) => e.tag_id));
    const unsicher = new Set(kurDaten.unsicher);
    document.querySelectorAll(".page-wrap:not(.page-measure) [data-tag]").forEach((el) => {
      el.classList.toggle("satz--notiz", notiert.has(el.dataset.tag));
      el.classList.toggle("satz--unsicher", unsicher.has(el.dataset.tag));
    });
  });

  const switchLang = useCallback(() => {
    setLang((l) => l === "en" ? "de" : "en");
    setActive(null);
  }, []);

  if (err) return <div className="hinweis hinweis--fehler"><strong>Fehler: </strong>{err}</div>;
  if (!work) return <div className="hinweis">Lade …</div>;

  const currentNodes = pages[pageIdx] || [];
  const progress = pages.length > 1 ? pageIdx / (pages.length - 1) : 0;
  const kapitelTitel = (() => {
    const k = work.kapitel.find((x) => x.tag_id === currentKapitelTagId);
    return k ? (lang === "de" ? k.titel_de : k.titel) : work.meta.titel;
  })();
  const otherLang = lang === "en" ? "DE" : "EN";
  // Ohne Konto ist Kapitel 1 frei (Reader-App-Regel: kein Kauf in der App, nur Hinweis auf taella.io)
  const kapIdx = work.kapitel.findIndex((k) => k.tag_id === currentKapitelTagId);
  const kap2Idx = work.kapitel[1] ? work.nodes.findIndex((n) => n.tag_id === work.kapitel[1].tag_id) : -1;
  const seitenIdx = Math.max(-1, ...currentNodes.map((n) => work.nodes.findIndex((m) => m.tag_id === n.tag_id)));
  // Eigene Uploads (privates Regal) sind nie gesperrt
  const gesperrt = !privat && !settings.konto() && (kapIdx >= 1 || (kap2Idx >= 0 && seitenIdx >= kap2Idx));
  const de = nativeLang === "de";

  return (
    <div className="app" onClick={() => setActive(null)}>
      {/* Unsichtbarer Messcontainer – gleiche Klassen wie die echte Seite */}
      <div ref={measureRef} className="page-wrap page-measure" aria-hidden="true" />

      <main className="page-wrap" ref={pageWrapRef}
            onClickCapture={onPageClickCapture} onClick={onPageClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        {currentNodes[0]?.typ === "cover" ? (
          <CoverPage src={work.coverSrc(nativeLang)} titel={work.meta.titel} autor={work.meta.autor} />
        ) : currentNodes[0]?.typ === "blurb" ? (
          <BlurbPage blurb={work.blurb} lang={nativeLang} activeBid={active?.key} setActive={setActive} />
        ) : (
          <Page
            nodes={currentNodes}
            lang={lang}
            activeBid={active?.key}
            playingId={null}
            setActive={setActive}
            registerRef={null}
            bookmarkedId={bmFresh ? bookmark : null}
            onBookmark={placeBookmark}
          />
        )}
        {bookmark && currentNodes.some((n) => n.tag_id === bookmark) && (
          <BookmarkRibbon key={bookmark} fresh={bmFresh} />
        )}
        {gesperrt && (
          <div className="paywall" onClick={(e) => e.stopPropagation()}>
            <DotWord text="TÆLLA" className="wordmark" style={{ fontSize: 26 }} />
            <p className="paywall-titel">{de ? "Kapitel 1 war frei." : "Chapter 1 was free."}</p>
            <p className="paywall-text">{de
              ? "Weiterlesen und -hören mit deinem TÆLLA-Konto. Konto und Zugang richtest du auf taella.io ein."
              : "Keep reading and listening with your TÆLLA account. Set it up on taella.io."}</p>
            <div className="paywall-actions">
              <button className="btn btn--ink" onClick={() => goTo(pageOfTag(pages, work.kapitel[1].tag_id) - 1)}>{de ? "Zurück zu Kapitel 1" : "Back to chapter 1"}</button>
              {onBack && <button className="btn" onClick={onBack}>{de ? "Bibliothek" : "Library"}</button>}
            </div>
          </div>
        )}
        {active && (
          <UppsOverlay anchor={active.el} text={active.text} onClose={() => setActive(null)} />
        )}
      </main>

      <footer className="read-foot" aria-label="Lesefortschritt" onClick={(e) => { e.stopPropagation(); toggleChrome(); }}>
        <button className="page-arrow" aria-label={nativeLang === "de" ? "Zurück blättern" : "Previous page"}
                disabled={pageIdx <= 0} onClick={(e) => { e.stopPropagation(); setActive(null); goTo(pageIdx - 1); }}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="read-progress">
          <div className="read-progress-done" style={{ width: `${progress * 100}%` }} />
          <div className="read-progress-dot" style={{ left: `${progress * 100}%` }} />
        </div>
        {!hintSeen && <span className="read-hint">{nativeLang === "de" ? "Tippen für Menü" : "Tap for menu"}</span>}
        <button className="page-arrow" aria-label={nativeLang === "de" ? "Weiter blättern" : "Next page"}
                disabled={pageIdx >= pages.length - 1} onClick={(e) => { e.stopPropagation(); setActive(null); goTo(pageIdx + 1); }}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </footer>

      <BookmarkToast key={toast?.stamp || 0} kind={toast?.kind} uiLang={nativeLang} />

      <div className={"chrome-top" + (chrome ? "" : " chrome--hidden")} onClick={(e) => e.stopPropagation()}>
        {onBack ? (
          <button className="chrome-home" onClick={onBack} aria-label={de ? "Zur Bibliothek" : "To library"}>
            <IconZurueck /><DotWord text="TÆLLA" className="wordmark" style={{ fontSize: 22 }} />
          </button>
        ) : <DotWord text="TÆLLA" className="wordmark" style={{ fontSize: 22 }} />}
        <span className="chrome-kapitel">{kapitelTitel}</span>
      </div>
      <nav className={"chrome-bottom" + (chrome ? "" : " chrome--hidden")} onClick={(e) => e.stopPropagation()}>
        {onBack && <button className="icon-btn" aria-label={nativeLang === "de" ? "Bibliothek" : "Library"} onClick={onBack}><IconZurueck /></button>}
        <button className="icon-btn" aria-label={lang === "de" ? "Kapitel" : "Chapters"} onClick={() => { setShowChapters(true); setChrome(false); }}><IconMenu /></button>
        <button className="icon-btn" aria-label="Hören" onClick={() => { setChrome(false); toListen(); }}><IconHoeren /></button>
        <button className="icon-btn lang-btn" aria-label="Sprache wechseln" onClick={switchLang}><DotWord text={otherLang} /></button>
        <button className="icon-btn" aria-label={darkMode ? "Tagmodus" : "Nachtmodus"} onClick={() => setDarkMode((d) => !d)}>{darkMode ? <IconSonne /> : <IconMond />}</button>
        {onSettings && <button className="icon-btn" aria-label={nativeLang === "de" ? "Einstellungen" : "Settings"} onClick={() => { setChrome(false); onSettings(); }}><IconEinstellungen /></button>}
      </nav>

      {mode === "listen" && (
        <ListenView
          work={work}
          lang={lang}
          nativeLang={nativeLang}
          onLangSwitch={switchLang}
          startTag={bookmark}
          autoplay={listenAutoplay}
          onSentenceStart={onListenSentence}
          onToReader={toReader}
          onBack={onBack}
        />
      )}

      {kurTag && (
        <KuratorSheet work={work} node={work.nodes.find((n) => n.tag_id === kurTag)} lang={lang} uiDe={de}
                      modus="lesen" onClose={() => setKurTag(null)}
                      onSaved={(e) => setKurDaten((d) => ({ ...d, liste: [...d.liste, e] }))} />
      )}

      {showChapters && (
        <ChapterSheet
          kapitel={work.kapitel}
          currentKapitel={currentKapitelTagId}
          onJump={jumpToTag}
          lang={lang}
          onClose={() => setShowChapters(false)}
        />
      )}
    </div>
  );
}

function frontCount(work) {
  return work?.blurb ? 2 : 0;
}

// Einfaches HTML-Rendering für die Messung (kein React nötig)
function renderToMeasure(nodes, lang) {
  let html = '<div class="page">';
  let inPara = false;
  const flushPara = () => { if (inPara) { html += "</p>"; inPara = false; } };
  for (const n of nodes) {
    if (n.typ === "h") {
      flushPara();
      html += `<div class="kapitel-titel">${esc(n[lang]?.text || n.en?.text || "")}</div>`;
    } else if (n.typ === "p") {
      flushPara();
    } else {
      if (!inPara) { html += '<p class="absatz">'; inPara = true; }
      html += `<span class="satz${n.typ === "dl" ? " satz--dl" : ""}">${esc(n[lang]?.text || "")} </span>`;
    }
  }
  flushPara();
  return html + "</div>";
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
