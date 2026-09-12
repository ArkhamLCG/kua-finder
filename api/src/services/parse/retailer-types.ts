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

export type ParsedRetailerProduct = {
  id: number;
  price: number;
  name: string;
  image: string | null;
  url: string;
  available: boolean;
};

export type ExchangeRate = {
  nominal: number;
  value: number;
  date: string;
};

export type CatalogRates = Partial<Record<"BYN" | "KZT", ExchangeRate>>;

export const LAVKA_ID_OFFSET = 1_000_000;
export const GAGA_ID_OFFSET = 2_000_000;
export const HOBBYGAMES_BY_ID_OFFSET = 3_000_000;
export const HOBBYGAMES_KZ_ID_OFFSET = 4_000_000;
export const ZNAEMIGRAEM_ID_OFFSET = 5_000_000;

const ID_OFFSETS: Record<OnlineRetailerSource, number> = {
  lavka: LAVKA_ID_OFFSET,
  gaga: GAGA_ID_OFFSET,
  hobbygames_by: HOBBYGAMES_BY_ID_OFFSET,
  hobbygames_kz: HOBBYGAMES_KZ_ID_OFFSET,
  znaemigraem: ZNAEMIGRAEM_ID_OFFSET,
};

export function namespacedProductId(
  source: OnlineRetailerSource,
  retailerId: number,
): number {
  return retailerId + ID_OFFSETS[source];
}

export function countryForSource(source: CatalogSource | undefined): Country {
  if (source === "hobbygames_by") return "BY";
  if (source === "hobbygames_kz") return "KZ";
  return "RU";
}

export function currencyForCountry(country: Country): Currency {
  if (country === "BY") return "BYN";
  if (country === "KZ") return "KZT";
  return "RUB";
}

export const BY_REGION_OFFSET = 1_000_000;
export const KZ_REGION_OFFSET = 2_000_000;

export function namespaceRegionId(
  source: "hobbygames_by" | "hobbygames_kz",
  regionId: number,
): number {
  return (
    regionId +
    (source === "hobbygames_by" ? BY_REGION_OFFSET : KZ_REGION_OFFSET)
  );
}

