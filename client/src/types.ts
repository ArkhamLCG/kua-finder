export type Currency = "RUB" | "BYN" | "KZT";
export type Country = "RU" | "BY" | "KZ";

export type CatalogSource =
  | "hobbygames"
  | "hobbygames_by"
  | "hobbygames_kz"
  | "lavka"
  | "gaga"
  | "znaemigraem";

export type OnlineRetailerSource =
  | "lavka"
  | "gaga"
  | "znaemigraem"
  | "hobbygames_by"
  | "hobbygames_kz";

export type ExchangeRate = {
  nominal: number;
  value: number;
  date: string;
};

export type CatalogRates = Partial<Record<"BYN" | "KZT", ExchangeRate>>;

export type CatalogCity = {
  id: number;
  name: string;
  country: Country;
};

/** Online retailer link for list/preview (no need to load stock file). */
export type ProductOnlineOffer = {
  source: OnlineRetailerSource;
  url: string;
};

export type ProductPriceOffer = {
  source: OnlineRetailerSource;
  country: Country;
  currency: Currency;
  amount: number;
  url: string;
};

/** Precomputed by API — list filters/counts without walking locations. */
export type ProductAvailabilitySummary = {
  countries: Country[];
  onlineCountries: Country[];
  regionIds: number[];
  storeCountByRegion: Record<string, number>;
  cityCountByCountry: Partial<Record<Country, number>>;
  storeCountByCountry: Partial<Record<Country, number>>;
  hasRub: boolean;
};

export type CatalogProduct = {
  id: number;
  price: number;
  name: string;
  image: string | null;
  url: string;
  availableLocationIds: number[];
  currency?: Currency;
  onlineOffers?: ProductOnlineOffer[];
  priceOffers?: ProductPriceOffer[];
  availability?: ProductAvailabilitySummary;
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

export type ProductStockDetail = {
  id: number;
  last_updated: string;
  countries: AvailabilityCountry[];
  online: AvailabilityOnline[];
};

export type ProductsCatalog = {
  last_updated: string;
  rates?: CatalogRates;
  cities: CatalogCity[];
  products: CatalogProduct[];
};

export type RetailerBadge = {
  source: CatalogSource;
  name: string;
  count: number;
  url: string;
};

export type ListPrice = {
  amount: number;
  currency: Currency;
  approxRub: number | null;
};
