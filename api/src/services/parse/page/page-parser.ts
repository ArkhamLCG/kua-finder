import * as cheerio from "cheerio";
import { PRODUCT_SELECTOR } from "../../../config.js";

export type ParsedProduct = {
  id: number;
  price: number;
  name: string;
  image: string | null;
  url: string;
};

function absoluteUrl(href: string, base: string): string {
  if (!href) return base;
  return href.startsWith("http") ? href : new URL(href, base).toString();
}

function parseProducts(html: string, baseUrl: string): ParsedProduct[] {
  const $ = cheerio.load(html);

  return $(PRODUCT_SELECTOR)
    .map((_, el) => {
      const card = $(el);
      const img = card.find("img").first();
      const href = card.find("a[href]").first().attr("href") ?? "";

      return {
        id: Number(card.attr("data-product_id")),
        price: Number(card.attr("data-price") ?? 0),
        name: img.attr("data-product-name") ?? img.attr("alt") ?? "",
        image: img.attr("src") ?? null,
        url: absoluteUrl(href, baseUrl),
      };
    })
    .get()
    .filter((p) => p.id > 0);
}

function parseMeta(html: string): { page: number; totalPages: number } {
  const block = /"results"\s*:\s*\{[^}]+\}/.exec(html)?.[0] ?? "";
  return {
    page: Number(/"page"\s*:\s*(\d+)/.exec(block)?.[1] ?? 1),
    totalPages: Number(/"total_pages"\s*:\s*(\d+)/.exec(block)?.[1] ?? 1),
  };
}

export async function parsePage(url: string): Promise<ParsedProduct[]> {
  const products: ParsedProduct[] = [];
  const seen = new Set<number>();
  let page = 1;
  let totalPages = Number.POSITIVE_INFINITY;

  while (page <= totalPages) {
    const pageUrl = page === 1 ? url : `${url}${url.includes("?") ? "&" : "?"}page=${page}`;
    const res = await fetch(pageUrl);
    if (!res.ok) throw new Error(`Failed to fetch ${pageUrl}: ${res.status}`);

    const html = await res.text();
    const meta = parseMeta(html);
    const batch = parseProducts(html, url);

    // сайт иногда отдаёт чужую выдачу, если page за пределами категории
    if (meta.page !== page || batch.length === 0) break;

    totalPages = meta.totalPages;

    for (const product of batch) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      products.push(product);
    }

    page += 1;
  }

  return products;
}
