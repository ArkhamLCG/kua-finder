import { Link } from "react-router-dom";
import {
  countAvailableCities,
  countAvailableStores,
  formatPrice,
} from "../lib/catalog";
import type { CatalogLocation, CatalogProduct } from "../types";

type Props = {
  product: CatalogProduct;
  available: boolean;
  locationsById: Map<number, CatalogLocation>;
  regionNames: Map<number, string>;
  regionId: number | null;
};

export function ProductCard({
  product,
  available,
  locationsById,
  regionNames,
  regionId,
}: Props) {
  const count =
    regionId == null
      ? countAvailableCities(product, locationsById, regionNames)
      : countAvailableStores(product, locationsById, regionId, regionNames);

  return (
    <Link
      to={`/product/${product.id}`}
      className={`product-card${available ? "" : " product-card--unavailable"}`}
    >
      <div className="product-card__media">
        {product.image ? (
          <img src={product.image} alt="" loading="lazy" />
        ) : (
          <div className="product-card__placeholder" aria-hidden />
        )}
      </div>
      <div className="product-card__body">
        <h2 className="product-card__title">{product.name}</h2>
        <p className="product-card__price">{formatPrice(product.price)}</p>
        <p
          className={`product-card__status${available ? " is-available" : " is-unavailable"}`}
        >
          {available
            ? regionId == null
              ? `В наличии · ${count} ${pluralCities(count)}`
              : `В наличии · ${count} ${pluralStores(count)}`
            : regionId == null
              ? "Нет в магазинах"
              : "Нет в этом городе"}
        </p>
      </div>
    </Link>
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
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "магазина";
  return "магазинов";
}
