import type {
  CatalogProduct,
  CatalogRates,
  CatalogSource,
  Country,
  Currency,
  ExchangeRate,
  ListPrice,
  OnlineRetailerSource,
  ProductOnlineOffer,
  ProductStockDetail,
  ProductsCatalog,
  RetailerBadge,
} from "../types";
import type { LoadProgress } from "./progress";

const ONLINE_SOURCES: OnlineRetailerSource[] = [
  "lavka",
  "gaga",
  "znaemigraem",
  "hobbygames_by",
  "hobbygames_kz",
];

/** HobbyGames stock `status` is the piece count (0 = out of stock). */
export function formatQuantity(status: number): string {
  if (status <= 0) return "Нет в наличии";
  return `${status} шт.`;
}

export function formatStockLabel(status: number, delivery = false): string {
  if (delivery) {
    return status > 0 ? "В наличии" : "Нет в наличии";
  }
  return formatQuantity(status);
}

function convertToRub(
  amount: number,
  rate: ExchangeRate | undefined,
): number | null {
  if (!rate || rate.nominal <= 0) return null;
  return Math.round((amount * rate.value) / rate.nominal);
}

export function formatPrice(
  price: number,
  currency: Currency = "RUB",
): string {
  const fractionDigits = currency === "BYN" ? 2 : 0;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(price);
}

export function formatListPrice(listPrice: ListPrice): string {
  if (listPrice.currency === "RUB") {
    return formatPrice(listPrice.amount, "RUB");
  }
  const native = formatPrice(listPrice.amount, listPrice.currency);
  if (listPrice.approxRub == null) return native;
  return `${native} ≈ ${formatPrice(listPrice.approxRub, "RUB")}`;
}

export function getListPrice(
  product: CatalogProduct,
  rates: CatalogRates | undefined,
): ListPrice {
  if (
    product.availability?.hasRub ??
    (product.currency == null || product.currency === "RUB")
  ) {
    const rubOffer = product.priceOffers?.find((o) => o.currency === "RUB");
    return {
      amount:
        product.currency === "RUB" || product.currency == null
          ? product.price
          : (rubOffer?.amount ?? product.price),
      currency: "RUB",
      approxRub: null,
    };
  }

  const foreign =
    product.priceOffers?.find(
      (offer) => offer.currency === "BYN" || offer.currency === "KZT",
    ) ?? null;

  if (foreign) {
    const rate = foreign.currency === "BYN" ? rates?.BYN : rates?.KZT;
    return {
      amount: foreign.amount,
      currency: foreign.currency,
      approxRub: convertToRub(foreign.amount, rate),
    };
  }

  const currency = product.currency ?? "RUB";
  if (currency === "BYN" || currency === "KZT") {
    const rate = currency === "BYN" ? rates?.BYN : rates?.KZT;
    return {
      amount: product.price,
      currency,
      approxRub: convertToRub(product.price, rate),
    };
  }

  return { amount: product.price, currency: "RUB", approxRub: null };
}

const RETAILER_LABELS: Record<CatalogSource, string> = {
  hobbygames: "Hobby Games",
  hobbygames_by: "Hobby Games BY",
  hobbygames_kz: "Hobby Games KZ",
  lavka: "Лавка игр",
  gaga: "GaGa",
  znaemigraem: "Знаем Играем",
};

export function productHasStock(
  product: CatalogProduct,
  regionId: number | null = null,
  country: Country | null = null,
): boolean {
  const availability = product.availability;
  if (!availability) {
    return (product.onlineOffers?.length ?? 0) > 0;
  }

  const onlineOk =
    country == null
      ? availability.onlineCountries.length > 0
      : availability.onlineCountries.includes(country);
  if (onlineOk) return true;

  if (regionId != null) {
    return (availability.storeCountByRegion[String(regionId)] ?? 0) > 0;
  }

  if (country != null) {
    return (availability.storeCountByCountry[country] ?? 0) > 0;
  }

  return (
    availability.regionIds.length > 0 || availability.onlineCountries.length > 0
  );
}

export function getRetailerBadges(
  product: CatalogProduct,
  regionId: number | null = null,
  country: Country | null = null,
): RetailerBadge[] {
  const badges: RetailerBadge[] = [];
  const availability = product.availability;

  const hasHobbyGames =
    country == null || country === "RU"
      ? regionId != null
        ? (availability?.storeCountByRegion[String(regionId)] ?? 0) > 0
        : (availability?.storeCountByCountry?.RU ?? 0) > 0
      : false;

  if (hasHobbyGames && product.url) {
    badges.push({
      source: "hobbygames",
      name: RETAILER_LABELS.hobbygames,
      count: 1,
      url: product.url,
    });
  }

  const bySource = new Map<ProductOnlineOffer["source"], string>();
  for (const offer of product.onlineOffers ?? []) {
    if (!offer.url) continue;
    if (country != null) {
      if (offer.source === "hobbygames_by" && country !== "BY") continue;
      if (offer.source === "hobbygames_kz" && country !== "KZ") continue;
      if (
        (offer.source === "lavka" ||
          offer.source === "gaga" ||
          offer.source === "znaemigraem") &&
        country !== "RU"
      ) {
        continue;
      }
    }
    bySource.set(offer.source, offer.url);
  }

  for (const source of ONLINE_SOURCES) {
    const url = bySource.get(source);
    if (!url) continue;
    badges.push({
      source,
      name: RETAILER_LABELS[source],
      count: 1,
      url,
    });
  }

  return badges;
}

export function countAvailableStores(
  product: CatalogProduct,
  regionId: number | null = null,
  country: Country | null = null,
): number {
  const availability = product.availability;
  if (!availability) return 0;

  if (regionId != null) {
    return availability.storeCountByRegion[String(regionId)] ?? 0;
  }

  if (country != null) {
    return availability.storeCountByCountry[country] ?? 0;
  }

  return Object.values(availability.storeCountByRegion).reduce(
    (sum, count) => sum + count,
    0,
  );
}

export function countAvailableCities(
  product: CatalogProduct,
  country: Country | null = null,
): number {
  const availability = product.availability;
  if (!availability) return 0;

  if (country != null) {
    return availability.cityCountByCountry[country] ?? 0;
  }

  return availability.regionIds.length;
}

export function filterProducts(
  products: CatalogProduct[],
  query: string,
): CatalogProduct[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return products;
  return products.filter((product) =>
    product.name.toLowerCase().includes(normalized),
  );
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function paintFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function readResponseText(
  res: Response,
  onBytes?: (loaded: number, total: number | null) => void,
): Promise<string> {
  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : null;
  const usableTotal =
    total != null && Number.isFinite(total) && total > 0 ? total : null;

  if (!res.body || !onBytes) {
    const text = await res.text();
    onBytes?.(text.length, usableTotal ?? text.length);
    return text;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onBytes(loaded, usableTotal);
  }

  const blob = new Blob(chunks as BlobPart[]);
  return blob.text();
}

function normalizeCatalog(raw: ProductsCatalog): ProductsCatalog {
  return {
    last_updated: raw.last_updated,
    rates: raw.rates,
    cities: Array.isArray(raw.cities) ? raw.cities : [],
    products: (raw.products ?? []).map((product) => ({
      id: product.id,
      price: product.price,
      name: product.name,
      image: product.image,
      url: product.url,
      currency: product.currency,
      availableLocationIds: Array.isArray(product.availableLocationIds)
        ? product.availableLocationIds
        : [],
      onlineOffers: Array.isArray(product.onlineOffers)
        ? product.onlineOffers
            .filter(
              (offer) =>
                ONLINE_SOURCES.includes(offer.source) &&
                typeof offer.url === "string" &&
                offer.url.length > 0,
            )
            .map((offer) => ({
              source: offer.source,
              url: offer.url,
            }))
        : [],
      priceOffers: Array.isArray(product.priceOffers)
        ? product.priceOffers.filter(
            (offer) =>
              ONLINE_SOURCES.includes(offer.source) &&
              typeof offer.amount === "number" &&
              typeof offer.url === "string",
          )
        : [],
      availability: product.availability,
    })),
  };
}

export async function loadCatalog(
  onProgress?: (progress: LoadProgress) => void,
): Promise<ProductsCatalog> {
  const dataBase = import.meta.env.BASE_URL;
  onProgress?.({
    phase: "download",
    ratio: 0,
    loadedBytes: 0,
    totalBytes: null,
  });

  const productsRes = await fetch(`${dataBase}data/products.json`);

  if (!productsRes.ok) {
    throw new Error(
      `Не удалось загрузить products.json (${productsRes.status}). Запустите copy-data.`,
    );
  }

  const productsText = await readResponseText(productsRes, (loaded, total) => {
    onProgress?.({
      phase: "download",
      ratio: total != null ? Math.min(loaded / total, 1) * 0.82 : null,
      loadedBytes: loaded,
      totalBytes: total,
    });
  });

  onProgress?.({
    phase: "parse",
    ratio: 0.86,
    loadedBytes: productsText.length,
    totalBytes: productsText.length,
  });
  await paintFrame();

  const catalog = normalizeCatalog(JSON.parse(productsText) as ProductsCatalog);

  onProgress?.({
    phase: "prepare",
    ratio: 0.95,
    loadedBytes: productsText.length,
    totalBytes: productsText.length,
  });
  await paintFrame();

  onProgress?.({
    phase: "prepare",
    ratio: 1,
    loadedBytes: productsText.length,
    totalBytes: productsText.length,
  });

  return catalog;
}

export async function loadProductStock(
  productId: number,
): Promise<ProductStockDetail> {
  const dataBase = import.meta.env.BASE_URL;
  const res = await fetch(`${dataBase}data/products/${productId}.json`);
  if (!res.ok) {
    throw new Error(
      `Не удалось загрузить stock/${productId}.json (${res.status})`,
    );
  }
  const raw = (await res.json()) as ProductStockDetail & {
    countries?: ProductStockDetail["countries"];
    online?: ProductStockDetail["online"];
  };
  return {
    id: raw.id,
    last_updated: raw.last_updated,
    countries: Array.isArray(raw.countries) ? raw.countries : [],
    online: Array.isArray(raw.online) ? raw.online : [],
  };
}
