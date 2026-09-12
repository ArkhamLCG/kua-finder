import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORY_URL } from "../config.js";
import { fetchCbrRates } from "../services/parse/cbr/cbr-rates.js";
import {
  parsePage,
  type ParsedProduct,
} from "../services/parse/hobbygames/page/page-parser.js";
import {
  parseProductAll,
} from "../services/parse/hobbygames/product/product-parser.js";
import { mergeHobbygamesCountryStock } from "../services/parse/hobbygames/merge-country-stock.js";
import { parseRegions } from "../services/parse/hobbygames/region/region-parser.js";
import { resolveRegionId } from "../services/parse/hobbygames/region/region-id.js";
import {
  buildShopPhoneMap,
  parseShops,
} from "../services/parse/hobbygames/shop/shop-parser.js";
import { parseLavkaPage } from "../services/parse/lavka/page-parser.js";
import { parseGagaPage } from "../services/parse/gaga/page-parser.js";
import { parseZnaemigraemPage } from "../services/parse/znaemigraem/page-parser.js";
import { buildNameIndex } from "../services/parse/match/normalize-name.js";
import {
  mergeOnlineRetailer,
  onlineLocationDefaults,
  type MergePriceOffer,
} from "../services/parse/merge-online-retailers.js";
import { enrichCatalogAvailability } from "../services/parse/availability/enrich-catalog.js";
import type {
  CatalogCity,
  ProductAvailabilitySummary,
} from "../services/parse/availability/build-availability.js";
import type {
  CatalogRates,
  CatalogSource,
  Country,
  Currency,
  OnlineRetailerSource,
  ParsedRetailerProduct,
} from "../services/parse/retailer-types.js";

export type CatalogLocation = {
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

export type ProductStockItem = {
  locationId: number;
  status: number;
  statusText: string;
  url?: string;
};

export type CatalogProduct = ParsedProduct & {
  availableLocationIds: number[];
  currency?: Currency;
  onlineOffers?: { source: OnlineRetailerSource; url: string }[];
  priceOffers?: MergePriceOffer[];
  availability?: ProductAvailabilitySummary;
};

export type ProductStockFile = {
  id: number;
  last_updated: string;
  stock: ProductStockItem[];
};

let catalogCities: CatalogCity[] = [];

const CATEGORY_URL_BY =
  process.env.CATEGORY_URL_BY ??
  "https://hobbygames.by/kartochnij-uzhas-arkhjema";
const CATEGORY_URL_KZ =
  process.env.CATEGORY_URL_KZ ??
  "https://hobbygames.kz/arkham-horror-card-game";

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function setProgress(text: string): void {
  const width = process.stdout.columns || 100;
  const line = text.length > width - 1 ? `${text.slice(0, width - 2)}…` : text;
  process.stdout.write(`\r\x1b[2K${line}`);
}

function clearProgress(): void {
  process.stdout.write(`\r\x1b[2K`);
}

function locationKey(
  regionId: number,
  name: string,
  address: string,
  delivery: boolean,
  source?: CatalogSource,
): string {
  if (delivery) return `d\0${source ?? "hobbygames"}\0${regionId}\0${name}`;
  return `s\0${name}\0${address}`;
}

function isInStock(status: number): boolean {
  return status > 0;
}

const url = process.argv[2] ?? CATEGORY_URL;
const outDir = path.resolve("dist");
const outFile = path.join(outDir, "products.json");
const productsDir = path.join(outDir, "products");

await mkdir(outDir, { recursive: true });

console.log("1/5 Catalog…");
let products: ParsedProduct[];
try {
  const raw = JSON.parse(await readFile(outFile, "utf8")) as {
    products?: ParsedProduct[];
  };
  if (!Array.isArray(raw.products) || raw.products.length === 0) {
    throw new Error("empty products.json");
  }
  // Drop namespaced retailer-only rows from a previous merge run.
  products = raw.products
    .filter((product) => product.id < 1_000_000)
    .map((product) => ({
      id: product.id,
      price: product.price,
      name: product.name,
      image: product.image,
      url: product.url,
    }));
  if (products.length === 0) throw new Error("no hobbygames products");
  console.log(`   ${products.length} products (from products.json)`);
} catch {
  products = await parsePage(url);
  await writeFile(
    outFile,
    JSON.stringify(
      {
        last_updated: new Date().toISOString(),
        products,
      },
      null,
      2,
    ),
  );
  console.log(`   ${products.length} products (parsed page)`);
}

console.log("2/5 Regions…");
const regions = await parseRegions();
console.log(`   ${regions.length} regions`);
await writeFile(
  path.join(outDir, "regions.json"),
  JSON.stringify(regions, null, 2),
);

console.log("3/5 Shops…");
const shops = await parseShops();
const shopPhones = buildShopPhoneMap(shops);
console.log(`   ${shops.length} shops, ${shopPhones.size} with phone`);
await writeFile(
  path.join(outDir, "shops.json"),
  JSON.stringify(shops, null, 2),
);

console.log("4/6 HobbyGames stock…");
await rm(productsDir, { recursive: true, force: true });
await mkdir(productsDir, { recursive: true });

const locations: CatalogLocation[] = [];
const locationIds = new Map<string, number>();
const result: CatalogProduct[] = products.map((product) => ({
  ...product,
  availableLocationIds: [],
}));
const stockByProduct = new Map<number, ProductStockItem[]>();
const startedAt = Date.now();
let ok = 0;
let fail = 0;

function ensureLocation(input: {
  regionId: number;
  name: string;
  address: string;
  delivery: boolean;
  source?: CatalogSource;
  country?: Country;
  currency?: Currency;
  phone?: string;
}): number {
  const source = input.source ?? "hobbygames";
  const country = input.country ?? "RU";
  const currency = input.currency ?? "RUB";
  const regionId = input.delivery
    ? input.regionId
    : resolveRegionId(input.name, regions, input.regionId);
  const key = locationKey(
    regionId,
    input.name,
    input.address,
    input.delivery,
    source,
  );
  const existing = locationIds.get(key);
  if (existing != null) return existing;

  const id = locations.length + 1;
  locationIds.set(key, id);
  locations.push({
    id,
    regionId,
    name: input.name,
    address: input.address,
    phone: input.phone || shopPhones.get(input.name) || "",
    delivery: input.delivery,
    source,
    country,
    currency,
  });
  return id;
}

let catalogRates: CatalogRates = {};

async function saveIndex(): Promise<void> {
  await writeFile(
    outFile,
    JSON.stringify(
      {
        last_updated: new Date().toISOString(),
        rates: catalogRates,
        cities: catalogCities,
        locations,
        products: result,
      },
      null,
      2,
    ),
  );
}

async function writeStockFile(
  productId: number,
  stock: ProductStockItem[],
): Promise<void> {
  stockByProduct.set(productId, stock);
  const detail: ProductStockFile = {
    id: productId,
    last_updated: new Date().toISOString(),
    stock,
  };
  await writeFile(
    path.join(productsDir, `${productId}.json`),
    JSON.stringify(detail, null, 2),
  );
}

for (const [index, product] of products.entries()) {
  const productNo = index + 1;
  const productStartedAt = Date.now();
  let active = true;

  try {
    const stock = await parseProductAll(
      product.id,
      4,
      regions,
      (done, total) => {
        if (!active) return;

        const finished = index;
        const fraction = finished + done / total;
        const elapsed = Date.now() - startedAt;
        const avgMs =
          finished > 0 ? elapsed / finished : Date.now() - productStartedAt;
        const etaMs = avgMs * (products.length - fraction);

        setProgress(
          [
            `${productNo}/${products.length}`,
            `reg ${done}/${total}`,
            `${Math.round((fraction / products.length) * 100)}%`,
            `eta ${formatDuration(etaMs)}`,
            `ok ${ok}`,
            `fail ${fail}`,
            product.name,
          ].join(" | "),
        );
      },
    );

    active = false;

    const stockByLocation = new Map<number, ProductStockItem>();
    for (const region of stock.regions) {
      const scrapedRegionId = region.regionId ?? 0;
      for (const location of region.locations) {
        if (!isInStock(location.status)) continue;

        const resolvedRegionId = location.delivery
          ? scrapedRegionId
          : resolveRegionId(location.name, regions, scrapedRegionId);

        // API often returns foreign stores inside another region's popup.
        if (!location.delivery && resolvedRegionId !== scrapedRegionId) {
          continue;
        }

        const locationId = ensureLocation({
          regionId: scrapedRegionId,
          name: location.name,
          address: location.address,
          delivery: location.delivery,
          source: "hobbygames",
        });

        const prev = stockByLocation.get(locationId);
        if (!prev || location.status > prev.status) {
          stockByLocation.set(locationId, {
            locationId,
            status: location.status,
            statusText: location.statusText,
          });
        }
      }
    }

    const availableStock = [...stockByLocation.values()];
    result[index] = {
      ...product,
      availableLocationIds: availableStock.map((item) => item.locationId),
    };
    await writeStockFile(product.id, availableStock);
    ok += 1;
  } catch (error) {
    active = false;
    fail += 1;
    result[index] = {
      ...product,
      availableLocationIds: [],
    };
    await writeStockFile(product.id, []);
    setProgress(
      [
        `${productNo}/${products.length}`,
        "fail",
        error instanceof Error ? error.message : String(error),
        `ok ${ok}`,
        `fail ${fail}`,
        product.name,
      ].join(" | "),
    );
  }

  await saveIndex();
}

clearProgress();
console.log(
  `   HobbyGames: ${ok} ok, ${fail} fail, ${locations.length} locations`,
);

console.log("5/6 CBR rates…");
try {
  catalogRates = await fetchCbrRates();
  console.log(
    `   BYN=${catalogRates.BYN?.value ?? "—"} KZT=${catalogRates.KZT?.value ?? "—"}`,
  );
} catch (error) {
  console.warn(
    `   CBR rates failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  catalogRates = {};
}

console.log("6/6 Online retailers…");

function ensureOnlineLocation(source: OnlineRetailerSource): number {
  const defaults = onlineLocationDefaults(source);
  return ensureLocation({
    regionId: 0,
    name: defaults.name,
    address: defaults.address,
    delivery: true,
    source,
    country: defaults.country,
    currency: defaults.currency,
  });
}

const lavkaLocationId = ensureOnlineLocation("lavka");
const gagaLocationId = ensureOnlineLocation("gaga");
const ziLocationId = ensureOnlineLocation("znaemigraem");

const nameIndex = buildNameIndex(result);

for (const product of result) {
  product.onlineOffers = [];
  product.priceOffers = [];
  product.currency = product.currency ?? "RUB";
}

async function mergeRetailer(input: {
  source: OnlineRetailerSource;
  locationId: number;
  products: ParsedRetailerProduct[];
  useAvailableFlag?: boolean;
}): Promise<{ matched: number; added: number }> {
  const defaults = onlineLocationDefaults(input.source);
  return mergeOnlineRetailer({
    retailer: {
      source: input.source,
      locationId: input.locationId,
      country: defaults.country,
      currency: defaults.currency,
      products: input.products,
      useAvailableFlag: input.useAvailableFlag ?? true,
    },
    products: result,
    nameIndex,
    loadStock: async (productId) => stockByProduct.get(productId) ?? [],
    saveStock: writeStockFile,
  });
}

const lavkaProducts = await parseLavkaPage();
const lavkaStats = await mergeRetailer({
  source: "lavka",
  locationId: lavkaLocationId,
  products: lavkaProducts,
});
console.log(
  `   Lavka: ${lavkaProducts.length} scraped, ${lavkaStats.matched} matched, ${lavkaStats.added} added`,
);

const gagaProducts = await parseGagaPage();
const gagaStats = await mergeRetailer({
  source: "gaga",
  locationId: gagaLocationId,
  products: gagaProducts,
});
console.log(
  `   GaGa: ${gagaProducts.length} scraped, ${gagaStats.matched} matched, ${gagaStats.added} added`,
);

const ziProducts = await parseZnaemigraemPage();
const ziStats = await mergeRetailer({
  source: "znaemigraem",
  locationId: ziLocationId,
  products: ziProducts,
});
console.log(
  `   Znaemigraem: ${ziProducts.length} scraped, ${ziStats.matched} matched, ${ziStats.added} added`,
);

const extraRegions: { id: number; name: string }[] = [];

console.log("   HobbyGames BY stores…");
const byStats = await mergeHobbygamesCountryStock({
  source: "hobbygames_by",
  categoryUrl: CATEGORY_URL_BY,
  priceScale: 100,
  products: result,
  locations,
  nameIndex,
  ensureLocation,
  loadStock: async (productId) => stockByProduct.get(productId) ?? [],
  saveStock: writeStockFile,
  onProgress: (done, total, name) => {
    setProgress(`BY ${done}/${total} | ${name}`);
  },
});
clearProgress();
extraRegions.push(...byStats.regions);
console.log(
  `   BY: matched ${byStats.matched}, added ${byStats.added}, +${byStats.locationsAdded} locations`,
);

console.log("   HobbyGames KZ stores…");
const kzStats = await mergeHobbygamesCountryStock({
  source: "hobbygames_kz",
  categoryUrl: CATEGORY_URL_KZ,
  products: result,
  locations,
  nameIndex,
  ensureLocation,
  loadStock: async (productId) => stockByProduct.get(productId) ?? [],
  saveStock: writeStockFile,
  onProgress: (done, total, name) => {
    setProgress(`KZ ${done}/${total} | ${name}`);
  },
});
clearProgress();
extraRegions.push(...kzStats.regions);
console.log(
  `   KZ: matched ${kzStats.matched}, added ${kzStats.added}, +${kzStats.locationsAdded} locations`,
);

const regionsPath = path.join(outDir, "regions.json");
const allRegions = [
  ...regions,
  ...extraRegions.filter(
    (region) => !regions.some((existing) => existing.id === region.id),
  ),
];
await writeFile(regionsPath, JSON.stringify(allRegions, null, 2));

console.log("6/6 Enrich availability…");
const catalogForEnrich: {
  last_updated: string;
  rates: typeof catalogRates;
  cities?: CatalogCity[];
  locations: typeof locations;
  products: typeof result;
} = {
  last_updated: new Date().toISOString(),
  rates: catalogRates,
  locations,
  products: result,
};
const enrichStats = await enrichCatalogAvailability({
  catalog: catalogForEnrich,
  regions: allRegions,
  productsDir,
});
catalogCities = catalogForEnrich.cities ?? [];

await saveIndex();

console.log(
  `Done: ${result.length} products, ${locations.length} locations, ${enrichStats.cities} cities, ${formatDuration(Date.now() - startedAt)} → ${outFile} + ${productsDir}/`,
);
