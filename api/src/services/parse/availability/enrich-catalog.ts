import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildAvailability,
  buildCatalogCities,
  type AvailabilityCountry,
  type AvailabilityLocation,
  type AvailabilityOnline,
  type AvailabilityProduct,
  type AvailabilityStockItem,
  type CatalogCity,
  type ProductAvailabilitySummary,
} from "./build-availability.js";
import type { CatalogRates } from "../retailer-types.js";

export type EnrichCatalogProduct = AvailabilityProduct & {
  id: number;
  name: string;
  image: string | null;
  availableLocationIds: number[];
  availability?: ProductAvailabilitySummary;
};

export type EnrichCatalogFile = {
  last_updated: string;
  rates?: CatalogRates;
  cities?: CatalogCity[];
  locations: AvailabilityLocation[];
  products: EnrichCatalogProduct[];
};

export type EnrichStockFile = {
  id: number;
  last_updated: string;
  stock: AvailabilityStockItem[];
  countries?: AvailabilityCountry[];
  online?: AvailabilityOnline[];
};

export async function enrichCatalogAvailability(input: {
  catalog: EnrichCatalogFile;
  regions: { id: number; name: string }[];
  productsDir: string;
}): Promise<{ productsEnriched: number; cities: number }> {
  const { catalog, regions, productsDir } = input;
  const locationsById = new Map(
    catalog.locations.map((location) => [location.id, location]),
  );
  const regionNames = new Map(regions.map((region) => [region.id, region.name]));

  catalog.cities = buildCatalogCities(catalog.locations, regionNames);

  let productsEnriched = 0;
  const files = await readdir(productsDir);
  const stockFiles = new Set(
    files.filter((name) => name.endsWith(".json")).map((name) => name),
  );

  for (const product of catalog.products) {
    const fileName = `${product.id}.json`;
    let stock: AvailabilityStockItem[] = [];
    let lastUpdated = catalog.last_updated;

    if (stockFiles.has(fileName)) {
      const raw = JSON.parse(
        await readFile(path.join(productsDir, fileName), "utf8"),
      ) as EnrichStockFile;
      stock = raw.stock ?? [];
      lastUpdated = raw.last_updated ?? lastUpdated;
    }

    const built = buildAvailability({
      stock,
      locationsById,
      regionNames,
      product,
    });

    product.availability = built.summary;

    const detail: EnrichStockFile = {
      id: product.id,
      last_updated: lastUpdated,
      stock,
      countries: built.countries,
      online: built.online,
    };

    await writeFile(
      path.join(productsDir, fileName),
      JSON.stringify(detail, null, 2),
    );
    productsEnriched += 1;
  }

  return { productsEnriched, cities: catalog.cities.length };
}
