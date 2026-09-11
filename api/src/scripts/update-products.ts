import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORY_URL } from "../config.js";
import {
  parsePage,
  type ParsedProduct,
} from "../services/parse/page/page-parser.js";
import { parseProductAll } from "../services/parse/product/product-parser.js";
import { parseRegions } from "../services/parse/region/region-parser.js";
import { resolveRegionId } from "../services/parse/region/region-id.js";
import {
  buildShopPhoneMap,
  parseShops,
} from "../services/parse/shop/shop-parser.js";
import { parseLavkaPage } from "../services/parse/lavka/page-parser.js";
import { parseGagaPage } from "../services/parse/gaga/page-parser.js";
import {
  buildNameIndex,
  normalizeName,
} from "../services/parse/match/normalize-name.js";
import {
  namespacedProductId,
  type CatalogSource,
  type ParsedRetailerProduct,
} from "../services/parse/retailer-types.js";

export type CatalogLocation = {
  id: number;
  regionId: number;
  name: string;
  address: string;
  phone: string;
  delivery: boolean;
  source?: CatalogSource;
};

export type ProductStockItem = {
  locationId: number;
  status: number;
  statusText: string;
  url?: string;
};

export type CatalogProduct = ParsedProduct & {
  availableLocationIds: number[];
  onlineOffers?: { source: "lavka" | "gaga"; url: string }[];
};

export type ProductStockFile = {
  id: number;
  last_updated: string;
  stock: ProductStockItem[];
};

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

console.log("4/5 HobbyGames stock…");
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
}): number {
  const source = input.source ?? "hobbygames";
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
    phone: shopPhones.get(input.name) ?? "",
    delivery: input.delivery,
    source,
  });
  return id;
}

async function saveIndex(): Promise<void> {
  await writeFile(
    outFile,
    JSON.stringify(
      {
        last_updated: new Date().toISOString(),
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

console.log("5/5 Online retailers…");
const lavkaLocationId = ensureLocation({
  regionId: 0,
  name: "Лавка игр",
  address: "Онлайн-доставка",
  delivery: true,
  source: "lavka",
});
const gagaLocationId = ensureLocation({
  regionId: 0,
  name: "GaGa",
  address: "Онлайн-доставка",
  delivery: true,
  source: "gaga",
});

const nameIndex = buildNameIndex(result);

for (const product of result) {
  product.onlineOffers = [];
}

function upsertOnlineOffer(
  product: CatalogProduct,
  source: "lavka" | "gaga",
  url: string,
): void {
  const offers = [...(product.onlineOffers ?? [])].filter(
    (offer) => offer.source !== source,
  );
  offers.push({ source, url });
  product.onlineOffers = offers;
}

async function mergeRetailer(input: {
  source: "lavka" | "gaga";
  locationId: number;
  products: ParsedRetailerProduct[];
}): Promise<{ matched: number; added: number }> {
  let matched = 0;
  let added = 0;

  for (const offer of input.products) {
    const key = normalizeName(offer.name);
    const existing = key ? nameIndex.get(key) : undefined;

    if (existing) {
      matched += 1;
      if (!offer.available) continue;

      const stock = [...(stockByProduct.get(existing.id) ?? [])].filter(
        (item) => item.locationId !== input.locationId,
      );
      stock.push({
        locationId: input.locationId,
        status: 1,
        statusText: "В наличии",
        url: offer.url,
      });
      if (!existing.availableLocationIds.includes(input.locationId)) {
        existing.availableLocationIds = [
          ...existing.availableLocationIds,
          input.locationId,
        ];
      }
      upsertOnlineOffer(existing, input.source, offer.url);
      await writeStockFile(existing.id, stock);
      continue;
    }

    added += 1;
    const catalogId = namespacedProductId(input.source, offer.id);
    const catalogProduct: CatalogProduct = {
      id: catalogId,
      price: offer.price,
      name: offer.name,
      image: offer.image,
      url: offer.url,
      availableLocationIds: offer.available ? [input.locationId] : [],
      onlineOffers: offer.available
        ? [{ source: input.source, url: offer.url }]
        : [],
    };
    result.push(catalogProduct);
    if (key) nameIndex.set(key, catalogProduct);
    await writeStockFile(
      catalogId,
      offer.available
        ? [
            {
              locationId: input.locationId,
              status: 1,
              statusText: "В наличии",
              url: offer.url,
            },
          ]
        : [],
    );
  }

  return { matched, added };
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

await saveIndex();

console.log(
  `Done: ${result.length} products, ${locations.length} locations, ${formatDuration(Date.now() - startedAt)} → ${outFile} + ${productsDir}/`,
);
