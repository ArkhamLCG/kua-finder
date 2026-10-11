import { useEffect, useState } from "react";
import { loadProductStock } from "../lib/catalog";
import type {
	AvailabilityCountry,
	AvailabilityOnline,
	Country,
} from "../types";

function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
	const next = new Set(set);
	if (next.has(item)) next.delete(item);
	else next.add(item);
	return next;
}

export function useProductStock(productId: number | null) {
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const [error, setError] = useState<string | null>(null);
	const [countries, setCountries] = useState<AvailabilityCountry[]>([]);
	const [onlineOffers, setOnlineOffers] = useState<AvailabilityOnline[]>([]);
	const [expandedCountries, setExpandedCountries] = useState<Set<Country>>(
		() => new Set(),
	);
	const [expandedCities, setExpandedCities] = useState<Set<number>>(
		() => new Set(),
	);
	const [cityQuery, setCityQuery] = useState("");

	useEffect(() => {
		if (productId == null) return;

		let cancelled = false;
		setStatus("loading");
		setError(null);
		setExpandedCountries(new Set());
		setExpandedCities(new Set());
		setCityQuery("");

		loadProductStock(productId)
			.then((detail) => {
				if (cancelled) return;
				setCountries(detail.countries);
				setOnlineOffers(detail.online);
				setStatus("ready");
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : String(err));
				setStatus("error");
			});

		return () => {
			cancelled = true;
		};
	}, [productId]);

	return {
		status,
		error,
		countries,
		onlineOffers,
		cityQuery,
		setCityQuery,
		expandedCountries,
		expandedCities,
		toggleCountry: (country: Country) => {
			setExpandedCountries((prev) => toggleSetItem(prev, country));
		},
		toggleCity: (regionId: number) => {
			setExpandedCities((prev) => toggleSetItem(prev, regionId));
		},
	};
}
