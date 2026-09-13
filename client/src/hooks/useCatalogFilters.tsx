import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Country } from "../types";

type CatalogFiltersState = {
  country: Country | null;
  regionId: number | null;
  query: string;
  inStockOnly: boolean;
  setCountry: (country: Country | null) => void;
  setRegionId: (regionId: number | null) => void;
  setQuery: (query: string) => void;
  setInStockOnly: (value: boolean) => void;
};

const CatalogFiltersContext = createContext<CatalogFiltersState | null>(null);

export function CatalogFiltersProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<Country | null>(null);
  const [regionId, setRegionId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const value = useMemo<CatalogFiltersState>(
    () => ({
      country,
      regionId,
      query,
      inStockOnly,
      setCountry: (next) => {
        setCountryState(next);
        setRegionId(null);
      },
      setRegionId,
      setQuery,
      setInStockOnly,
    }),
    [country, regionId, query, inStockOnly],
  );

  return (
    <CatalogFiltersContext.Provider value={value}>
      {children}
    </CatalogFiltersContext.Provider>
  );
}

export function useCatalogFilters(): CatalogFiltersState {
  const ctx = useContext(CatalogFiltersContext);
  if (!ctx) {
    throw new Error("useCatalogFilters must be used within CatalogFiltersProvider");
  }
  return ctx;
}

/** Build home URL with current search params. */
export function homeSearchHref(query: string, inStockOnly: boolean): string {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set("q", trimmed);
  if (inStockOnly) params.set("stock", "1");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
