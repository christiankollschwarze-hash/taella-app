// AP 56 (26.10.2026): Hörzustand für den Lesemodus. ListenView (unsichtbar weiterlaufend) meldet je Tick
// { tag, lang, time, duration, hs, wt, quelle }; Satz.jsx abonniert nur den eigenen Satz (andere rendern nicht neu).
import { useSyncExternalStore } from "react";

let zustand = null;
const hoerer = new Set();

export function setHoerzustand(z) {
  zustand = z;
  hoerer.forEach((f) => f());
}

function abonnieren(f) { hoerer.add(f); return () => hoerer.delete(f); }

// null, solange dieser Satz nicht gehört wird
export function useHoerSatz(tag) {
  return useSyncExternalStore(abonnieren, () => (zustand && zustand.tag === tag ? zustand : null));
}

export function useHoerTag() {
  return useSyncExternalStore(abonnieren, () => zustand?.tag || null);
}
