import type {
	CatalogProduct,
	CatalogRates,
	Country,
	ListPrice,
	RetailerBadge,
} from "../types";
import {
	countAvailableCities,
	countAvailableStores,
	getListPrice,
	getRetailerBadges,
	listAvailabilityHoverItems,
	productHasOnline,
	productIsPreorder,
} from "./catalog";
import { pluralCities, pluralStores } from "./plural";

export function productCardModel(input: {
	product: CatalogProduct;
	available: boolean;
	regionId: number | null;
	country: Country | null;
	rates?: CatalogRates;
}): {
	statusText: string | null;
	preorder: boolean;
	showCityHover: boolean;
	cityGroups: Array<{ label: string | null; items: string[] }>;
	showOnlineMarker: boolean;
	showSources: boolean;
	badges: RetailerBadge[];
	listPrice: ListPrice;
} {
	const { product, available, regionId, country, rates } = input;
	const storeCount =
		regionId == null
			? countAvailableCities(product, country)
			: countAvailableStores(product, regionId, country);
	const badges = getRetailerBadges(product, regionId, country);
	const hasStores = storeCount > 0;
	const cityHover =
		hasStores && regionId == null
			? listAvailabilityHoverItems(product, country)
			: null;
	const cityNames = cityHover?.groups.flatMap((group) => group.items) ?? [];
	const singleCityName =
		regionId == null && storeCount === 1 ? (cityNames[0] ?? null) : null;

	let statusText: string | null = null;
	if (hasStores) {
		if (regionId == null) {
			statusText =
				singleCityName ?? `${storeCount} ${pluralCities(storeCount)}`;
		} else {
			statusText = `${storeCount} ${pluralStores(storeCount)}`;
		}
	} else if (available) {
		statusText = "Есть онлайн";
	} else if (productIsPreorder(product, regionId, country)) {
		statusText = "Предзаказ";
	} else {
		statusText = "Нет в наличии";
	}

	return {
		statusText,
		preorder: statusText === "Предзаказ",
		showCityHover: storeCount > 1 && cityNames.length > 0,
		cityGroups: cityHover?.groups ?? [],
		showOnlineMarker: hasStores && productHasOnline(product, country),
		showSources: badges.length > 1,
		badges,
		listPrice: getListPrice(product, rates),
	};
}
