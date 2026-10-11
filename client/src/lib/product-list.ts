import type { CatalogCity, CatalogProduct, Country } from "../types";
import { filterProducts, productHasStock, productIsPreorder } from "./catalog";

export function citiesInCountry(
	cities: CatalogCity[],
	country: Country | null,
): CatalogCity[] {
	if (country == null) return cities;
	return cities.filter((city) => city.country === country);
}

function availabilityRank(
	product: CatalogProduct,
	regionId: number | null,
	country: Country | null,
): number {
	if (productHasStock(product, regionId, country)) return 0;
	if (productIsPreorder(product, regionId, country)) return 1;
	return 2;
}

/** Query filter, optional in-stock filter, then in-stock → preorder → name. */
export function visibleProducts(
	products: CatalogProduct[],
	filters: {
		query: string;
		regionId: number | null;
		country: Country | null;
		inStockOnly: boolean;
	},
): CatalogProduct[] {
	const { query, regionId, country, inStockOnly } = filters;
	const matched = filterProducts(products, query).filter((product) => {
		const available = productHasStock(product, regionId, country);
		if (inStockOnly && !available) return false;
		return true;
	});

	return [...matched].sort((a, b) => {
		const rankDiff =
			availabilityRank(a, regionId, country) -
			availabilityRank(b, regionId, country);
		if (rankDiff !== 0) return rankDiff;
		return a.name.localeCompare(b.name, "ru");
	});
}
