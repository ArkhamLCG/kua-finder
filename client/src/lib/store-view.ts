import type {
	AvailabilityCity,
	AvailabilityCountry,
	AvailabilityOnline,
	AvailabilityStore,
	CatalogProduct,
	CatalogRates,
	Country,
	ListPrice,
} from "../types";
import {
	formatQuantity,
	getListPrice,
	onlineSourceCountry,
	productHasStock,
} from "./catalog";
import { countryProductUrl } from "./links";
import { pluralCities, pluralStores } from "./plural";

export type StoreLayout =
	| { mode: "empty" }
	| { mode: "single-store"; store: AvailabilityStore; note: string }
	| { mode: "single-country"; cities: AvailabilityCity[]; note: string }
	| { mode: "multi-country"; countries: AvailabilityCountry[] };

export function filterStoreCountries(
	countries: AvailabilityCountry[],
	country: Country | null,
	regionId: number | null,
	cityQuery: string,
): AvailabilityCountry[] {
	let next = countries;

	if (country != null) {
		next = next.filter((group) => group.country === country);
	}

	if (regionId != null) {
		next = next
			.map((group) => ({
				...group,
				cities: group.cities.filter((city) => city.regionId === regionId),
			}))
			.filter((group) => group.cities.length > 0);
	}

	const normalized = cityQuery.trim().toLowerCase();
	if (!normalized) return next;

	return next
		.map((group) => ({
			...group,
			cities: group.cities.filter(
				(city) =>
					city.regionName.toLowerCase().includes(normalized) ||
					group.countryName.toLowerCase().includes(normalized),
			),
		}))
		.filter((group) => group.cities.length > 0);
}

export function filterOnlineOffers(
	offers: AvailabilityOnline[],
	country: Country | null,
): AvailabilityOnline[] {
	if (country == null) return offers;
	return offers.filter(
		(offer) => onlineSourceCountry(offer.source) === country,
	);
}

export function resolveStoreLayout(groups: AvailabilityCountry[]): StoreLayout {
	if (groups.length === 0) return { mode: "empty" };

	if (groups.length === 1) {
		const group = groups[0]!;
		const storeTotal = group.cities.reduce(
			(sum, city) => sum + city.stores.length,
			0,
		);

		if (storeTotal === 1 && group.cities.length === 1) {
			const city = group.cities[0]!;
			return {
				mode: "single-store",
				store: city.stores[0]!,
				note: `${group.countryName} · ${city.regionName}`,
			};
		}

		return {
			mode: "single-country",
			cities: group.cities,
			note:
				group.cities.length === 1
					? `${group.countryName} · ${group.cities[0]!.regionName}`
					: group.countryName,
		};
	}

	return { mode: "multi-country", countries: groups };
}

export function countPresence(groups: AvailabilityCountry[]): {
	stockCities: number;
	stockStores: number;
	preorder: boolean;
} {
	let stockCities = 0;
	let stockStores = 0;
	let preorder = false;

	for (const group of groups) {
		for (const city of group.cities) {
			const stocked = city.stores.filter((store) => !store.preorder);
			if (city.stores.some((store) => store.preorder)) preorder = true;
			if (stocked.length === 0) continue;
			stockCities += 1;
			stockStores += stocked.length;
		}
	}

	return { stockCities, stockStores, preorder };
}

export function storeGroupSummary(stores: AvailabilityStore[]): {
	label: string;
	preorder: boolean;
} {
	const stocked = stores.filter((store) => !store.preorder);
	if (stocked.length === 0 && stores.some((store) => store.preorder)) {
		return { label: "Предзаказ", preorder: true };
	}
	return {
		label: formatQuantity(
			stocked.reduce((sum, store) => sum + Math.max(0, store.status), 0),
		),
		preorder: false,
	};
}

export function summarizeAvailability(input: {
	cityCount: number;
	storeCount: number;
	onlineCount: number;
	regionId: number | null;
}): string {
	if (input.regionId != null && input.storeCount > 0) {
		return `${input.storeCount} ${pluralStores(input.storeCount)}`;
	}
	if (input.cityCount > 0) {
		return `${input.cityCount} ${pluralCities(input.cityCount)}`;
	}
	if (input.onlineCount > 0) return "Есть онлайн";
	return "В наличии";
}

export function storeEmptyMessage(input: {
	regionId: number | null;
	country: Country | null;
	cityQuery: string;
}): string {
	if (input.regionId != null || input.country != null) {
		return "В выбранном регионе не найдено";
	}
	if (input.cityQuery.trim()) return "Город не найден";
	return "Сейчас товар нигде не найден в наличии.";
}

export function describeCountryGroup(
	group: AvailabilityCountry,
	product: CatalogProduct,
) {
	const stores = group.cities.flatMap((city) => city.stores);
	const summary = storeGroupSummary(stores);
	return {
		storeCount: stores.length,
		label: summary.label,
		preorder: summary.preorder,
		productUrl: countryProductUrl(group, product),
	};
}

export type StoreView = {
	filteredCountries: AvailabilityCountry[];
	filteredOnline: AvailabilityOnline[];
	layout: StoreLayout;
	available: boolean;
	listPrice: ListPrice;
	statusSummary: string;
	preorderStatus: boolean;
	showOnlineMarker: boolean;
	showCitySearch: boolean;
	singleCountryLink: { url: string | null; country: Country } | null;
	emptyMessage: string;
};

export function buildStoreView(input: {
	product: CatalogProduct;
	rates: CatalogRates | undefined;
	country: Country | null;
	regionId: number | null;
	stockStatus: "loading" | "ready" | "error";
	countries: AvailabilityCountry[];
	onlineOffers: AvailabilityOnline[];
	cityQuery: string;
}): StoreView {
	const filteredCountries = filterStoreCountries(
		input.countries,
		input.country,
		input.regionId,
		input.cityQuery,
	);
	const filteredOnline = filterOnlineOffers(input.onlineOffers, input.country);
	const layout = resolveStoreLayout(filteredCountries);
	const available = productHasStock(
		input.product,
		input.regionId,
		input.country,
	);
	const presence = countPresence(filteredCountries);
	const statusSummary =
		input.stockStatus === "loading"
			? "Загрузка наличия…"
			: available
				? summarizeAvailability({
						cityCount: presence.stockCities,
						storeCount: presence.stockStores,
						onlineCount: filteredOnline.length,
						regionId: input.regionId,
					})
				: presence.preorder
					? "Предзаказ"
					: "Нет в наличии";
	const hasCityStock =
		input.regionId != null
			? presence.stockStores > 0
			: presence.stockCities > 0;
	const singleGroup =
		layout.mode === "single-country" ? filteredCountries[0] : undefined;

	return {
		filteredCountries,
		filteredOnline,
		layout,
		available,
		listPrice: getListPrice(input.product, input.rates),
		statusSummary,
		preorderStatus: statusSummary === "Предзаказ",
		showOnlineMarker:
			input.stockStatus === "ready" &&
			hasCityStock &&
			filteredOnline.length > 0,
		showCitySearch:
			input.regionId == null &&
			layout.mode !== "empty" &&
			layout.mode !== "single-store" &&
			(layout.mode === "multi-country" ||
				(layout.mode === "single-country" && layout.cities.length > 1)),
		singleCountryLink: singleGroup
			? {
					url: countryProductUrl(singleGroup, input.product),
					country: singleGroup.country,
				}
			: null,
		emptyMessage: storeEmptyMessage(input),
	};
}
