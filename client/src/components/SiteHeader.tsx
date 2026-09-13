import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useCatalog } from "../hooks/useCatalog";
import {
  homeSearchHref,
  useCatalogFilters,
} from "../hooks/useCatalogFilters";
import type { Country } from "../types";

const COUNTRY_OPTIONS: { value: "" | Country; label: string }[] = [
  { value: "", label: "Все страны" },
  { value: "RU", label: "Россия" },
  { value: "BY", label: "Беларусь" },
  { value: "KZ", label: "Казахстан" },
];

export function SiteHeader() {
  const { catalog } = useCatalog();
  const {
    country,
    regionId,
    query,
    inStockOnly,
    setCountry,
    setRegionId,
    setQuery,
    setInStockOnly,
  } = useCatalogFilters();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHome = location.pathname === "/";
  const hydratedFromUrl = useRef(false);

  // Apply ?q= / ?stock= once when opening home (shareable links / Искать).
  useEffect(() => {
    if (!isHome) {
      hydratedFromUrl.current = false;
      return;
    }
    if (hydratedFromUrl.current) return;
    hydratedFromUrl.current = true;

    setQuery(searchParams.get("q") ?? "");
    setInStockOnly(searchParams.get("stock") === "1");
  }, [isHome, searchParams, setQuery, setInStockOnly]);

  const syncHomeUrl = (nextQuery: string, nextStock: boolean) => {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("q", trimmed);
    if (nextStock) params.set("stock", "1");
    setSearchParams(params, { replace: true });
  };

  const cities = useMemo(() => {
    const all = catalog?.cities ?? [];
    if (country == null) return all;
    return all.filter((city) => city.country === country);
  }, [catalog, country]);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand">
          Поиск сыщиков
        </Link>

        <div className="site-header__filters">
          {isHome ? (
            <>
              <label className="search site-header__search">
                <span className="visually-hidden">Поиск товара</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    const next = e.target.value;
                    setQuery(next);
                    syncHomeUrl(next, inStockOnly);
                  }}
                  placeholder="Название товара…"
                  autoComplete="off"
                />
              </label>

              <label className="filter-check site-header__stock">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setInStockOnly(next);
                    syncHomeUrl(query, next);
                  }}
                />
                <span>Только в наличии</span>
              </label>
            </>
          ) : (
            <Link
              to={homeSearchHref(query, inStockOnly)}
              className="site-header__search-btn"
            >
              Искать
            </Link>
          )}

          <label className="filter-select site-header__select">
            <span className="visually-hidden">Страна</span>
            <select
              value={country ?? ""}
              onChange={(e) => {
                const value = e.target.value as "" | Country;
                setCountry(value ? value : null);
              }}
            >
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {cities.length > 0 ? (
            <label className="filter-select site-header__select">
              <span className="visually-hidden">Город</span>
              <select
                value={regionId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setRegionId(value ? Number(value) : null);
                }}
              >
                <option value="">Все города</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>
    </header>
  );
}
