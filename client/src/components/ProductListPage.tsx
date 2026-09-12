import { useMemo, useState } from "react";
import {
  filterProducts,
  formatUpdatedAt,
  productHasStock,
} from "../lib/catalog";
import { CATALOG_DISCLAIMER } from "../lib/disclaimer";
import { useCatalog } from "../hooks/useCatalog";
import { useCatalogFilters } from "../hooks/useCatalogFilters";
import { VirtualProductGrid } from "./VirtualProductGrid";

export function ProductListPage() {
  const { products, catalog } = useCatalog();
  const { country, regionId } = useCatalogFilters();
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const filtered = useMemo(() => {
    const byQuery = filterProducts(products, query);
    return byQuery.filter((product) => {
      const available = productHasStock(product, regionId, country);
      if (inStockOnly && !available) return false;
      return true;
    });
  }, [products, query, regionId, inStockOnly, country]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aOk = productHasStock(a, regionId, country) ? 0 : 1;
      const bOk = productHasStock(b, regionId, country) ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [filtered, regionId, country]);

  return (
    <div className="page">
      <div className="hero">
        <p className="hero__lead">
          Наличие Arkham Horror LCG в магазинах России, Беларуси и Казахстана.
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
      </div>

      {sorted.length === 0 ? (
        <p className="state">Ничего не найдено</p>
      ) : (
        <VirtualProductGrid
          products={sorted}
          regionId={regionId}
          country={country}
          rates={catalog?.rates}
        />
      )}
    </div>
  );
}
