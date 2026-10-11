import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { homeSearchParams, useCatalogFilters } from "./useCatalogFilters";

/** Keeps the home search box in sync with `q` and `stock` on `/`. */
export function useHomeSearch() {
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	const { query, inStockOnly, setQuery, setInStockOnly } = useCatalogFilters();
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
		setSearchParams(homeSearchParams(nextQuery, nextStock), { replace: true });
	};

	return {
		isHome,
		searchOpen,
		setSearchOpen,
		query,
		inStockOnly,
		setQuery,
		setInStockOnly,
		syncHomeUrl,
	};
}
