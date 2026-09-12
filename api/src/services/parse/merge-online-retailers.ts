import type {
  CatalogSource,
  Country,
  Currency,
  OnlineRetailerSource,
  ParsedRetailerProduct,
} from "./retailer-types.js";
import {
  countryForSource,
  currencyForCountry,
  namespacedProductId,
} from "./retailer-types.js";
import { findMatchByName, matchKey } from "./match/normalize-name.js";
import { isExcludedProductName } from "./match/exclude-name.js";

export type MergeLocation = {
  id: number;
  regionId: number;
  name: string;
  address: string;
  phone: string;
  delivery: boolean;
  source?: CatalogSource;
  country?: Country;
  currency?: Currency;
};

export type MergeStockItem = {
  locationId: number;
  status: number;
  statusText: string;
  url?: string;
};

export type MergePriceOffer = {
  source: OnlineRetailerSource;
  country: Country;
  currency: Currency;
  amount: number;
  url: string;
};

export type MergeProduct = {
  id: number;
  price: number;
  name: string;
  image: string | null;
  url: string;
  availableLocationIds: number[];
  currency?: Currency;
  onlineOffers?: { source: OnlineRetailerSource; url: string }[];
  priceOffers?: MergePriceOffer[];
};

export type MergeRetailerInput = {
  source: OnlineRetailerSource;
  locationId: number;
  country: Country;
  currency: Currency;
  products: ParsedRetailerProduct[];
  /** When true, scrape availability from ParsedRetailerProduct.available. */
  useAvailableFlag: boolean;
};

export async function mergeOnlineRetailer(input: {
  retailer: MergeRetailerInput;
  products: MergeProduct[];
  nameIndex: Map<string, MergeProduct>;
  loadStock: (productId: number) => Promise<MergeStockItem[]>;
  saveStock: (productId: number, stock: MergeStockItem[]) => Promise<void>;
}): Promise<{ matched: number; added: number }> {
  const { retailer, nameIndex } = input;
  let matched = 0;
  let added = 0;

  const upsertOnlineOffer = (product: MergeProduct, url: string) => {
    const offers = [...(product.onlineOffers ?? [])].filter(
      (offer) => offer.source !== retailer.source,
    );
    offers.push({ source: retailer.source, url });
    product.onlineOffers = offers;
  };

  const upsertPriceOffer = (
    product: MergeProduct,
    amount: number,
    url: string,
  ) => {
    const offers = [...(product.priceOffers ?? [])].filter(
      (offer) => offer.source !== retailer.source,
    );
    offers.push({
      source: retailer.source,
      country: retailer.country,
      currency: retailer.currency,
      amount,
      url,
    });
    product.priceOffers = offers;
  };

  for (const offer of retailer.products) {
    if (isExcludedProductName(offer.name)) continue;

    const existing = findMatchByName(offer.name, input.products, nameIndex);
    const available = retailer.useAvailableFlag ? offer.available : true;

    if (existing) {
      matched += 1;
      const stock = await input.loadStock(existing.id);
      const without = stock.filter(
        (item) => item.locationId !== retailer.locationId,
      );

      if (available) {
        without.push({
          locationId: retailer.locationId,
          status: 1,
          statusText: "В наличии",
          url: offer.url,
        });
        if (!existing.availableLocationIds.includes(retailer.locationId)) {
          existing.availableLocationIds = [
            ...existing.availableLocationIds,
            retailer.locationId,
          ];
        }
        upsertOnlineOffer(existing, offer.url);
        upsertPriceOffer(existing, offer.price, offer.url);
      } else {
        existing.availableLocationIds = existing.availableLocationIds.filter(
          (id) => id !== retailer.locationId,
        );
        existing.onlineOffers = (existing.onlineOffers ?? []).filter(
          (o) => o.source !== retailer.source,
        );
        existing.priceOffers = (existing.priceOffers ?? []).filter(
          (o) => o.source !== retailer.source,
        );
      }

      await input.saveStock(existing.id, without);
      continue;
    }

    added += 1;
    const catalogId = namespacedProductId(retailer.source, offer.id);
    const product: MergeProduct = {
      id: catalogId,
      price: offer.price,
      currency: retailer.currency,
      name: offer.name,
      image: offer.image,
      url: offer.url,
      availableLocationIds: available ? [retailer.locationId] : [],
      onlineOffers: available
        ? [{ source: retailer.source, url: offer.url }]
        : [],
      priceOffers: available
        ? [
            {
              source: retailer.source,
              country: retailer.country,
              currency: retailer.currency,
              amount: offer.price,
              url: offer.url,
            },
          ]
        : [],
    };
    input.products.push(product);
    const key = matchKey(offer.name);
    if (key) nameIndex.set(key, product);
    await input.saveStock(
      catalogId,
      available
        ? [
            {
              locationId: retailer.locationId,
              status: 1,
              statusText: "В наличии",
              url: offer.url,
            },
          ]
        : [],
    );
  }

  return { matched, added };
}

export function onlineLocationDefaults(source: OnlineRetailerSource): {
  country: Country;
  currency: Currency;
  name: string;
  address: string;
} {
  const country = countryForSource(source);
  const currency = currencyForCountry(country);
  const names: Record<OnlineRetailerSource, string> = {
    lavka: "Лавка игр",
    gaga: "GaGa",
    znaemigraem: "Знаем Играем",
    hobbygames_by: "Hobby Games Беларусь",
    hobbygames_kz: "Hobby Games Казахстан",
  };
  return {
    country,
    currency,
    name: names[source],
    address: "Онлайн-доставка",
  };
}
