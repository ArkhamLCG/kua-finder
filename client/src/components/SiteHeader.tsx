import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../hooks/useCatalog";
import { useCatalogFilters } from "../hooks/useCatalogFilters";
import type { Country } from "../types";

const COUNTRY_OPTIONS: { value: "" | Country; label: string }[] = [
  { value: "", label: "Все страны" },
  { value: "RU", label: "Россия" },
  { value: "BY", label: "Беларусь" },
  { value: "KZ", label: "Казахстан" },
];

export function SiteHeader() {
  const { catalog } = useCatalog();
  const { country, regionId, setCountry, setRegionId } = useCatalogFilters();

  const cities = useMemo(() => {
    const all = catalog?.cities ?? [];
    if (country == null) {
      return all.filter((city) => city.country === "RU");
    }
    return all.filter((city) => city.country === country);
  }, [catalog, country]);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand">
          Поиск сыщиков
        </Link>

        <div className="site-header__filters">
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
