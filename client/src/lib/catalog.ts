import type {
  CatalogLocation,
  CatalogProduct,
  CatalogRegion,
  CatalogSource,
  CityAvailability,
  OnlineOffer,
  ProductOnlineOffer,
  ProductStockDetail,
  ProductStockItem,
  ProductsCatalog,
  RetailerBadge,
  StoreAvailability,
} from "../types";
import type { LoadProgress } from "./progress";

export function isInStock(status: number): boolean {
  return status > 0;
}

/** HobbyGames stock `status` is the piece count (0 = out of stock). */
export function formatQuantity(status: number): string {
  if (status <= 0) return "Нет в наличии";
  const mod10 = status % 10;
  const mod100 = status % 100;
  if (mod10 === 1 && mod100 !== 11) return `${status} штука`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${status} штуки`;
  }
  return `${status} штук`;
}

export function formatStockLabel(
  status: number,
  location?: CatalogLocation,
): string {
  if (location?.delivery) {
    return status > 0 ? "В наличии" : "Нет в наличии";
  }
  return formatQuantity(status);
}

function extractCityFromStoreName(name: string): string | null {
  const match = /[–—-]\s*([^,]+)/.exec(name);
  const city = match?.[1]?.trim();
  return city && city.length > 0 ? city : null;
}

function locationIdentity(location: CatalogLocation): string {
  if (location.delivery) return `d:${location.regionId}:${location.name}`;
  return `s:${location.name}|${location.address}`;
}

export function resolveLocationRegionId(
  location: CatalogLocation,
  regionNames: Map<number, string>,
): number {
  if (location.delivery) return location.regionId;

  const city = extractCityFromStoreName(location.name);
  if (!city) return location.regionId;

  for (const [id, name] of regionNames) {
    if (name === city) return id;
  }
  for (const [id, name] of regionNames) {
    if (city.includes(name) || name.includes(city)) return id;
  }
  return location.regionId;
}

function storeLocationIds(
  product: CatalogProduct,
  locationsById: Map<number, CatalogLocation>,
  regionNames: Map<number, string>,
  regionId: number | null = null,
): number[] {
  const seen = new Set<string>();
  const ids: number[] = [];

  for (const locationId of product.availableLocationIds) {
    const location = locationsById.get(locationId);
    if (!location || location.delivery) continue;
    if (
      regionId != null &&
      resolveLocationRegionId(location, regionNames) !== regionId
    ) {
      continue;
    }

    const key = locationIdentity(location);
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(locationId);
  }

  return ids;
}

function isRetailerOnline(location: CatalogLocation): boolean {
  return (
    location.delivery &&
    (location.source === "lavka" || location.source === "gaga")
  );
}

export function productHasOnline(
  product: CatalogProduct,
  locationsById: Map<number, CatalogLocation>,
): boolean {
  if ((product.onlineOffers ?? []).some((offer) => Boolean(offer.url))) {
    return true;
  }
  return product.availableLocationIds.some((locationId) => {
    const location = locationsById.get(locationId);
    return location != null && isRetailerOnline(location);
  });
}

export function productHasStock(
  product: CatalogProduct,
  locationsById: Map<number, CatalogLocation>,
  regionId: number | null = null,
  regionNames: Map<number, string> = new Map(),
): boolean {
  if (productHasOnline(product, locationsById)) return true;
  return (
    storeLocationIds(product, locationsById, regionNames, regionId).length > 0
  );
}

export function getOnlineOffers(
  stock: ProductStockItem[],
  locationsById: Map<number, CatalogLocation>,
): OnlineOffer[] {
  const offers: OnlineOffer[] = [];
  const seen = new Set<number>();

  for (const item of stock) {
    if (!isInStock(item.status)) continue;
    const location = locationsById.get(item.locationId);
    if (!location || !isRetailerOnline(location) || seen.has(location.id)) {
      continue;
    }
    seen.add(location.id);
    offers.push({
      location,
      status: item.status,
      statusText: item.statusText,
      url: item.url ?? null,
    });
  }

  return offers.sort((a, b) =>
    a.location.name.localeCompare(b.location.name, "ru"),
  );
}

const RETAILER_LABELS: Record<CatalogSource, string> = {
  hobbygames: "Hobby Games",
  lavka: "Лавка игр",
  gaga: "GaGa",
};

export function getRetailerBadges(
  product: CatalogProduct,
  locationsById: Map<number, CatalogLocation>,
  regionNames: Map<number, string> = new Map(),
  regionId: number | null = null,
): RetailerBadge[] {
  const badges: RetailerBadge[] = [];

  const hasHobbyGames =
    storeLocationIds(product, locationsById, regionNames, regionId).length > 0;

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
    if (offer.url) bySource.set(offer.source, offer.url);
  }

  for (const source of ["lavka", "gaga"] as const) {
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
  locationsById: Map<number, CatalogLocation>,
  regionId: number | null = null,
  regionNames: Map<number, string> = new Map(),
): number {
  return storeLocationIds(product, locationsById, regionNames, regionId)
    .length;
}

export function countAvailableCities(
  product: CatalogProduct,
  locationsById: Map<number, CatalogLocation>,
  regionNames: Map<number, string> = new Map(),
): number {
  const cities = new Set<number>();
  for (const locationId of storeLocationIds(
    product,
    locationsById,
    regionNames,
  )) {
    const location = locationsById.get(locationId);
    if (location) {
      cities.add(resolveLocationRegionId(location, regionNames));
    }
  }
  return cities.size;
}

export function listCities(
  locations: CatalogLocation[],
  regionNames: Map<number, string>,
): { id: number; name: string }[] {
  const ids = new Set<number>();
  for (const location of locations) {
    if (location.delivery) continue;
    ids.add(resolveLocationRegionId(location, regionNames));
  }

  return [...ids]
    .map((id) => ({
      id,
      name: regionNames.get(id) ?? `Регион ${id}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
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

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function buildLocationMap(
  locations: CatalogLocation[],
): Map<number, CatalogLocation> {
  return new Map(locations.map((location) => [location.id, location]));
}

export function buildRegionMap(
  regions: CatalogRegion[],
): Map<number, string> {
  return new Map(regions.map((region) => [region.id, region.name]));
}

export function getAvailableCities(
  stock: ProductStockItem[],
  locationsById: Map<number, CatalogLocation>,
  regionNames: Map<number, string>,
): CityAvailability[] {
  const byRegion = new Map<number, Map<string, StoreAvailability>>();

  for (const item of stock) {
    if (!isInStock(item.status)) continue;
    const location = locationsById.get(item.locationId);
    if (!location || location.delivery) continue;

    const regionId = resolveLocationRegionId(location, regionNames);
    const key = locationIdentity(location);
    const stores = byRegion.get(regionId) ?? new Map();
    const prev = stores.get(key);

    if (!prev || item.status > prev.status) {
      // Prefer the location record whose regionId already matches the city.
      const preferred =
        prev && prev.location.regionId === regionId
          ? prev.location
          : location.regionId === regionId
            ? location
            : (prev?.location ?? location);

      stores.set(key, {
        location: preferred,
        status: item.status,
        statusText: item.statusText,
      });
    }

    byRegion.set(regionId, stores);
  }

  return [...byRegion.entries()]
    .map(([regionId, stores]) => ({
      regionId,
      regionName: regionNames.get(regionId) ?? `Регион ${regionId}`,
      stores: [...stores.values()].sort((a, b) =>
        a.location.name.localeCompare(b.location.name, "ru"),
      ),
    }))
    .sort((a, b) => a.regionName.localeCompare(b.regionName, "ru"));
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
    locations: (raw.locations ?? []).map((location) => ({
      id: location.id,
      regionId: location.regionId,
      name: location.name,
      address: location.address,
      phone: location.phone ?? "",
      delivery: location.delivery,
      source: location.source,
    })),
    products: (raw.products ?? []).map((product) => ({
      id: product.id,
      price: product.price,
      name: product.name,
      image: product.image,
      url: product.url,
      availableLocationIds: Array.isArray(product.availableLocationIds)
        ? product.availableLocationIds
        : [],
      onlineOffers: Array.isArray(product.onlineOffers)
        ? product.onlineOffers
            .filter(
              (offer) =>
                (offer.source === "lavka" || offer.source === "gaga") &&
                typeof offer.url === "string" &&
                offer.url.length > 0,
            )
            .map((offer) => ({
              source: offer.source,
              url: offer.url,
            }))
        : [],
    })),
  };
}

export async function loadCatalog(
  onProgress?: (progress: LoadProgress) => void,
): Promise<{
  catalog: ProductsCatalog;
  regions: CatalogRegion[];
}> {
  const dataBase = import.meta.env.BASE_URL;
  onProgress?.({
    phase: "download",
    ratio: 0,
    loadedBytes: 0,
    totalBytes: null,
  });

  const [productsRes, regionsRes] = await Promise.all([
    fetch(`${dataBase}data/products.json`),
    fetch(`${dataBase}data/regions.json`),
  ]);

  if (!productsRes.ok) {
    throw new Error(
      `Не удалось загрузить products.json (${productsRes.status}). Запустите copy-data.`,
    );
  }
  if (!regionsRes.ok) {
    throw new Error(
      `Не удалось загрузить regions.json (${regionsRes.status}). Запустите copy-data.`,
    );
  }

  const regionsPromise = regionsRes.json() as Promise<CatalogRegion[]>;

  const productsText = await readResponseText(productsRes, (loaded, total) => {
    onProgress?.({
      phase: "download",
      ratio: total != null ? Math.min(loaded / total, 1) * 0.82 : null,
      loadedBytes: loaded,
      totalBytes: total,
    });
  });

  const regions = await regionsPromise;

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

  return { catalog, regions };
}

export async function loadProductStock(
  productId: number,
): Promise<ProductStockDetail> {
  const dataBase = import.meta.env.BASE_URL;
  const res = await fetch(`${dataBase}data/products/${productId}.json`);
  if (!res.ok) {
    throw new Error(
      `Не удалось загрузить наличие/${productId}.json (${res.status})`,
    );
  }
  return (await res.json()) as ProductStockDetail;
}
