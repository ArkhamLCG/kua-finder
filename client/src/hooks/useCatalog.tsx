import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadCatalog, productHasStock } from "../lib/catalog";
import type { LoadProgress } from "../lib/progress";
import type { CatalogProduct, ProductsCatalog } from "../types";

type CatalogState = {
  status: "loading" | "ready" | "error";
  error: string | null;
  progress: LoadProgress | null;
  catalog: ProductsCatalog | null;
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
      .then((nextCatalog) => {
        if (cancelled) return;
        setCatalog(nextCatalog);
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
    const products = catalog?.products ?? [];

    return {
      status,
      error,
      progress,
      catalog,
      products,
      isAvailable: (product) => productHasStock(product),
    };
  }, [status, error, progress, catalog]);

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
