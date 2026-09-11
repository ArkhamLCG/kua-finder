import { useMemo, useState } from "react";
import {
  filterProducts,
  formatUpdatedAt,
  listCities,
  productHasStock,
} from "../lib/catalog";
import { CATALOG_DISCLAIMER } from "../lib/disclaimer";
import { useCatalog } from "../hooks/useCatalog";
import { ProductCard } from "./ProductCard";

export function ProductListPage() {
  const { products, locationsById, regionNames, catalog } = useCatalog();
  const [query, setQuery] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);

  const cities = useMemo(
    () => listCities(catalog?.locations ?? [], regionNames),
    [catalog, regionNames],
  );

  const filtered = useMemo(() => {
    const byQuery = filterProducts(products, query);
    return byQuery.filter((product) => {
      const available = productHasStock(
        product,
        locationsById,
        regionId,
        regionNames,
      );
      if (inStockOnly && !available) return false;
      return true;
    });
  }, [products, query, locationsById, regionId, regionNames, inStockOnly]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aOk = productHasStock(a, locationsById, regionId, regionNames)
        ? 0
        : 1;
      const bOk = productHasStock(b, locationsById, regionId, regionNames)
        ? 0
        : 1;
      if (aOk !== bOk) return aOk - bOk;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [filtered, locationsById, regionId, regionNames]);

  return (
    <div className="page">
      <header className="hero">
        <p className="hero__brand">Поиск сыщиков</p>
        <p className="hero__lead">
          Наличие Arkham Horror LCG в Hobby Games, Лавке игр и GaGa.
        </p>

        <div className="filters">
          <label className="search">
            <span className="visually-hidden">Поиск товара</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название товара…"
              autoComplete="off"
            />
          </label>

          <label className="filter-select">
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

          <label className="filter-check">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            <span>Только в наличии</span>
          </label>
        </div>

        {catalog && (
          <p className="hero__meta">
            обновлено {formatUpdatedAt(catalog.last_updated)}
          </p>
        )}
        <p className="hero__disclaimer">{CATALOG_DISCLAIMER}</p>
      </header>

      {sorted.length === 0 ? (
        <p className="state">Ничего не найдено</p>
      ) : (
        <ul className="product-grid">
          {sorted.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                available={productHasStock(
                  product,
                  locationsById,
                  regionId,
                  regionNames,
                )}
                locationsById={locationsById}
                regionNames={regionNames}
                regionId={regionId}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
