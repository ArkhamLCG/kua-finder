import * as cheerio from "cheerio";
import { CATEGORY_URL } from "../../../../config.js";

export type ParsedShop = {
  id: number;
  name: string;
  address: string;
  phone: string;
};

type MapPoint = {
  id?: number;
  name?: string;
  hidden?: {
    title?: string;
    address?: string;
  };
  properties?: {
    content?: string;
  };
};

function parsePhoneFromContent(html: string): string {
  const $ = cheerio.load(html);
  return $(".stock-phone").first().text().replace(/\s+/g, " ").trim();
}

function plainText(value: string): string {
  return cheerio.load(`<div>${value}</div>`)("div").text().replace(/\s+/g, " ").trim();
}

export async function parseShops(
  origin = new URL(CATEGORY_URL).origin,
): Promise<ParsedShop[]> {
  const mapUrl = `${origin}/?route=information/contact/map`;
  const res = await fetch(mapUrl, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch shops map: ${res.status}`);
  }

  const data = (await res.json()) as { points?: MapPoint[] };
  const shops: ParsedShop[] = [];

  for (const point of data.points ?? []) {
    const name = (point.hidden?.title ?? point.name ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) continue;

    shops.push({
      id: Number(point.id ?? 0),
      name,
      address: plainText(point.hidden?.address ?? ""),
      phone: parsePhoneFromContent(point.properties?.content ?? ""),
    });
  }

  return shops;
}

export function buildShopPhoneMap(shops: ParsedShop[]): Map<string, string> {
  const phones = new Map<string, string>();
  for (const shop of shops) {
    if (!shop.phone) continue;
    phones.set(shop.name, shop.phone);
  }
  return phones;
}
