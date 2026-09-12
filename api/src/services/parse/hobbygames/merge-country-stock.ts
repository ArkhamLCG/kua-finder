import { isExcludedProductName } from "../match/exclude-name.js";
import { normalizeName } from "../match/normalize-name.js";
import {
  countryForSource,
  currencyForCountry,
  namespacedProductId,
  namespaceRegionId,
  type CatalogSource,
  type Country,
  type Currency,
  type OnlineRetailerSource,
} from "../retailer-types.js";
import { parsePage } from "./page/page-parser.js";
import {
  parseProductAll,
  type StockLocation,
} from "./product/product-parser.js";
import { resolveRegionId } from "./region/region-id.js";
import { parseRegions, type ParsedRegion } from "./region/region-parser.js";
import {
  buildShopPhoneMap,
  parseShops,
} from "./shop/shop-parser.js";

export type CountryStockLocation = {
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

export type CountryStockItem = {
  locationId: number;
  status: number;
  statusText: string;
  url?: string;
};

export type CountryStockProduct = {
  id: number;
  price: number;
  name: string;
  image: string | null;
  url: string;
  availableLocationIds: number[];
  currency?: Currency;
  onlineOffers?: { source: OnlineRetailerSource; url: string }[];
  priceOffers?: {
    source: OnlineRetailerSource;
    country: Country;
    currency: Currency;
    amount: number;
    url: string;
  }[];
};

function isInStock(status: number): boolean {
  return status > 0;
}

function locationKey(
  regionId: number,
  name: string,
  address: string,
  delivery: boolean,
  source: CatalogSource,
): string {
  if (delivery) return `d\0${source}\0${regionId}\0${name}`;
  return `s\0${name}\0${address}`;
}

export type MergeCountryStockResult = {
  matched: number;
  added: number;
  locationsAdded: number;
  regions: ParsedRegion[];
};

/** Scrape HG.by / HG.kz stores + stock and merge into the catalog like HG.ru. */
export async function mergeHobbygamesCountryStock(input: {
  source: "hobbygames_by" | "hobbygames_kz";
  categoryUrl: string;
  priceScale?: number;
  products: CountryStockProduct[];
  locations: CountryStockLocation[];
  nameIndex: Map<string, CountryStockProduct>;
  ensureLocation: (input: {
    regionId: number;
    name: string;
    address: string;
    delivery: boolean;
    source: CatalogSource;
    country: Country;
    currency: Currency;
    phone?: string;
  }) => number;
  loadStock: (productId: number) => Promise<CountryStockItem[]>;
  saveStock: (productId: number, stock: CountryStockItem[]) => Promise<void>;
  onProgress?: (done: number, total: number, name: string) => void;
}): Promise<MergeCountryStockResult> {
  const origin = new URL(input.categoryUrl).origin;
  const country = countryForSource(input.source);
  const currency = currencyForCountry(country);

  const nativeRegions = await parseRegions(origin);
  const shops = await parseShops(origin);
  const phones = buildShopPhoneMap(shops);

  const namespacedRegions: ParsedRegion[] = nativeRegions.map((region) => ({
    id: namespaceRegionId(input.source, region.id),
    name: region.name,
  }));

  const pageProducts = await parsePage(input.categoryUrl, {
    priceScale: input.priceScale,
  });

  let matched = 0;
  let added = 0;
  let locationsAdded = 0;
  const beforeLocationCount = input.locations.length;

  for (const [index, pageProduct] of pageProducts.entries()) {
    if (isExcludedProductName(pageProduct.name)) {
      input.onProgress?.(index + 1, pageProducts.length, pageProduct.name);
      continue;
    }

    let stockLocations: {
      regionId: number;
      location: StockLocation;
    }[] = [];

    try {
      const stock = await parseProductAll(
        pageProduct.id,
        4,
        nativeRegions,
        undefined,
        { origin },
      );
      for (const region of stock.regions) {
        const scrapedRegionId = region.regionId ?? 0;
        for (const location of region.locations) {
          if (!isInStock(location.status)) continue;
          // BY/KZ: only physical stores matter, skip delivery / pickup hubs.
          if (location.delivery) continue;
          const resolvedNative = resolveRegionId(
            location.name,
            nativeRegions,
            scrapedRegionId,
          );
          if (resolvedNative !== scrapedRegionId) {
            continue;
          }
          stockLocations.push({
            regionId: namespaceRegionId(
              input.source,
              resolvedNative || scrapedRegionId,
            ),
            location,
          });
        }
      }
    } catch {
      stockLocations = [];
    }

    input.onProgress?.(index + 1, pageProducts.length, pageProduct.name);

    const stockByLocation = new Map<number, CountryStockItem>();
    for (const entry of stockLocations) {
      const locationId = input.ensureLocation({
        regionId: entry.regionId,
        name: entry.location.name,
        address: entry.location.address,
        delivery: entry.location.delivery,
        source: input.source,
        country,
        currency,
        phone: phones.get(entry.location.name) ?? "",
      });
      const prev = stockByLocation.get(locationId);
      if (!prev || entry.location.status > prev.status) {
        stockByLocation.set(locationId, {
          locationId,
          status: entry.location.status,
          statusText: entry.location.statusText,
          url: pageProduct.url,
        });
      }
    }

    const availableStock = [...stockByLocation.values()];
    const key = normalizeName(pageProduct.name);
    const existing = key ? input.nameIndex.get(key) : undefined;

    const upsertOffers = (product: CountryStockProduct) => {
      if (availableStock.length === 0) return;
      const online = [...(product.onlineOffers ?? [])].filter(
        (offer) => offer.source !== input.source,
      );
      online.push({ source: input.source, url: pageProduct.url });
      product.onlineOffers = online;

      const prices = [...(product.priceOffers ?? [])].filter(
        (offer) => offer.source !== input.source,
      );
      prices.push({
        source: input.source,
        country,
        currency,
        amount: pageProduct.price,
        url: pageProduct.url,
      });
      product.priceOffers = prices;
    };

    if (existing) {
      matched += 1;
      const previous = await input.loadStock(existing.id);
      const withoutCountry = previous.filter((item) => {
        const location = input.locations.find((loc) => loc.id === item.locationId);
        return location?.source !== input.source;
      });
      const nextStock = [...withoutCountry, ...availableStock];
      existing.availableLocationIds = [
        ...new Set([
          ...existing.availableLocationIds.filter((id) => {
            const location = input.locations.find((loc) => loc.id === id);
            return location?.source !== input.source;
          }),
          ...availableStock.map((item) => item.locationId),
        ]),
      ];
      upsertOffers(existing);
      await input.saveStock(existing.id, nextStock);
      continue;
    }

    if (availableStock.length === 0) continue;

    added += 1;
    const catalogId = namespacedProductId(input.source, pageProduct.id);
    const product: CountryStockProduct = {
      id: catalogId,
      price: pageProduct.price,
      currency,
      name: pageProduct.name,
      image: pageProduct.image,
      url: pageProduct.url,
      availableLocationIds: availableStock.map((item) => item.locationId),
      onlineOffers: [{ source: input.source, url: pageProduct.url }],
      priceOffers: [
        {
          source: input.source,
          country,
          currency,
          amount: pageProduct.price,
          url: pageProduct.url,
        },
      ],
    };
    input.products.push(product);
    if (key) input.nameIndex.set(key, product);
    await input.saveStock(catalogId, availableStock);
  }

  locationsAdded = input.locations.length - beforeLocationCount;

  return {
    matched,
    added,
    locationsAdded,
    regions: namespacedRegions,
  };
}
