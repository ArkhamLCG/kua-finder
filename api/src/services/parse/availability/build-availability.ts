import type {
  CatalogSource,
  Country,
  Currency,
  OnlineRetailerSource,
} from "../retailer-types.js";
import { currencyForCountry } from "../retailer-types.js";

export type AvailabilityLocation = {
  id: number;
  regionId: number;
  name: string;
  address: string;
  phone: string;
  delivery: boolean;
  source?: CatalogSource;
  country?: Country;
  currency?: Currency;
};

export type AvailabilityStockItem = {
  locationId: number;
  status: number;
  statusText: string;
  url?: string;
};

export type AvailabilityPriceOffer = {
  source: OnlineRetailerSource;
  country: Country;
  currency: Currency;
  amount: number;
  url: string;
};

export type AvailabilityProduct = {
  price: number;
  currency?: Currency;
  url: string;
  onlineOffers?: { source: OnlineRetailerSource; url: string }[];
  priceOffers?: AvailabilityPriceOffer[];
};

export type AvailabilityStore = {
  locationId: number;
  name: string;
  address: string;
  phone: string;
  source?: CatalogSource;
  country: Country;
  status: number;
  statusText: string;
  url: string | null;
  price: number | null;
  currency: Currency;
};

export type AvailabilityCity = {
  regionId: number;
  regionName: string;
  stores: AvailabilityStore[];
};

export type AvailabilityCountry = {
  country: Country;
  countryName: string;
  cities: AvailabilityCity[];
};

export type AvailabilityOnline = {
  locationId: number;
  name: string;
  source?: CatalogSource;
  status: number;
  statusText: string;
  url: string | null;
  price: number | null;
  currency: Currency;
};

export type ProductAvailabilitySummary = {
  countries: Country[];
  onlineCountries: Country[];
  regionIds: number[];
  storeCountByRegion: Record<string, number>;
  cityCountByCountry: Partial<Record<Country, number>>;
  storeCountByCountry: Partial<Record<Country, number>>;
  hasRub: boolean;
};

export type CatalogCity = {
  id: number;
  name: string;
  country: Country;
};

export type BuiltAvailability = {
  countries: AvailabilityCountry[];
  online: AvailabilityOnline[];
  summary: ProductAvailabilitySummary;
};

const ONLINE_SOURCES: OnlineRetailerSource[] = [
  "lavka",
  "gaga",
  "znaemigraem",
  "hobbygames_by",
  "hobbygames_kz",
];

const COUNTRY_LABELS: Record<Country, string> = {
  RU: "Россия",
  BY: "Беларусь",
  KZ: "Казахстан",
};

const COUNTRY_ORDER: Country[] = ["RU", "BY", "KZ"];

function isInStock(status: number): boolean {
  return status > 0;
}

function locationCountry(location: AvailabilityLocation): Country {
  return location.country ?? "RU";
}

function locationCurrency(location: AvailabilityLocation): Currency {
  if (location.currency) return location.currency;
  return currencyForCountry(locationCountry(location));
}

function locationIdentity(location: AvailabilityLocation): string {
  if (location.delivery) {
    return `d:${location.regionId}:${location.name}`;
  }
  return `s:${location.name}|${location.address}`;
}

function isRetailerOnline(location: AvailabilityLocation): boolean {
  return (
    location.delivery &&
    location.source != null &&
    ONLINE_SOURCES.includes(location.source as OnlineRetailerSource)
  );
}

function storeDisplayPrice(
  product: AvailabilityProduct,
  location: AvailabilityLocation,
): { amount: number; currency: Currency } | null {
  const currency = locationCurrency(location);
  const source = location.source;

  if (source === "hobbygames_by" || source === "hobbygames_kz") {
    const offer = product.priceOffers?.find((item) => item.source === source);
    if (offer) return { amount: offer.amount, currency: offer.currency };
    return null;
  }

  if (currency === "RUB") {
    return {
      amount:
        product.currency === "RUB" || product.currency == null
          ? product.price
          : (product.priceOffers?.find((o) => o.currency === "RUB")?.amount ??
            product.price),
      currency: "RUB",
    };
  }

  const offer = product.priceOffers?.find((item) => item.currency === currency);
  if (offer) return { amount: offer.amount, currency: offer.currency };
  return null;
}

function storeProductUrl(
  product: AvailabilityProduct,
  location: AvailabilityLocation,
  stockUrl: string | null,
): string | null {
  if (stockUrl) return stockUrl;
  const source = location.source;
  if (source === "hobbygames_by" || source === "hobbygames_kz") {
    return (
      product.priceOffers?.find((offer) => offer.source === source)?.url ??
      product.onlineOffers?.find((offer) => offer.source === source)?.url ??
      null
    );
  }
  if (source === "hobbygames" || source == null) {
    return product.url || null;
  }
  return null;
}

export function buildAvailability(input: {
  stock: AvailabilityStockItem[];
  locationsById: Map<number, AvailabilityLocation>;
  regionNames: Map<number, string>;
  product: AvailabilityProduct;
}): BuiltAvailability {
  const { stock, locationsById, regionNames, product } = input;
  const byCountry = new Map<
    Country,
    Map<number, Map<string, AvailabilityStore>>
  >();
  const online: AvailabilityOnline[] = [];
  const onlineSeen = new Set<number>();
  const priceBySource = new Map(
    (product.priceOffers ?? []).map((offer) => [offer.source, offer]),
  );
  let hasRub = false;

  for (const item of stock) {
    if (!isInStock(item.status)) continue;
    const location = locationsById.get(item.locationId);
    if (!location) continue;

    const currency = locationCurrency(location);
    if (currency === "RUB") hasRub = true;

    if (isRetailerOnline(location)) {
      if (onlineSeen.has(location.id)) continue;
      onlineSeen.add(location.id);
      const source = location.source as OnlineRetailerSource | undefined;
      const priceOffer = source ? priceBySource.get(source) : undefined;
      online.push({
        locationId: location.id,
        name: location.name,
        source: location.source,
        status: item.status,
        statusText: item.statusText,
        url: item.url ?? null,
        price: priceOffer?.amount ?? null,
        currency: priceOffer?.currency ?? currency,
      });
      continue;
    }

    if (location.delivery) continue;

    const country = locationCountry(location);
    const regionId = location.regionId;
    const key = locationIdentity(location);
    const regions = byCountry.get(country) ?? new Map();
    const stores = regions.get(regionId) ?? new Map();
    const prev = stores.get(key);

    if (!prev || item.status > prev.status) {
      const price = storeDisplayPrice(product, location);
      stores.set(key, {
        locationId: location.id,
        name: location.name,
        address: location.address,
        phone: location.phone,
        source: location.source,
        country,
        status: item.status,
        statusText: item.statusText,
        url: storeProductUrl(product, location, item.url ?? prev?.url ?? null),
        price: price?.amount ?? null,
        currency: price?.currency ?? currency,
      });
    }

    regions.set(regionId, stores);
    byCountry.set(country, regions);
  }

  online.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const countries: AvailabilityCountry[] = COUNTRY_ORDER.filter((country) =>
    byCountry.has(country),
  ).map((country) => {
    const regions = byCountry.get(country) ?? new Map();
    const cities: AvailabilityCity[] = [...regions.entries()]
      .map(([regionId, stores]) => ({
        regionId,
        regionName: regionNames.get(regionId) ?? `Регион ${regionId}`,
        stores: [...stores.values()].sort((a, b) =>
          a.name.localeCompare(b.name, "ru"),
        ),
      }))
      .sort((a, b) => a.regionName.localeCompare(b.regionName, "ru"));

    return {
      country,
      countryName: COUNTRY_LABELS[country],
      cities,
    };
  });

  const storeCountByRegion: Record<string, number> = {};
  const cityCountByCountry: Partial<Record<Country, number>> = {};
  const storeCountByCountry: Partial<Record<Country, number>> = {};
  const regionIds: number[] = [];
  const physicalCountries: Country[] = [];

  for (const group of countries) {
    physicalCountries.push(group.country);
    cityCountByCountry[group.country] = group.cities.length;
    let storeTotal = 0;
    for (const city of group.cities) {
      regionIds.push(city.regionId);
      storeCountByRegion[String(city.regionId)] = city.stores.length;
      storeTotal += city.stores.length;
    }
    storeCountByCountry[group.country] = storeTotal;
  }

  const onlineCountries = [
    ...new Set(
      online.map((offer) => {
        if (offer.source === "hobbygames_by") return "BY" as Country;
        if (offer.source === "hobbygames_kz") return "KZ" as Country;
        return "RU" as Country;
      }),
    ),
  ].sort(
    (a, b) => COUNTRY_ORDER.indexOf(a) - COUNTRY_ORDER.indexOf(b),
  );

  return {
    countries,
    online,
    summary: {
      countries: physicalCountries,
      onlineCountries,
      regionIds,
      storeCountByRegion,
      cityCountByCountry,
      storeCountByCountry,
      hasRub,
    },
  };
}

export function buildCatalogCities(
  locations: AvailabilityLocation[],
  regionNames: Map<number, string>,
): CatalogCity[] {
  const byId = new Map<number, CatalogCity>();

  for (const location of locations) {
    if (location.delivery) continue;
    const country = locationCountry(location);
    const id = location.regionId;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      name: regionNames.get(id) ?? `Регион ${id}`,
      country,
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
