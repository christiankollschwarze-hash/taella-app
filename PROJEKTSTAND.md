# PROJEKTSTAND — TÆLLA App (Stand 2026-10-09, 23:45)

Ausführlich: Projekt-Docs `claude/STAND_2026-10-09.md` und `claude/DESIGN_entscheidungen.md`.
Design-Entwürfe: Design-Fläche „TÆLLA Gestaltung“ (Reihe D = gewählte Richtung).

## Funktioniert
- Reader: Paginierung, Kapitel-Sheet (Titel jetzt sprachabhängig EN/DE), Sprachwechsel mit Erhalt der Position,
  Flyover EN↔DE, Dark Mode, Titelei (Cover + Klappentext in Muttersprache)
- Lesezeichen = Lesefortschritt (wandert beim Umblättern, Doppel-Tipp setzt gezielt, App öffnet dort)
- Audio-Ansicht (ListenView + useListen): Cover, Untertitel 3-stufig, Fortschrittsbalken (nur Anzeige),
  Satz/Wort vor/zurück, Sprachwechsel, Media Session, Lesezeichen satzgenau
- Pipeline: export_app.py (Cover, blurb.json, wordtimes_<lang>.json), Stage 58c für DE erweitert + Aligner-Bug behoben

## Design D eingebaut (2026-10-09 spät)
- `src/design/Icons.jsx` (Icon-Set, roter Punkt auf dem Strichende), `src/design/DotWord.jsx` (Punkt auf letzter Glyphe, gemessen)
- `App.css` komplett neu: Tokens (Schwarz/Weiß, Rot nur Punkt), Nacht = Weiß auf Schwarz; Fonts per Google Fonts in `index.html`
- Reader: Bedienung ausgeblendet; Tipp auf freie Fläche oder Fußzeile = Menü; Ränder (15 %) und Wischen = blättern;
  Fußzeile = Haarlinie mit rotem Punkt; Lesezeichen = schwarze Lasche mit Punkt; Kapitel-Sheet neu
- Audio: Typo-Bühne mit Karaoke-Punkt unter dem gesprochenen Wort, ohne Untertitel großes Cover; Wellen-Zeitleiste mit Punkt; schwarzes Dock
- Upps im Hören: Tipp auf die Bühne (Desktop: Leertaste) → nach dem Satz derselbe Satz in der anderen Sprache, dann weiter;
  in der Pause danach sofort; zweiter Tipp nimmt es zurück; Chip „Upps“ zeigt den Zustand; Lesezeichen bleibt stehen.
  Play/Pause am Rechner jetzt Enter oder K.
- Sprachübergreifendes Karaoke: CC in der anderen Sprache markiert über die 54a-Wortanker (en_span ↔ de_span)
  das gerade gehörte Wort im Untertitel; Markierung springt mit dem Satzbau. 54a-Fehlanker werden dabei sichtbar.
- Backup vor dem Umbau: `_bak_20261009_design/`
- Wortzeiten komplett exportiert: wordtimes_de.json (1637 Sätze), wordtimes_en.json (1629 Sätze, 99,99 % der Wörter)

## Läuft gerade (Christian)
- (erledigt) Stage 58c DE + EN fertig und exportiert

## Nächstes Arbeitspaket (neue Sitzung)
1. ✓ erledigt (Feinschliff offen: Fonts lokal bündeln, Punktlagen an echten Fonts prüfen) — Design D als Regelwerk: Tokens (Farben, Schriften, Abstände), Icon-Set als SVG mit rotem Punkt AUF dem Strichende,
   Wortmarke TÆLLA als SVG (Punkt exakt auf dem Fuß des letzten A)
2. ✓ erledigt — Reader und Audio-Ansicht auf Design D umbauen (Oberfläche Instrument Sans, Inhalt Serifen, Rot nur als Punkt)
3. Neue Seiten: Bibliothek (Kartenstapel, Detail mit ♡ / Lesen / Hören), „Meine Bücher“ (Favoriten + Fortschritt),
   Freigabe nur Kapitel 1 ohne Konto (Hinweis auf taella.io, ohne Preise — Reader-App-Regel Apple)
4. Danach: Capacitor-Verpackung, Android-Test, iOS über MacBook
5. Read Layer (eigenes Paket): Proof EPUB 3 mit Media Overlays für Call of the Wild → Verlags-Angebot BFSG
   (siehe Projekt-Doc `BOARD_bfsg-media-overlays.md`); EPUB-Reader-Idee: `IDEE_epub-reader-pull-effekt.md`

## Module angelegt (2026-10-10)
- `src/Shell.jsx` = neuer Rahmen (main.jsx rendert Shell): Einführung -> Book-Shop -> Reader/Hören; Einstellungen als Ebene darüber.
- `screens/Onboarding.jsx`: 4 Schritte (Wortmarke, Muttersprache, Upps-Satz zum Antippen, "Kein Konto, keine Karte, Kapitel 1 frei").
- `screens/BookShop.jsx`: Entdecken (Kartenstapel + alle Titel) / Meine Bücher (♡ + begonnen); Detail mit Klappentext, ♡, Lesen/Hören. Keine Preise.
- `screens/Settings.jsx`: Muttersprache, Hör-Startsprache, Nachtmodus, Schriftgröße, Konto-Hinweis + Demo-Schalter "Vollzugang", Fortschritt zurücksetzen, Einführung erneut.
- Reader: lädt je Werk aus `base` (Wurzel oder /demo/<slug>), Zurück zur Bibliothek + Einstellungen im Menü,
  Kapitel-1-Sperre (Hinweis auf taella.io) ohne Konto. Hören ist noch NICHT gesperrt.
- Neu: `lib/settings.js`, `lib/katalog.js`; loader.js mit base + coverSrc. Backup: `_bak_20261010_module_src/`.
- Offen: Hören-Sperre ab Kapitel 2, Fortschritt in % für "Meine Bücher", Suche/Filter im Shop, Fonts lokal.

## Demo-Katalog (2026-10-10)
- Read-Layer-Cockpit legt fertige Werke nach `public/demo/<slug>/` (manifest_en/de.json, blurb.json, cover_*, wordtimes_*)
  und pflegt `public/demo/katalog.json` (slug, titel en/de, autor, cover, kapitel, woerter, audio_vorhanden, pfad).
- Fuer die Bibliothek-Seite: loader.js braucht BASE je Werk (`/demo/<slug>`); Audio-Pfade im Demo-Manifest relativ
  (`audio/<lang>/<tag>.wav`), nur wenn mit --audio exportiert.

## Entscheidungen
- Muttersprache = Startsprache für Cover/Klappentext/Hören (änderbar)
- Konto erst beim Weiterlesen nach Kapitel 1; Konto + Zahlung auf taella.io (Stripe), keine In-App-Käufe
- Fortschrittsbalken nicht bedienbar; Navigation über Spultasten und Kapitel

## 10.10.2026 abends — Book-Shop: Genre-Regale + Favoriten
- Tabs: Entdecken (Regal-Chips mit Anzahl, Auswahl gemerkt) / Favoriten / Begonnen; Herz direkt in jeder Listenzeile.
- Regal kommt aus katalog.json (Feld regal), erzeugt von read_layer/tools/regal.py (aus Stage-20-Genre); export_demo.py setzt es automatisch.
- Backup: _bak_20261010_regal/
- Zurueck zur Bibliothek: Pfeil + TÆLLA oben links in der Bedienleiste (Reader) und Pfeil im Hoer-Kopf (ListenView). Backup _bak_20261010_home/
