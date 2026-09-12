import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchCbrRates } from "../services/parse/cbr/cbr-rates.js";
import { mergeHobbygamesCountryStock } from "../services/parse/hobbygames/merge-country-stock.js";
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
import type { CatalogCity } from "../services/parse/availability/build-availability.js";
import type {
  CatalogRates,
  CatalogSource,
  Country,
  Currency,
  OnlineRetailerSource,
  ParsedRetailerProduct,
} from "../services/parse/retailer-types.js";
import type { ProductAvailabilitySummary } from "../services/parse/availability/build-availability.js";

type CatalogLocation = {
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

type ProductStockItem = {
  locationId: number;
  status: number;
  statusText: string;
  url?: string;
};

type CatalogProduct = {
  id: number;
  price: number;
  name: string;
  image: string | null;
  url: string;
  availableLocationIds: number[];
  currency?: Currency;
  onlineOffers?: { source: OnlineRetailerSource; url: string }[];
  priceOffers?: MergePriceOffer[];
  availability?: ProductAvailabilitySummary;
};

type CatalogFile = {
  last_updated: string;
  rates?: CatalogRates;
  cities?: CatalogCity[];
  locations: CatalogLocation[];
  products: CatalogProduct[];
};

type StockFile = {
  id: number;
  last_updated: string;
  stock: ProductStockItem[];
};

type RegionRow = { id: number; name: string };

const CATEGORY_URL_BY =
  process.env.CATEGORY_URL_BY ??
  "https://hobbygames.by/kartochnij-uzhas-arkhjema";
const CATEGORY_URL_KZ =
  process.env.CATEGORY_URL_KZ ??
  "https://hobbygames.kz/arkham-horror-card-game";

const COUNTRY_HG_SOURCES: Array<"hobbygames_by" | "hobbygames_kz"> = [
  "hobbygames_by",
  "hobbygames_kz",
];

const ONLINE_SOURCES: OnlineRetailerSource[] = [
  "lavka",
  "gaga",
  "znaemigraem",
  "hobbygames_by",
  "hobbygames_kz",
];

const outDir = path.resolve("dist");
const outFile = path.join(outDir, "products.json");
const productsDir = path.join(outDir, "products");
const regionsFile = path.join(outDir, "regions.json");

const catalog = JSON.parse(await readFile(outFile, "utf8")) as CatalogFile;
if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
  throw new Error("products.json is empty — run update:products first");
}

await mkdir(productsDir, { recursive: true });

const oldOnlineIds = new Set(
  (catalog.locations ?? [])
    .filter(
      (location) =>
        location.source != null &&
        ONLINE_SOURCES.includes(location.source as OnlineRetailerSource),
    )
    .map((location) => location.id),
);

catalog.products = catalog.products.filter((product) => product.id < 1_000_000);
for (const product of catalog.products) {
  product.availableLocationIds = product.availableLocationIds.filter(
    (id) => !oldOnlineIds.has(id),
  );
  product.onlineOffers = [];
  product.priceOffers = [];
  product.currency = product.currency ?? "RUB";
}
catalog.locations = (catalog.locations ?? []).filter(
  (location) =>
    location.source == null ||
    !ONLINE_SOURCES.includes(location.source as OnlineRetailerSource),
);
for (const location of catalog.locations) {
  location.country = location.country ?? "RU";
  location.currency = location.currency ?? "RUB";
  location.source = location.source ?? "hobbygames";
}

let regions: RegionRow[] = [];
try {
  regions = JSON.parse(await readFile(regionsFile, "utf8")) as RegionRow[];
  regions = regions.filter((region) => region.id < 1_000_000);
} catch {
  regions = [];
}

const locationIds = new Map<string, number>();
for (const location of catalog.locations) {
  const key = location.delivery
    ? `d\0${location.source ?? "hobbygames"}\0${location.regionId}\0${location.name}`
    : `s\0${location.name}\0${location.address}`;
  locationIds.set(key, location.id);
}

function ensureLocation(input: {
  regionId: number;
  name: string;
  address: string;
  delivery: boolean;
  source: CatalogSource;
  country: Country;
  currency: Currency;
  phone?: string;
}): number {
  const key = input.delivery
    ? `d\0${input.source}\0${input.regionId}\0${input.name}`
    : `s\0${input.name}\0${input.address}`;
  const existing = locationIds.get(key);
  if (existing != null) return existing;

  const id =
    catalog.locations.reduce((max, location) => Math.max(max, location.id), 0) +
    1;
  locationIds.set(key, id);
  catalog.locations.push({
    id,
    regionId: input.regionId,
    name: input.name,
    address: input.address,
    phone: input.phone ?? "",
    delivery: input.delivery,
    source: input.source,
    country: input.country,
    currency: input.currency,
  });
  return id;
}

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

const onlineLocationIds = {
  lavka: ensureOnlineLocation("lavka"),
  gaga: ensureOnlineLocation("gaga"),
  znaemigraem: ensureOnlineLocation("znaemigraem"),
};
const onlineIds = new Set(Object.values(onlineLocationIds));

const nameIndex = buildNameIndex(catalog.products);

async function loadStock(productId: number): Promise<ProductStockItem[]> {
  try {
    const raw = JSON.parse(
      await readFile(path.join(productsDir, `${productId}.json`), "utf8"),
    ) as StockFile;
    return (raw.stock ?? []).filter(
      (item) =>
        !onlineIds.has(item.locationId) && !oldOnlineIds.has(item.locationId),
    );
  } catch {
    return [];
  }
}

async function saveStock(
  productId: number,
  stock: ProductStockItem[],
): Promise<void> {
  const detail: StockFile = {
    id: productId,
    last_updated: new Date().toISOString(),
    stock,
  };
  await writeFile(
    path.join(productsDir, `${productId}.json`),
    JSON.stringify(detail, null, 2),
  );
}

async function mergeRetailer(input: {
  source: "lavka" | "gaga" | "znaemigraem";
  products: ParsedRetailerProduct[];
}): Promise<{ matched: number; added: number }> {
  const defaults = onlineLocationDefaults(input.source);
  return mergeOnlineRetailer({
    retailer: {
      source: input.source,
      locationId: onlineLocationIds[input.source],
      country: defaults.country,
      currency: defaults.currency,
      products: input.products,
      useAvailableFlag: true,
    },
    products: catalog.products,
    nameIndex,
    loadStock,
    saveStock,
  });
}

try {
  catalog.rates = await fetchCbrRates();
  console.log(
    `CBR: BYN=${catalog.rates.BYN?.value ?? "—"} KZT=${catalog.rates.KZT?.value ?? "—"}`,
  );
} catch (error) {
  console.warn(
    `CBR rates failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  catalog.rates = catalog.rates ?? {};
}

const lavkaProducts = await parseLavkaPage();
const lavkaStats = await mergeRetailer({
  source: "lavka",
  products: lavkaProducts,
});
console.log(
  `Lavka: ${lavkaProducts.length} scraped, ${lavkaStats.matched} matched, ${lavkaStats.added} added`,
);

const gagaProducts = await parseGagaPage();
const gagaStats = await mergeRetailer({
  source: "gaga",
  products: gagaProducts,
});
console.log(
  `GaGa: ${gagaProducts.length} scraped, ${gagaStats.matched} matched, ${gagaStats.added} added`,
);

const ziProducts = await parseZnaemigraemPage();
const ziStats = await mergeRetailer({
  source: "znaemigraem",
  products: ziProducts,
});
console.log(
  `Znaemigraem: ${ziProducts.length} scraped, ${ziStats.matched} matched, ${ziStats.added} added`,
);

const extraRegions: RegionRow[] = [];

for (const source of COUNTRY_HG_SOURCES) {
  const label = source === "hobbygames_by" ? "BY" : "KZ";
  console.log(`HobbyGames ${label} stores…`);
  const stats = await mergeHobbygamesCountryStock({
    source,
    categoryUrl: source === "hobbygames_by" ? CATEGORY_URL_BY : CATEGORY_URL_KZ,
    priceScale: source === "hobbygames_by" ? 100 : 1,
    products: catalog.products,
    locations: catalog.locations,
    nameIndex,
    ensureLocation,
    loadStock,
    saveStock,
    onProgress: (done, total, name) => {
      const width = process.stdout.columns || 100;
      const text = `${label} ${done}/${total} | ${name}`;
      const line = text.length > width - 1 ? `${text.slice(0, width - 2)}…` : text;
      process.stdout.write(`\r\x1b[2K${line}`);
    },
  });
  process.stdout.write(`\r\x1b[2K`);
  extraRegions.push(...stats.regions);
  console.log(
    `${label}: matched ${stats.matched}, added ${stats.added}, +${stats.locationsAdded} locations`,
  );
}

const allRegions = [
  ...regions,
  ...extraRegions.filter(
    (region) => !regions.some((existing) => existing.id === region.id),
  ),
];
await writeFile(regionsFile, JSON.stringify(allRegions, null, 2));

console.log("Enrich availability trees…");
const enrichStats = await enrichCatalogAvailability({
  catalog,
  regions: allRegions,
  productsDir,
});

catalog.last_updated = new Date().toISOString();
await writeFile(outFile, JSON.stringify(catalog, null, 2));
console.log(
  `Saved ${catalog.products.length} products, ${catalog.locations.length} locations, ${allRegions.length} regions, ${enrichStats.cities} cities → ${outFile}`,
);
