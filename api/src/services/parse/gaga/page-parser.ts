import * as cheerio from "cheerio";
import { fetchHtml } from "../fetch-html.js";
import type { ParsedRetailerProduct } from "../retailer-types.js";
import {
  GAGA_BUY_SELECTOR,
  GAGA_CATEGORY_URL,
  GAGA_PRODUCT_SELECTOR,
  GAGA_WAITLIST_SELECTOR,
} from "./config.js";

function absoluteUrl(href: string, base: string): string {
  if (!href) return base;
  return href.startsWith("http") ? href : new URL(href, base).toString();
}

function parseTotalPages(html: string, currentPage: number): number {
  const pages = [...html.matchAll(/(?:[?&]|amp;)page=(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  if (pages.length === 0) return currentPage;
  const max = Math.max(currentPage, ...pages);
  return Number.isFinite(max) ? max : currentPage;
}

function parseProducts(html: string, baseUrl: string): ParsedRetailerProduct[] {
  const $ = cheerio.load(html);
  const host = new URL(baseUrl).origin;

  return $(GAGA_PRODUCT_SELECTOR)
    .map((_, el) => {
      const card = $(el);
      const buy = card.find(GAGA_BUY_SELECTOR).first();
      const wait = card.find(GAGA_WAITLIST_SELECTOR).first();
      const id = Number(
        buy.attr("data-gid") ?? wait.attr("data-gid") ?? 0,
      );
      const titleLink = card.find(".preview-card__title a[href]").first();
      const href = titleLink.attr("href") ?? "";
      const img = card.find("img").first();
      const imageSrc = img.attr("src") ?? null;
      const priceText =
        buy.attr("data-price") ??
        card.find('[itemprop="price"]').last().text() ??
        "0";

      return {
        id,
        price: Number(String(priceText).replace(/[^\d]/g, "")) || 0,
        name: (
          buy.attr("data-name") ??
          wait.attr("data-name") ??
          titleLink.text()
        )
          .replace(/\s+/g, " ")
          .trim(),
        image: imageSrc ? absoluteUrl(imageSrc, host) : null,
        url: absoluteUrl(href, host),
        available: buy.length > 0,
      };
    })
    .get()
    .filter((p) => p.id > 0 && p.name.length > 0);
}

export async function parseGagaPage(
  url: string = GAGA_CATEGORY_URL,
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
