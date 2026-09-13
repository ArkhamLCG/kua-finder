import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const METRIKA_ID = import.meta.env.VITE_YANDEX_METRIKA_ID?.trim();

/** Sends SPA route changes to Yandex Metrika (skips the initial pageview). */
export function YandexMetrikaHits() {
  const location = useLocation();
  const isFirst = useRef(true);

  useEffect(() => {
    if (!METRIKA_ID || typeof window.ym !== "function") return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    const url = `${window.location.origin}${location.pathname}${location.search}${location.hash}`;
    window.ym(METRIKA_ID, "hit", url);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
