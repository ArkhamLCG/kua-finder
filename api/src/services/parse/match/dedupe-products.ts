import { unlink } from "node:fs/promises";
import path from "node:path";
import {
  dedupeByMatchKey,
  type DedupeMerge,
} from "../match/normalize-name.js";

type DedupeProduct = {
  id: number;
  name: string;
  availableLocationIds: number[];
  onlineOffers?: unknown[];
  priceOffers?: unknown[];
};

type StockItem = {
  locationId: number;
  status: number;
  statusText: string;
  url?: string;
};

/**
 * Collapse reprint/year duplicates and merge their stock into the kept product.
 */
export async function dedupeCatalogProducts<T extends DedupeProduct>(input: {
  products: T[];
  productsDir: string;
  loadStock: (productId: number) => Promise<StockItem[]>;
  saveStock: (productId: number, stock: StockItem[]) => Promise<void>;
}): Promise<{ products: T[]; removed: number }> {
  const { products, merges } = dedupeByMatchKey(input.products);
  if (merges.length === 0) {
    return { products: input.products, removed: 0 };
  }

  const droppedIds = new Set(merges.map((merge) => merge.dropped.id));

  for (const merge of merges as DedupeMerge<T>[]) {
    await mergeDuplicateStock(merge, input);
  }

  for (const droppedId of droppedIds) {
    if (products.some((product) => product.id === droppedId)) continue;
    try {
      await unlink(path.join(input.productsDir, `${droppedId}.json`));
    } catch {
      // missing stock file is fine
    }
  }

  return { products, removed: droppedIds.size };
}

async function mergeDuplicateStock<T extends DedupeProduct>(
  merge: DedupeMerge<T>,
  input: {
    loadStock: (productId: number) => Promise<StockItem[]>;
    saveStock: (productId: number, stock: StockItem[]) => Promise<void>;
  },
): Promise<void> {
  const { kept, dropped } = merge;
  if (kept.id === dropped.id) return;

  const [keptStock, droppedStock] = await Promise.all([
    input.loadStock(kept.id),
    input.loadStock(dropped.id),
  ]);

  const byLocation = new Map<number, StockItem>();
  for (const item of [...keptStock, ...droppedStock]) {
    const prev = byLocation.get(item.locationId);
    if (!prev || item.status > prev.status) {
      byLocation.set(item.locationId, item);
    }
  }

  kept.availableLocationIds = [
    ...new Set([
      ...kept.availableLocationIds,
      ...dropped.availableLocationIds,
      ...[...byLocation.values()]
        .filter((item) => item.status > 0)
        .map((item) => item.locationId),
    ]),
  ];

  const keptOnline = [...(kept.onlineOffers ?? [])];
  for (const offer of dropped.onlineOffers ?? []) {
    keptOnline.push(offer);
  }
  kept.onlineOffers = keptOnline;

  const keptPrices = [...(kept.priceOffers ?? [])];
  for (const offer of dropped.priceOffers ?? []) {
    keptPrices.push(offer);
  }
  kept.priceOffers = keptPrices;

  await input.saveStock(kept.id, [...byLocation.values()]);
}
