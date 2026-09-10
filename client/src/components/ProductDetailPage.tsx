import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  formatPrice,
  formatQuantity,
  getAvailableCities,
  loadProductStock,
} from "../lib/catalog";
import { useCatalog } from "../hooks/useCatalog";
import type { ProductStockItem } from "../types";

export function ProductDetailPage() {
  const { productId } = useParams();
  const { products, locationsById, regionNames, isAvailable } = useCatalog();

  const id = Number(productId);
  const product = products.find((item) => item.id === id);

  const [stockStatus, setStockStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [stockError, setStockError] = useState<string | null>(null);
  const [stock, setStock] = useState<ProductStockItem[]>([]);
  const [expandedCities, setExpandedCities] = useState<Set<number>>(
    () => new Set(),
  );
  const [cityQuery, setCityQuery] = useState("");

  useEffect(() => {
    if (!product) return;

    let cancelled = false;
    setStockStatus("loading");
    setStockError(null);
    setExpandedCities(new Set());
    setCityQuery("");

    loadProductStock(product.id)
      .then((detail) => {
        if (cancelled) return;
        setStock(detail.stock);
        setStockStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStockError(err instanceof Error ? err.message : String(err));
        setStockStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [product]);

  const cities = useMemo(
    () =>
      stockStatus === "ready"
        ? getAvailableCities(stock, locationsById, regionNames)
        : [],
    [stockStatus, stock, locationsById, regionNames],
  );

  const filteredCities = useMemo(() => {
    const normalized = cityQuery.trim().toLowerCase();
    if (!normalized) return cities;
    return cities.filter((city) =>
      city.regionName.toLowerCase().includes(normalized),
    );
  }, [cities, cityQuery]);

  if (!product) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          ← К списку
        </Link>
        <p className="state">Товар не найден</p>
      </div>
    );
  }

  const available = isAvailable(product);

  return (
    <div className="page page--detail">
      <Link to="/" className="back-link">
        ← К списку
      </Link>

      <article className="detail">
        <div className="detail__media">
          {product.image ? (
            <img src={product.image} alt="" />
          ) : (
            <div className="product-card__placeholder" aria-hidden />
          )}
        </div>

        <div className="detail__info">
          <h1 className="detail__title">{product.name}</h1>
          <p className="detail__price">{formatPrice(product.price)}</p>
          <p
            className={`product-card__status${available ? " is-available" : " is-unavailable"}`}
          >
            {stockStatus === "loading"
              ? "Загрузка наличия…"
              : available
                ? `Есть в ${cities.length} ${pluralCities(cities.length)}`
                : "Нет в наличии в магазинах"}
          </p>
          <a
            className="detail__external"
            href={product.url}
            target="_blank"
            rel="noreferrer"
          >
            Открыть на Hobby Games
          </a>
        </div>
      </article>

      {stockStatus === "loading" && (
        <div className="detail-loader" role="status" aria-live="polite">
          <div className="loader__spinner" aria-hidden />
          <p className="state">Загрузка магазинов…</p>
        </div>
      )}

      {stockStatus === "error" && (
        <p className="state state--error">{stockError}</p>
      )}

      {stockStatus === "ready" && cities.length > 0 ? (
        <section className="availability">
          <h2 className="availability__title">Где есть в наличии</h2>
          <label className="search availability__search">
            <span className="visually-hidden">Фильтр по городу</span>
            <input
              type="search"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Название города…"
              autoComplete="off"
            />
          </label>

          {filteredCities.length === 0 ? (
            <p className="state">Город не найден</p>
          ) : (
            <ul className="city-list">
              {filteredCities.map((city) => {
                const open = expandedCities.has(city.regionId);
                return (
                  <li
                    key={city.regionId}
                    className={`city-block${open ? " city-block--open" : ""}`}
                  >
                    <button
                      type="button"
                      className="city-block__toggle"
                      aria-expanded={open}
                      onClick={() => {
                        setExpandedCities((prev) => {
                          const next = new Set(prev);
                          if (next.has(city.regionId)) {
                            next.delete(city.regionId);
                          } else {
                            next.add(city.regionId);
                          }
                          return next;
                        });
                      }}
                    >
                      <h3 className="city-block__name">
                        <span className="city-block__chevron" aria-hidden />
                        {city.regionName}
                        <span className="city-block__count">
                          {city.stores.length}
                        </span>
                      </h3>
                    </button>
                    {open ? (
                      <ul className="store-list">
                        {city.stores.map((store) => (
                          <li key={store.location.id} className="store-row">
                            <div className="store-row__info">
                              <p className="store-row__name">
                                {store.location.name}
                              </p>
                              {store.location.address ? (
                                <p className="store-row__address">
                                  {store.location.address}
                                </p>
                              ) : null}
                            </div>
                            <div className="store-row__meta">
                              <p className="store-row__status">
                                {formatQuantity(store.status)}
                              </p>
                              {store.location.phone ? (
                                <a
                                  className="store-row__phone-btn"
                                  href={`tel:${store.location.phone.replace(/[^\d+]/g, "")}`}
                                  aria-label={`Позвонить: ${store.location.phone}`}
                                  title={store.location.phone}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <PhoneIcon />
                                </a>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {stockStatus === "ready" && cities.length === 0 ? (
        <p className="state">Сейчас товар недоступен ни в одном магазине.</p>
      ) : null}
    </div>
  );
}

function pluralCities(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "городе";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "городах";
  }
  return "городах";
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.6 3.8c.5-.5 1.3-.6 1.9-.2l2.1 1.3c.6.4.8 1.1.5 1.8l-.8 1.7c-.2.4-.1.8.2 1.1l3.1 3.1c.3.3.7.4 1.1.2l1.7-.8c.6-.3 1.4-.1 1.8.5l1.3 2.1c.4.6.3 1.4-.2 1.9l-1.1 1.1c-.6.6-1.4.9-2.2.8-2-.2-4.8-1.5-7.5-4.2S4.7 9.3 4.5 7.3c-.1-.8.2-1.6.8-2.2l1.3-1.3Z" />
    </svg>
  );
}
