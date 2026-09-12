import * as cheerio from "cheerio";
import { fetchHtml } from "../fetch-html.js";
import type { ParsedRetailerProduct } from "../retailer-types.js";
import {
  ZNAEMIGRAEM_CATEGORY_URL,
  ZNAEMIGRAEM_PRODUCT_SELECTOR,
} from "./config.js";

function absoluteUrl(href: string, base: string): string {
  if (!href) return base;
  return href.startsWith("http") ? href : new URL(href, base).toString();
}

function parsePrice(text: string): number {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseProductId(cardId: string | undefined): number {
  if (!cardId) return 0;
  const match = /_(\d+)$/.exec(cardId);
  return match ? Number(match[1]) : 0;
}

function parseProducts(html: string, baseUrl: string): ParsedRetailerProduct[] {
  const $ = cheerio.load(html);
  const host = new URL(baseUrl).origin;

  return $(ZNAEMIGRAEM_PRODUCT_SELECTOR)
    .map((_, el) => {
      const card = $(el);
      const id = parseProductId(card.attr("id"));
      const link = card.find("a.name[href]").first();
      const href = link.attr("href") ?? card.find("a.image[href]").attr("href") ?? "";
      const img = card.find("img").first();
      const priceIn = card.find(".catalog-item__price:not(.catalog-item__price_out)").first();
      const priceOut = card.find(".catalog-item__price_out").first();
      const available = priceIn.length > 0;
      const priceText = (available ? priceIn : priceOut).text();

      return {
        id,
        price: parsePrice(priceText),
        name: link.text().replace(/\s+/g, " ").trim(),
        image: absoluteUrl(img.attr("src") ?? "", host),
        url: absoluteUrl(href, host),
        available,
      };
    })
    .get()
    .filter((p) => p.id > 0 && p.name.length > 0);
}

/** Bitrix catalog listing for Знаем Играем (single page with current filters). */
export async function parseZnaemigraemPage(
  url = ZNAEMIGRAEM_CATEGORY_URL,
): Promise<ParsedRetailerProduct[]> {
  const html = await fetchHtml(url);
  return parseProducts(html, url);
}
