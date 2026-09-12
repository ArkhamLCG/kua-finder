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
  setCountry: (country: Country | null) => void;
  setRegionId: (regionId: number | null) => void;
};

const CatalogFiltersContext = createContext<CatalogFiltersState | null>(null);

export function CatalogFiltersProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<Country | null>(null);
  const [regionId, setRegionId] = useState<number | null>(null);

  const value = useMemo<CatalogFiltersState>(
    () => ({
      country,
      regionId,
      setCountry: (next) => {
        setCountryState(next);
        setRegionId(null);
      },
      setRegionId,
    }),
    [country, regionId],
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
