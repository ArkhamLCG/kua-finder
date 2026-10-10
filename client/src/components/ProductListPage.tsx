import { useMemo } from "react";
import { useCatalog } from "../hooks/useCatalog";
import { useCatalogFilters } from "../hooks/useCatalogFilters";
import {
	filterProducts,
	formatUpdatedAt,
	productHasStock,
	productIsPreorder,
} from "../lib/catalog";
import { CATALOG_DISCLAIMER } from "../lib/disclaimer";
import { VirtualProductGrid } from "./VirtualProductGrid";

export function ProductListPage() {
	const { products, catalog } = useCatalog();
	const { country, regionId, query, inStockOnly } = useCatalogFilters();

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
			const rank = (product: (typeof filtered)[number]) => {
				if (productHasStock(product, regionId, country)) return 0;
				if (productIsPreorder(product, regionId, country)) return 1;
				return 2;
			};
			const aOk = rank(a);
			const bOk = rank(b);
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
