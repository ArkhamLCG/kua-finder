import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveRegionId } from "../services/parse/hobbygames/region/region-id.js";

type CatalogLocation = {
  id: number;
  regionId: number;
  name: string;
  address: string;
  phone?: string;
  delivery: boolean;
};

type ProductStockItem = {
  locationId: number;
  status: number;
  statusText: string;
};

type Region = { id: number; name: string };

const outDir = path.resolve("dist");
const outFile = path.join(outDir, "products.json");
const productsDir = path.join(outDir, "products");
const regionsFile = path.join(outDir, "regions.json");

const catalog = JSON.parse(await readFile(outFile, "utf8")) as {
  last_updated: string;
  locations: CatalogLocation[];
  products: Array<{
    id: number;
    price: number;
    name: string;
    image: string | null;
    url: string;
    availableLocationIds: number[];
  }>;
};

const regions = JSON.parse(await readFile(regionsFile, "utf8")) as Region[];

const oldToNew = new Map<number, number>();
const locations: CatalogLocation[] = [];
const keys = new Map<string, number>();

function keyOf(location: CatalogLocation, regionId: number): string {
  if (location.delivery) return `d\0${regionId}\0${location.name}`;
  return `s\0${location.name}\0${location.address}`;
}

for (const location of catalog.locations ?? []) {
  const regionId = location.delivery
    ? location.regionId
    : resolveRegionId(location.name, regions, location.regionId);
  const key = keyOf(location, regionId);
  let newId = keys.get(key);
  if (newId == null) {
    newId = locations.length + 1;
    keys.set(key, newId);
    locations.push({
      id: newId,
      regionId,
      name: location.name,
      address: location.address,
      phone: location.phone ?? "",
      delivery: location.delivery,
    });
  }
  oldToNew.set(location.id, newId);
}

function remapStock(stock: ProductStockItem[]): ProductStockItem[] {
  const byLocation = new Map<number, ProductStockItem>();
  for (const item of stock) {
    const locationId = oldToNew.get(item.locationId);
    if (locationId == null) continue;
    const prev = byLocation.get(locationId);
    if (!prev || item.status > prev.status) {
      byLocation.set(locationId, {
        locationId,
        status: item.status,
        statusText: item.statusText,
      });
    }
  }
  return [...byLocation.values()];
}

const products = catalog.products.map((product) => {
  const availableLocationIds = [
    ...new Set(
      product.availableLocationIds
        .map((id) => oldToNew.get(id))
        .filter((id): id is number => id != null),
    ),
  ];
  return { ...product, availableLocationIds };
});

await writeFile(
  outFile,
  JSON.stringify(
    {
      last_updated: catalog.last_updated,
      locations,
      products,
    },
    null,
    2,
  ),
);

const files = (await readdir(productsDir)).filter((name) =>
  name.endsWith(".json"),
);
for (const file of files) {
  const filePath = path.join(productsDir, file);
  const detail = JSON.parse(await readFile(filePath, "utf8")) as {
    id: number;
    last_updated: string;
    stock: ProductStockItem[];
  };
  detail.stock = remapStock(detail.stock ?? []);
  await writeFile(filePath, JSON.stringify(detail, null, 2));
}

console.log(
  `Repaired locations: ${catalog.locations.length} → ${locations.length}, products ${products.length}, details ${files.length}`,
);
