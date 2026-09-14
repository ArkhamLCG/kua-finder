#!/usr/bin/env node
/**
 * Downloads published catalog data from GitHub Pages into api/dist
 * so the client can rebuild without re-running API parsers.
 *
 * Env:
 *   PAGES_DATA_BASE_URL — e.g. https://arkhamlcg.github.io/kua-finder
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const apiDist = path.join(root, "api/dist");
const productsDir = path.join(apiDist, "products");

const baseUrl = (process.env.PAGES_DATA_BASE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) {
  console.error(
    "PAGES_DATA_BASE_URL is required (e.g. https://arkhamlcg.github.io/kua-finder)",
  );
  process.exit(1);
}

const concurrency = Number(process.env.PAGES_DATA_CONCURRENCY ?? 12);

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

await mkdir(productsDir, { recursive: true });

console.log(`Fetching catalog from ${baseUrl}/data/ …`);

const productsUrl = `${baseUrl}/data/products.json`;
const regionsUrl = `${baseUrl}/data/regions.json`;

let productsRaw;
try {
  productsRaw = await fetchBuffer(productsUrl);
} catch (error) {
  console.error(
    `Failed to download products.json from the live site.\n` +
      `Run the full “Deploy GitHub Pages” workflow once to publish data, then retry.\n` +
      String(error),
  );
  process.exit(1);
}

await writeFile(path.join(apiDist, "products.json"), productsRaw);
console.log("saved api/dist/products.json");

const regionsRaw = await fetchBuffer(regionsUrl);
await writeFile(path.join(apiDist, "regions.json"), regionsRaw);
console.log("saved api/dist/regions.json");

const catalog = JSON.parse(productsRaw.toString("utf8"));
const productIds = [
  ...new Set(
    (Array.isArray(catalog.products) ? catalog.products : [])
      .map((product) => product?.id)
      .filter((id) => id != null),
  ),
];

if (productIds.length === 0) {
  console.error("products.json has no products — aborting");
  process.exit(1);
}

console.log(`Downloading ${productIds.length} product detail files…`);

let failed = 0;
await mapPool(productIds, concurrency, async (id) => {
  const url = `${baseUrl}/data/products/${id}.json`;
  try {
    const body = await fetchBuffer(url);
    await writeFile(path.join(productsDir, `${id}.json`), body);
  } catch (error) {
    failed += 1;
    console.warn(`warn: ${id}.json — ${error.message}`);
  }
});

if (failed === productIds.length) {
  console.error("All product detail downloads failed — aborting");
  process.exit(1);
}

console.log(
  `done: ${productIds.length - failed}/${productIds.length} product files` +
    (failed ? ` (${failed} missing)` : ""),
);
