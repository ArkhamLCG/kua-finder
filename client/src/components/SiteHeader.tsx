import { useEffect, useMemo, useRef, useState } from "react";
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
  const [searchOpen, setSearchOpen] = useState(false);

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

  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);

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
    <header className={`site-header${searchOpen ? " site-header--search-open" : ""}`}>
      <div className="site-header__inner">
        <div className="site-header__primary">
          <button
            type="button"
            className="site-header__search-toggle"
            aria-expanded={searchOpen}
            aria-controls="site-header-search-panel"
            onClick={() => setSearchOpen((open) => !open)}
          >
            <span className="visually-hidden">
              {searchOpen ? "Скрыть поиск" : "Показать поиск"}
            </span>
            {searchOpen ? <CloseIcon /> : <SearchIcon />}
          </button>

          <Link to="/" className="site-header__brand site-header__brand--bar">
            Поиск сыщиков
          </Link>

          <div
            id="site-header-search-panel"
            className="site-header__search-panel"
          >
            <Link to="/" className="site-header__brand site-header__brand--panel">
              Поиск сыщиков
            </Link>

            <label className="search site-header__search">
              <span className="visually-hidden">Поиск товара</span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  if (isHome) syncHomeUrl(next, inStockOnly);
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
                  if (isHome) syncHomeUrl(query, next);
                }}
              />
              <span>В наличии</span>
            </label>

            {!isHome ? (
              <Link
                to={homeSearchHref(query, inStockOnly)}
                className="site-header__search-btn"
              >
                Искать
              </Link>
            ) : null}
          </div>
        </div>

        <div className="site-header__locale">
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16.2 16.2 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
