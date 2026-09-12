import * as cheerio from "cheerio";
import {
  CATEGORY_URL,
  STOCK_ADDRESS_SELECTOR,
  STOCK_DELIVERY_CLASS,
  STOCK_ITEM_SELECTOR,
  STOCK_STATUS_SELECTOR,
  STOCK_TITLE_SELECTOR,
} from "../../../../config.js";
import { parseRegions } from "../region/region-parser.js";

const DEFAULT_ORIGIN = new URL(CATEGORY_URL).origin;

export type StockLocation = {
  name: string;
  address: string;
  status: number;
  statusText: string;
  delivery: boolean;
};

export type ParsedProductStock = {
  id: number;
  regionId: number | null;
  regionName?: string;
  locations: StockLocation[];
};

export type ParsedProductStockAll = {
  id: number;
  regions: ParsedProductStock[];
};

export type ParseProductOptions = {
  /** HobbyGames site origin (ru / by / kz). Defaults to CATEGORY_URL host. */
  origin?: string;
};

function stockUrls(origin: string) {
  return {
    stock: `${origin}/?route=common/blocks/index`,
    setRegion: `${origin}/?route=lib/common/setRegion`,
  };
}

function parseStockHtml(html: string): StockLocation[] {
  const $ = cheerio.load(html);

  return $(STOCK_ITEM_SELECTOR)
    .map((_, el) => {
      const item = $(el);
      const statusEl = item.find(STOCK_STATUS_SELECTOR).first();
      const statusClass = statusEl.attr("class") ?? "";
      const status = Number(/stock-status-(\d+)/.exec(statusClass)?.[1] ?? 0);

      return {
        name: item.find(STOCK_TITLE_SELECTOR).text().replace(/\s+/g, " ").trim(),
        address: item
          .find(STOCK_ADDRESS_SELECTOR)
          .text()
          .replace(/\s+/g, " ")
          .trim(),
        status,
        statusText: statusEl.attr("title") ?? "",
        delivery: item.hasClass(STOCK_DELIVERY_CLASS),
      };
    })
    .get()
    .filter((location) => location.name.length > 0);
}

async function sessionForRegion(
  origin: string,
  regionId: number,
  tries = 3,
): Promise<string> {
  const { setRegion } = stockUrls(origin);
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const res = await fetch(setRegion, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-requested-with": "XMLHttpRequest",
      },
      body: `region_id=${regionId}`,
    });

    const cookie = res.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .find((value) => value?.startsWith("PHPSESSID="));

    if (cookie) return cookie;

    lastError = new Error(`Failed to set region ${regionId}: no session cookie`);
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }

  throw lastError;
}

export async function parseProduct(
  id: number,
  regionId?: number,
  options: ParseProductOptions = {},
): Promise<ParsedProductStock> {
  const origin = options.origin ?? DEFAULT_ORIGIN;
  const { stock: stockUrl } = stockUrls(origin);
  const headers: Record<string, string> = { accept: "application/json" };

  if (regionId != null) {
    headers.cookie = await sessionForRegion(origin, regionId);
  }

  const res = await fetch(`${stockUrl}&blocks[]=stock&product_id=${id}`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch stock for ${id}: ${res.status}`);
  }

  const data = (await res.json()) as {
    stock?: string;
    selected_region_id?: number;
  };

  if (!data.stock) {
    throw new Error(`No stock data for product ${id}`);
  }

  return {
    id,
    regionId: data.selected_region_id ?? regionId ?? null,
    locations: parseStockHtml(data.stock),
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  let failed: unknown;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        if (failed) return;

        const index = next;
        next += 1;

        try {
          results[index] = await worker(items[index] as T, index);
          done += 1;
          if (!failed) onProgress?.(done, items.length);
        } catch (error) {
          failed = error;
          throw error;
        }
      }
    }),
  );

  if (failed) throw failed;
  return results;
}

/** HobbyGames stock is region-scoped; fetches all regions in parallel. */
export async function parseProductAll(
  id: number,
  concurrency = 8,
  regions?: Awaited<ReturnType<typeof parseRegions>>,
  onProgress?: (done: number, total: number) => void,
  options: ParseProductOptions = {},
): Promise<ParsedProductStockAll> {
  const regionList = regions ?? (await parseRegions());
  const stocks = await mapPool(
    regionList,
    concurrency,
    async (region) => {
      try {
        const stock = await parseProduct(id, region.id, options);
        return {
          ...stock,
          regionName: region.name,
        };
      } catch {
        return {
          id,
          regionId: region.id,
          regionName: region.name,
          locations: [],
        };
      }
    },
    onProgress,
  );

  return {
    id,
    regions: stocks.sort((a, b) => (a.regionId ?? 0) - (b.regionId ?? 0)),
  };
}
