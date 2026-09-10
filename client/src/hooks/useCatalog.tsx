import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildLocationMap,
  buildRegionMap,
  loadCatalog,
  productHasStock,
} from "../lib/catalog";
import type { LoadProgress } from "../lib/progress";
import type {
  CatalogLocation,
  CatalogProduct,
  ProductsCatalog,
} from "../types";

type CatalogState = {
  status: "loading" | "ready" | "error";
  error: string | null;
  progress: LoadProgress | null;
  catalog: ProductsCatalog | null;
  locationsById: Map<number, CatalogLocation>;
  regionNames: Map<number, string>;
  products: CatalogProduct[];
  isAvailable: (product: CatalogProduct) => boolean;
};

const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>({
    phase: "download",
    ratio: 0,
    loadedBytes: 0,
    totalBytes: null,
  });
  const [catalog, setCatalog] = useState<ProductsCatalog | null>(null);
  const [regionNames, setRegionNames] = useState<Map<number, string>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let pending: LoadProgress | null = null;

    const pushProgress = (next: LoadProgress) => {
      pending = next;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!cancelled && pending) setProgress(pending);
      });
    };

    loadCatalog(pushProgress)
      .then(({ catalog: nextCatalog, regions }) => {
        if (cancelled) return;
        setCatalog(nextCatalog);
        setRegionNames(buildRegionMap(regions));
        setProgress({
          phase: "prepare",
          ratio: 1,
          loadedBytes: 0,
          totalBytes: null,
        });
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const value = useMemo<CatalogState>(() => {
    const locationsById = buildLocationMap(catalog?.locations ?? []);
    const products = catalog?.products ?? [];

    return {
      status,
      error,
      progress,
      catalog,
      locationsById,
      regionNames,
      products,
      isAvailable: (product) =>
        productHasStock(product, locationsById, null, regionNames),
    };
  }, [status, error, progress, catalog, regionNames]);

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error("useCatalog must be used within CatalogProvider");
  }
  return ctx;
}
