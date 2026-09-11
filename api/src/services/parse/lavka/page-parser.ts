import * as cheerio from "cheerio";
import { fetchHtml } from "../fetch-html.js";
import type { ParsedRetailerProduct } from "../retailer-types.js";
import {
  LAVKA_ALERT_SELECTOR,
  LAVKA_BUY_SELECTOR,
  LAVKA_CATEGORY_URL,
  LAVKA_PRODUCT_SELECTOR,
} from "./config.js";

function absoluteUrl(href: string, base: string): string {
  if (!href) return base;
  return href.startsWith("http") ? href : new URL(href, base).toString();
}

function parsePrice(text: string): number {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseTotalPages(html: string, currentPage: number): number {
  const pages = [...html.matchAll(/(?:[?&]|amp;)page=(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  const max = Math.max(currentPage, ...pages, 1);
  return Number.isFinite(max) ? max : currentPage;
}

function parseProducts(html: string, baseUrl: string): ParsedRetailerProduct[] {
  const $ = cheerio.load(html);
  const host = new URL(baseUrl).origin;

  return $(LAVKA_PRODUCT_SELECTOR)
    .map((_, el) => {
      const card = $(el);
      const id = Number(
        card.find(".photo-block").attr("data-id") ??
          card.find(LAVKA_BUY_SELECTOR).attr("data-id") ??
          card.find(LAVKA_ALERT_SELECTOR).attr("data-id") ??
          0,
      );
      const link = card.find("a.game-name[href], a.photo[href], a.more[href]")
        .first();
      const href = link.attr("href") ?? "";
      const img = card.find("img").first();
      const imageSrc =
        img.attr("data-src") ?? img.attr("src") ?? null;
      const buyPrice = Number(
        card.find(LAVKA_BUY_SELECTOR).attr("data-price") ?? 0,
      );

      return {
        id,
        price: buyPrice || parsePrice(card.find("p.price").text()),
        name: card.find("a.game-name").text().replace(/\s+/g, " ").trim(),
        image: imageSrc ? absoluteUrl(imageSrc, host) : null,
        url: absoluteUrl(href, host),
        available: card.find(LAVKA_BUY_SELECTOR).length > 0,
      };
    })
    .get()
    .filter((p) => p.id > 0 && p.name.length > 0);
}

export async function parseLavkaPage(
  url: string = LAVKA_CATEGORY_URL,
): Promise<ParsedRetailerProduct[]> {
  const products: ParsedRetailerProduct[] = [];
  const seen = new Set<number>();
  let page = 1;
  let totalPages = Number.POSITIVE_INFINITY;

  while (page <= totalPages) {
    const pageUrl =
      page === 1
        ? url
        : `${url}${url.includes("?") ? "&" : "?"}page=${page}`;
    const html = await fetchHtml(pageUrl);
    const batch = parseProducts(html, url);
    if (batch.length === 0) break;

    totalPages = parseTotalPages(html, page);

    let added = 0;
    for (const product of batch) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      products.push(product);
      added += 1;
    }
    if (added === 0) break;

    page += 1;
  }

  return products;
}
