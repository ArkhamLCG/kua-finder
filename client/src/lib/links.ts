import type {
	AvailabilityCountry,
	CatalogProduct,
	CatalogSource,
	Country,
} from "../types";

export function isHobbyGamesRuUrl(url: string): boolean {
	try {
		const host = new URL(url).hostname.replace(/^www\./, "");
		return host === "hobbygames.ru" || host.endsWith(".hobbygames.ru");
	} catch {
		return false;
	}
}

export function externalLinkLabel(url: string): string {
	try {
		const host = new URL(url).hostname.replace(/^www\./, "");
		if (host.includes("hobbygames.by")) return "Открыть на Hobby Games BY";
		if (host.includes("hobbygames.kz")) return "Открыть на Hobby Games KZ";
		if (host.includes("hobbygames")) return "Открыть на Hobby Games RU";
		if (host.includes("lavkaigr")) return "Открыть в Лавке игр";
		if (host.includes("gaga.ru")) return "Открыть на GaGa";
		if (host.includes("znaemigraem")) return "Открыть в Знаем Играем";
	} catch {
		// ignore invalid urls
	}
	return "Открыть на сайте";
}

export function onlineLinkLabel(
	source: string | undefined,
	name: string,
): string {
	if (source === "lavka") return "Открыть в Лавке игр";
	if (source === "gaga") return "Открыть на GaGa";
	if (source === "znaemigraem") return "Открыть в Знаем Играем";
	if (source === "hobbygames_by") return "Открыть на Hobby Games BY";
	if (source === "hobbygames_kz") return "Открыть на Hobby Games KZ";
	if (source === "hobbygames") return "Открыть на Hobby Games RU";
	return `Открыть в ${name}`;
}

export function countryProductLinkLabel(country: Country): string {
	if (country === "BY") return "Открыть на Hobby Games BY";
	if (country === "KZ") return "Открыть на Hobby Games KZ";
	return "Открыть";
}

export function countryProductUrl(
	group: AvailabilityCountry,
	product: CatalogProduct,
): string | null {
	if (group.country !== "BY" && group.country !== "KZ") return null;

	for (const city of group.cities) {
		for (const store of city.stores) {
			if (store.url) return store.url;
		}
	}

	const source: CatalogSource =
		group.country === "BY" ? "hobbygames_by" : "hobbygames_kz";
	return (
		product.priceOffers?.find((offer) => offer.source === source)?.url ??
		product.onlineOffers?.find((offer) => offer.source === source)?.url ??
		null
	);
}

export function phoneTelHref(phone: string): string {
	return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
