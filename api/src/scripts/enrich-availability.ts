import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  enrichCatalogAvailability,
  type EnrichCatalogFile,
} from "../services/parse/availability/enrich-catalog.js";

const outDir = path.resolve("dist");
const outFile = path.join(outDir, "products.json");
const productsDir = path.join(outDir, "products");
const regionsFile = path.join(outDir, "regions.json");

const catalog = JSON.parse(await readFile(outFile, "utf8")) as EnrichCatalogFile;
const regions = JSON.parse(await readFile(regionsFile, "utf8")) as {
  id: number;
  name: string;
}[];

const stats = await enrichCatalogAvailability({
  catalog,
  regions,
  productsDir,
});

catalog.last_updated = new Date().toISOString();
await writeFile(outFile, JSON.stringify(catalog, null, 2));

console.log(
  `Enriched ${stats.productsEnriched} products, ${stats.cities} cities → ${outFile}`,
);
