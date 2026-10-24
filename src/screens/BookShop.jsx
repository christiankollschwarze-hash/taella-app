import { useState, useEffect, useMemo } from "react";
import DotWord from "../design/DotWord.jsx";
import { IconHeart, IconEinstellungen, IconZurueck, IconHoeren, IconBook } from "../design/Icons.jsx";
import { loadKatalog, loadPrivat, coverOf, titelOf, hoerbar } from "../lib/katalog.js";
import { favs, toggleFav, settings, uiLang } from "../lib/settings.js";
import { getBookmark } from "../lib/bookmark.js";
import { statistik } from "../lib/lernspur.js";

// Book-Shop: „Entdecken“ (Genre-Regale, Kartenstapel, alle Titel), „Favoriten“ (♡) und „Begonnen“.
// Keine Preise in der App (Reader-App-Regel): Zugang über Konto auf taella.io.

const TXT = {
  de: {
    entdecken: "Entdecken", suche: "Titel oder Autor suchen", sucheLeer: "Nichts gefunden.", sucheWeg: "Suche löschen", favoriten: "Favoriten", begonnenTab: "Begonnen", alle: "Alle Titel", alleRegale: "Alle",
    kapitel: (n) => `${n} Kapitel`, woerter: (n) => `${Math.round(n / 1000)}k Wörter`, hoer: "Hörbuch",
    lesen: "Lesen", hoeren: "Hören", merken: "Merken", gemerkt: "Gemerkt", begonnen: "Begonnen",
    leerFav: "Noch keine Favoriten. Tippe bei einem Buch auf ♡.",
    leerBeg: "Noch nichts begonnen. Such dir unter „Entdecken“ ein Buch aus.",
    leerRegal: "In diesem Regal liegt noch nichts.",
    frei: "Kapitel 1 frei · ganzes Buch mit deinem Konto auf taella.io",
    lade: "Lade Bibliothek …", keine: "Noch keine Werke im Demo-Katalog.",
    zurueck: "Zurück", einstellungen: "Einstellungen",
    stand: "Dein Stand", stWoerter: "Wörter nachgeschlagen", stVersch: "verschiedene", stUpps: "Sätze per Upps",
    stKap: "Nachgeschlagen je Kapitel", stHint: "Weniger Balken nach hinten = du verstehst mehr.",
    regalTab: "Mein Regal", leerPrivat: "Noch keine eigenen Bücher. Lade ein ePub auf taella.io hoch.",
    privat: "Privat · nur für dich", eigenes: "Eigenes Buch",
  },
  en: {
    entdecken: "Discover", suche: "Search title or author", sucheLeer: "Nothing found.", sucheWeg: "Clear search", favoriten: "Favourites", begonnenTab: "Started", alle: "All titles", alleRegale: "All",
    kapitel: (n) => `${n} chapters`, woerter: (n) => `${Math.round(n / 1000)}k words`, hoer: "Audiobook",
    lesen: "Read", hoeren: "Listen", merken: "Save", gemerkt: "Saved", begonnen: "Started",
    leerFav: "No favourites yet. Tap ♡ on any book.",
    leerBeg: "Nothing started yet. Pick a book under “Discover”.",
    leerRegal: "Nothing on this shelf yet.",
    frei: "Chapter 1 free · full book with your account on taella.io",
    lade: "Loading library …", keine: "No titles in the demo catalogue yet.",
    zurueck: "Back", einstellungen: "Settings",
    stand: "Your progress", stWoerter: "words looked up", stVersch: "distinct", stUpps: "sentences via Upps",
    stKap: "Look-ups per chapter", stHint: "Shorter bars towards the end = you understand more.",
    regalTab: "My shelf", leerPrivat: "No books of your own yet. Upload an ePub on taella.io.",
    privat: "Private · only you", eigenes: "Own book",
  },
};

// Regale (Schlüssel kommen aus read_layer/tools/regal.py über katalog.json)
const REGALE = {
  roman:     { de: "Romane & Erzählungen", en: "Novels & Stories" },
  abenteuer: { de: "Abenteuer", en: "Adventure" },
  krimi:     { de: "Krimi & Spannung", en: "Crime & Suspense" },
  grusel:    { de: "Grusel & Schauer", en: "Horror & Gothic" },
  fantastik: { de: "Fantasy & Science-Fiction", en: "Fantasy & Sci-Fi" },
  maerchen:  { de: "Märchen & Kinder", en: "Fairy Tales & Children" },
  buehne:    { de: "Drama & Bühne", en: "Drama & Stage" },
  sachbuch:  { de: "Philosophie & Sachbuch", en: "Philosophy & Non-fiction" },
};
const regalOf = (w) => (REGALE[w.regal] ? w.regal : "roman");
const REGAL_KEY = "taella_regal";
const readRegal = () => { try { return localStorage.getItem(REGAL_KEY) || "alle"; } catch { return "alle"; } };
const saveRegal = (r) => { try { localStorage.setItem(REGAL_KEY, r); } catch {} };

// Suche: Groß/Klein, Akzente und Umlaute egal; alle Wörter müssen vorkommen (Titel EN/DE + Autor)
const norm = (s) => (s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const passt = (w, q) => {
  if (!q) return true;
  const heu = norm([titelOf(w, "de"), titelOf(w, "en"), w.autor].join(" "));
  return norm(q).split(/\s+/).filter(Boolean).every((t) => heu.includes(t));
};

function meta(w, t) {
  const p = [];
  if (w.kapitel) p.push(t.kapitel(w.kapitel));
  if (w.woerter) p.push(t.woerter(w.woerter));
  if (hoerbar(w)) p.push(t.hoer);
  return p.join(" · ");
}

function Cover({ w, lang, className }) {
  const src = coverOf(w, lang);
  return src
    ? <img className={className} src={src} alt="" loading="lazy" />
    : <div className={className + " cover-ph"}><span>{titelOf(w, lang)}</span></div>;
}

export default function BookShop({ onOpen, onSettings }) {
  const ui = uiLang();
  const t = TXT[ui];
  const [werke, setWerke] = useState(null);
  const [tab, setTab] = useState("entdecken");
  const [fav, setFav] = useState(() => favs());
  const [regal, setRegal] = useState(readRegal);
  const [detail, setDetail] = useState(null);
  const [suche, setSuche] = useState("");

  const [privat, setPrivat] = useState([]);
  useEffect(() => { loadKatalog().then(setWerke).catch(() => setWerke([])); }, []);
  useEffect(() => { loadPrivat().then(setPrivat).catch(() => setPrivat([])); }, []);
  const alleWerke = useMemo(() => [...privat, ...(werke || [])], [werke, privat]);

  // nur Regale anzeigen, in denen etwas liegt (mit Anzahl), feste Reihenfolge
  const regale = useMemo(() => {
    const n = {};
    (werke || []).forEach((w) => { const r = regalOf(w); n[r] = (n[r] || 0) + 1; });
    return Object.keys(REGALE).filter((r) => n[r]).map((r) => [r, n[r]]);
  }, [werke]);
  const aktivRegal = regal !== "alle" && regale.some(([r]) => r === regal) ? regal : "alle";
  const gefiltert = useMemo(
    () => (werke || []).filter((w) => (aktivRegal === "alle" || regalOf(w) === aktivRegal) && passt(w, suche)),
    [werke, aktivRegal, suche]
  );
  const favListe = useMemo(() => alleWerke.filter((w) => fav.includes(w.slug)), [alleWerke, fav]);
  const begonnen = useMemo(() => alleWerke.filter((w) => getBookmark(w.slug, "all")), [alleWerke]);

  const herz = (w) => setFav(toggleFav(w.slug));
  const waehle = (r) => { setRegal(r); saveRegal(r); };

  const zeilen = (liste, leer) => liste.length === 0 ? <p className="shop-leer">{leer}</p> : (
    <ul className="liste">
      {liste.map((w) => (
        <li key={w.slug} className="zeile-wrap">
          <button className="zeile" onClick={() => setDetail(w)}>
            <Cover w={w} lang={ui} className="zeile-cover" />
            <span className="zeile-text">
              <span className="zeile-titel">{titelOf(w, ui)}</span>
              <span className="zeile-autor">{w.autor}</span>
              <span className="zeile-meta">
                {[w.privat ? t.eigenes : REGALE[regalOf(w)][ui], meta(w, t), getBookmark(w.slug, "all") && t.begonnen].filter(Boolean).join(" · ")}
              </span>
            </span>
          </button>
          <button className="icon-btn zeile-herz" aria-label={fav.includes(w.slug) ? t.gemerkt : t.merken}
                  aria-pressed={fav.includes(w.slug)} onClick={() => herz(w)}>
            <IconHeart on={fav.includes(w.slug)} />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="shell shop">
      <header className="shop-top">
        <DotWord text="TÆLLA" className="wordmark" style={{ fontSize: 24 }} />
        <button className="icon-btn" aria-label={t.einstellungen} onClick={onSettings}><IconEinstellungen /></button>
      </header>

      <nav className="tabs" role="tablist">
        {["entdecken", "regalTab", "favoriten", "begonnenTab"].map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={"tab" + (tab === k ? " tab--on" : "")} onClick={() => setTab(k)}>
            {tab === k ? <DotWord text={t[k]} /> : t[k]}
          </button>
        ))}
      </nav>

      <div className="shop-body">
        {werke === null && <p className="shop-leer">{t.lade}</p>}
        {werke && werke.length === 0 && <p className="shop-leer">{t.keine}</p>}

        {werke && werke.length > 0 && tab === "entdecken" && (
          <>
            <div className="shop-suche">
              <input type="search" className="shop-suche-feld" value={suche} placeholder={t.suche} aria-label={t.suche}
                     onChange={(e) => setSuche(e.target.value)} />
              {suche && <button className="shop-suche-weg" aria-label={t.sucheWeg} onClick={() => setSuche("")}>×</button>}
            </div>
            {regale.length > 1 && (
              <div className="regale" role="radiogroup" aria-label="Genre">
                {[["alle", werke.length], ...regale].map(([r, n]) => (
                  <button key={r} role="radio" aria-checked={aktivRegal === r}
                          className={"regal" + (aktivRegal === r ? " regal--on" : "")} onClick={() => waehle(r)}>
                    {r === "alle" ? t.alleRegale : REGALE[r][ui]}<span className="regal-n">{n}</span>
                  </button>
                ))}
              </div>
            )}

            {gefiltert.length > 0 && (
              <div className="stack" role="list">
                {gefiltert.map((w) => (
                  <button key={w.slug} role="listitem" className="stack-card" onClick={() => setDetail(w)}>
                    <Cover w={w} lang={ui} className="stack-cover" />
                    <span className="stack-info">
                      <span className="stack-titel">{titelOf(w, ui)}</span>
                      <span className="stack-autor">{w.autor}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <h2 className="shop-h">{aktivRegal === "alle" ? t.alle : REGALE[aktivRegal][ui]}</h2>
            {zeilen(gefiltert, suche ? t.sucheLeer : t.leerRegal)}
          </>
        )}

        {tab === "regalTab" && zeilen(privat, t.leerPrivat)}
        {werke && tab === "favoriten" && zeilen(favListe, t.leerFav)}
        {werke && tab === "begonnenTab" && zeilen(begonnen, t.leerBeg)}
      </div>

      {detail && (
        <Detail w={detail} t={t} ui={ui} fav={fav.includes(detail.slug)}
                onHerz={() => herz(detail)} onClose={() => setDetail(null)}
                onOpen={(mode) => onOpen(detail, mode)} />
      )}
    </div>
  );
}

function Detail({ w, t, ui, fav, onHerz, onClose, onOpen }) {
  const [blurb, setBlurb] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`${w.base}/blurb.json`).then((r) => r.ok ? r.json() : null).then((b) => alive && setBlurb(b)).catch(() => {});
    return () => { alive = false; };
  }, [w.base]);

  const einordnung = (blurb?.einordnung || []).map((p) => p[ui] || p.en).join(" ");
  const koeder = (blurb?.koeder || []).map((p) => p[ui] || p.en).join(" ");

  return (
    <div className="detail" role="dialog" aria-label={titelOf(w, ui)}>
      <header className="detail-top">
        <button className="icon-btn" aria-label={t.zurueck} onClick={onClose}><IconZurueck /></button>
        <button className="icon-btn" aria-label={fav ? t.gemerkt : t.merken} aria-pressed={fav} onClick={onHerz}><IconHeart on={fav} /></button>
      </header>
      <div className="detail-body">
        <Cover w={w} lang={ui} className="detail-cover" />
        <h1 className="detail-titel">{titelOf(w, ui)}</h1>
        <p className="detail-autor">{w.autor}{w.erscheinungsjahr ? ` · ${w.erscheinungsjahr}` : ""}</p>
        <p className="detail-meta">{meta(w, t)}</p>
        {w.privat && <p className="detail-privat">{t.privat} · TÆLLA-User: {w.owner}</p>}
        {koeder && <blockquote className="detail-koeder">{koeder}</blockquote>}
        {einordnung && <p className="detail-text">{einordnung}</p>}
        <Stand slug={w.slug} kapitel={w.kapitel} t={t} />
        {!w.privat && !settings.konto() && <p className="detail-frei">{t.frei}</p>}
      </div>
      <footer className="detail-actions">
        <button className="btn btn--ink" onClick={() => onOpen("read")}><IconBook size={22} /><DotWord text={t.lesen} dotColor="var(--dot)" /></button>
        {hoerbar(w) && <button className="btn" onClick={() => onOpen("listen")}><IconHoeren size={22} />{t.hoeren}</button>}
      </footer>
    </div>
  );
}

// Kenntnisstand je Buch aus der Lernspur
function Stand({ slug, kapitel, t }) {
  const st = statistik(slug);
  if (!st.woerter && !st.upps) return null;
  const n = Math.max(kapitel || 0, ...Object.keys(st.proKapitel).map(Number));
  const werte = Array.from({ length: n }, (_, i) => st.proKapitel[i + 1] || { woerter: 0, upps: 0 });
  const max = Math.max(1, ...werte.map((v) => v.woerter + v.upps));
  return (
    <section className="stand">
      <h2 className="stand-h">{t.stand}</h2>
      <div className="stand-zahlen">
        <div><b>{st.woerter}</b><span>{t.stWoerter} ({st.verschieden} {t.stVersch})</span></div>
        <div><b>{st.upps}</b><span>{t.stUpps}</span></div>
      </div>
      {n > 1 && (
        <>
          <div className="stand-label">{t.stKap}</div>
          <div className="stand-balken" role="img" aria-label={t.stKap}>
            {werte.map((v, i) => (
              <div key={i} className="stand-spalte" title={`${i + 1}: ${v.woerter} / ${v.upps}`}>
                <div className="stand-bar" style={{ height: `${((v.woerter + v.upps) / max) * 100}%` }} />
                <span>{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="stand-hint">{t.stHint}</p>
        </>
      )}
    </section>
  );
}
