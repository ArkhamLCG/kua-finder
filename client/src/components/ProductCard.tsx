import { Link } from "react-router-dom";
import {
  countAvailableCities,
  countAvailableStores,
  formatListPrice,
  getListPrice,
  getRetailerBadges,
} from "../lib/catalog";
import type { CatalogProduct, CatalogRates, Country } from "../types";
import { RetailerIcon } from "./RetailerIcon";

type Props = {
  product: CatalogProduct;
  available: boolean;
  regionId: number | null;
  country: Country | null;
  rates?: CatalogRates;
};

export function ProductCard({
  product,
  available,
  regionId,
  country,
  rates,
}: Props) {
  const storeCount =
    regionId == null
      ? countAvailableCities(product, country)
      : countAvailableStores(product, regionId, country);

  const badges = getRetailerBadges(product, regionId, country);

  const hasStores = storeCount > 0;

  let statusText: string | null = null;
  if (hasStores) {
    statusText =
      regionId == null
        ? `${storeCount} ${pluralCities(storeCount)}`
        : `${storeCount} ${pluralStores(storeCount)}`;
  } else if (available) {
    statusText = "Есть онлайн";
  } else {
    statusText = "Нет в наличии";
  }

  const showSources = badges.length > 1;
  const listPrice = getListPrice(product, rates);

  return (
    <article
      className={`product-card${available ? "" : " product-card--unavailable"}`}
    >
      <Link to={`/product/${product.id}`} className="product-card__main">
        <div className="product-card__media">
          {product.image ? (
            <img src={product.image} alt="" loading="lazy" />
          ) : (
            <div className="product-card__placeholder" aria-hidden />
          )}
        </div>
        <div className="product-card__body">
          <h2 className="product-card__title">{product.name}</h2>
          <p className="product-card__price">{formatListPrice(listPrice)}</p>
        </div>
      </Link>

      {statusText || showSources ? (
        <div
          className={`product-card__meta${available ? " is-available" : " is-unavailable"}`}
        >
          {statusText ? (
            <span className="product-card__status">{statusText}</span>
          ) : null}
          {showSources ? (
            <ul className="product-card__retailers" aria-label="Магазины">
              {badges.map((badge) => (
                <li key={badge.source} className="product-card__retailer">
                  <a
                    className="retailer-badge"
                    href={badge.url}
                    target="_blank"
                    rel="noreferrer"
                    title={badge.name}
                    aria-label={badge.name}
                  >
                    <RetailerIcon source={badge.source} />
                    <span className="retailer-badge__label">{badge.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function pluralCities(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "город";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "города";
  return "городов";
}

function pluralStores(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "магазин";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "магазина";
  }
  return "магазинов";
}
