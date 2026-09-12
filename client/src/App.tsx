import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CatalogLoader } from "./components/CatalogLoader";
import { ProductDetailPage } from "./components/ProductDetailPage";
import { ProductListPage } from "./components/ProductListPage";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { CatalogProvider, useCatalog } from "./hooks/useCatalog";
import { CatalogFiltersProvider } from "./hooks/useCatalogFilters";

const basename =
  import.meta.env.BASE_URL === "/"
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, "");

function AppRoutes() {
  const { status, error, progress } = useCatalog();

  if (status === "loading") {
    return <CatalogLoader progress={progress} />;
  }

  if (status === "error") {
    return (
      <div className="app-shell">
        <div className="page">
          <p className="hero__brand">Поиск сыщиков</p>
          <p className="state state--error">{error}</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <CatalogFiltersProvider>
      <div className="app-shell">
        <SiteHeader />
        <div className="app-shell__main">
          <Routes>
            <Route path="/" element={<ProductListPage />} />
            <Route path="/product/:productId" element={<ProductDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <SiteFooter />
      </div>
    </CatalogFiltersProvider>
  );
}

export function App() {
  return (
    <CatalogProvider>
      <BrowserRouter basename={basename}>
        <AppRoutes />
      </BrowserRouter>
    </CatalogProvider>
  );
}
