import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

type CatalogLocation = {
  id: number;
  regionId: number;
  name: string;
  address: string;
  phone: string;
  delivery: boolean;
  source?: CatalogSource;
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
  onlineOffers?: { source: "lavka" | "gaga"; url: string }[];
};

type CatalogFile = {
  last_updated: string;
  locations: CatalogLocation[];
  products: CatalogProduct[];
};

type StockFile = {
  id: number;
  last_updated: string;
  stock: ProductStockItem[];
};

const outDir = path.resolve("dist");
const outFile = path.join(outDir, "products.json");
const productsDir = path.join(outDir, "products");

const catalog = JSON.parse(await readFile(outFile, "utf8")) as CatalogFile;
if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
  throw new Error("products.json is empty — run update:products first");
}

await mkdir(productsDir, { recursive: true });

const oldOnlineIds = new Set(
  (catalog.locations ?? [])
    .filter(
      (location) =>
        location.source === "lavka" || location.source === "gaga",
    )
    .map((location) => location.id),
);

// Drop previous namespaced / online-only rows and lavka/gaga locations.
catalog.products = catalog.products.filter((product) => product.id < 1_000_000);
for (const product of catalog.products) {
  product.availableLocationIds = product.availableLocationIds.filter(
    (id) => !oldOnlineIds.has(id),
  );
  product.onlineOffers = [];
}
catalog.locations = (catalog.locations ?? []).filter(
  (location) => location.source !== "lavka" && location.source !== "gaga",
);

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
    phone: "",
    delivery: input.delivery,
    source: input.source,
  });
  return id;
}

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
const onlineIds = new Set([lavkaLocationId, gagaLocationId]);

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

const nameIndex = buildNameIndex(catalog.products);

async function loadStock(productId: number): Promise<ProductStockItem[]> {
  try {
    const raw = JSON.parse(
      await readFile(path.join(productsDir, `${productId}.json`), "utf8"),
    ) as StockFile;
    return (raw.stock ?? []).filter(
      (item) => !onlineIds.has(item.locationId) && !oldOnlineIds.has(item.locationId),
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
      const stock = await loadStock(existing.id);
      const without = stock.filter(
        (item) => item.locationId !== input.locationId,
      );
      if (offer.available) {
        without.push({
          locationId: input.locationId,
          status: 1,
          statusText: "В наличии",
          url: offer.url,
        });
        if (!existing.availableLocationIds.includes(input.locationId)) {
          existing.availableLocationIds.push(input.locationId);
        }
        upsertOnlineOffer(existing, input.source, offer.url);
      }
      await saveStock(existing.id, without);
      continue;
    }

    added += 1;
    const catalogId = namespacedProductId(input.source, offer.id);
    const product: CatalogProduct = {
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
    catalog.products.push(product);
    if (key) nameIndex.set(key, product);
    await saveStock(
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
  `Lavka: ${lavkaProducts.length} scraped, ${lavkaStats.matched} matched, ${lavkaStats.added} added`,
);

const gagaProducts = await parseGagaPage();
const gagaStats = await mergeRetailer({
  source: "gaga",
  locationId: gagaLocationId,
  products: gagaProducts,
});
console.log(
  `GaGa: ${gagaProducts.length} scraped, ${gagaStats.matched} matched, ${gagaStats.added} added`,
);

catalog.last_updated = new Date().toISOString();
await writeFile(outFile, JSON.stringify(catalog, null, 2));
console.log(
  `Saved ${catalog.products.length} products, ${catalog.locations.length} locations → ${outFile}`,
);
