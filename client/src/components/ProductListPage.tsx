import { useMemo } from "react";
import { useCatalog } from "../hooks/useCatalog";
import { useCatalogFilters } from "../hooks/useCatalogFilters";
import { formatUpdatedAt } from "../lib/catalog";
import { CATALOG_DISCLAIMER } from "../lib/disclaimer";
import { visibleProducts } from "../lib/product-list";
import { VirtualProductGrid } from "./VirtualProductGrid";

export function ProductListPage() {
	const { products, catalog } = useCatalog();
	const { country, regionId, query, inStockOnly } = useCatalogFilters();

	const sorted = useMemo(
		() => visibleProducts(products, { query, regionId, country, inStockOnly }),
		[products, query, regionId, inStockOnly, country],
	);

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
