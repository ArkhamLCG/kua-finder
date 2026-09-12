import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  formatListPrice,
  formatPrice,
  formatQuantity,
  formatStockLabel,
  getListPrice,
  loadProductStock,
  productHasStock,
} from "../lib/catalog";
import { CATALOG_DISCLAIMER } from "../lib/disclaimer";
import { useCatalog } from "../hooks/useCatalog";
import { useCatalogFilters } from "../hooks/useCatalogFilters";
import type {
  AvailabilityCity,
  AvailabilityCountry,
  AvailabilityOnline,
  AvailabilityStore,
  CatalogProduct,
  Country,
} from "../types";

export function ProductDetailPage() {
  const { productId } = useParams();
  const { products, catalog } = useCatalog();
  const { country, regionId } = useCatalogFilters();

  const id = Number(productId);
  const product = products.find((item) => item.id === id);

  const [stockStatus, setStockStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [stockError, setStockError] = useState<string | null>(null);
  const [countries, setCountries] = useState<AvailabilityCountry[]>([]);
  const [onlineOffers, setOnlineOffers] = useState<AvailabilityOnline[]>([]);
  const [expandedCountries, setExpandedCountries] = useState<Set<Country>>(
    () => new Set(),
  );
  const [expandedCities, setExpandedCities] = useState<Set<number>>(
    () => new Set(),
  );
  const [cityQuery, setCityQuery] = useState("");

  useEffect(() => {
    if (!product) return;

    let cancelled = false;
    setStockStatus("loading");
    setStockError(null);
    setExpandedCountries(new Set());
    setExpandedCities(new Set());
    setCityQuery("");

    loadProductStock(product.id)
      .then((detail) => {
        if (cancelled) return;
        setCountries(detail.countries);
        setOnlineOffers(detail.online);
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

  const filteredCountries = useMemo(() => {
    let next = countries;

    if (country != null) {
      next = next.filter((group) => group.country === country);
    }

    if (regionId != null) {
      next = next
        .map((group) => ({
          ...group,
          cities: group.cities.filter((city) => city.regionId === regionId),
        }))
        .filter((group) => group.cities.length > 0);
    }

    const normalized = cityQuery.trim().toLowerCase();
    if (!normalized) return next;

    return next
      .map((group) => ({
        ...group,
        cities: group.cities.filter(
          (city) =>
            city.regionName.toLowerCase().includes(normalized) ||
            group.countryName.toLowerCase().includes(normalized),
        ),
      }))
      .filter((group) => group.cities.length > 0);
  }, [countries, country, regionId, cityQuery]);

  const filteredOnline = useMemo(() => {
    if (country == null) return onlineOffers;
    return onlineOffers.filter(
      (offer) => onlineOfferCountry(offer.source) === country,
    );
  }, [onlineOffers, country]);

  const layout = useMemo(
    () => resolveStoreLayout(filteredCountries),
    [filteredCountries],
  );

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

  const available = productHasStock(product, regionId, country);
  const listPrice = getListPrice(product, catalog?.rates);
  const cityCount = filteredCountries.reduce(
    (sum, group) => sum + group.cities.length,
    0,
  );
  const storeCount = filteredCountries.reduce(
    (sum, group) =>
      sum + group.cities.reduce((inner, city) => inner + city.stores.length, 0),
    0,
  );
  const statusSummary =
    stockStatus === "loading"
      ? "Загрузка наличия…"
      : available
        ? summarizeAvailability({
            cityCount,
            storeCount,
            onlineCount: filteredOnline.length,
            regionId,
          })
        : "Нет в наличии";

  const showCitySearch =
    regionId == null &&
    layout.mode !== "empty" &&
    layout.mode !== "single-store" &&
    (layout.mode === "multi-country" ||
      (layout.mode === "single-country" && layout.cities.length > 1));

  const singleCountryLink =
    layout.mode === "single-country" && filteredCountries[0]
      ? {
          url: countryProductUrl(filteredCountries[0], product),
          country: filteredCountries[0].country,
        }
      : null;

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
          <p className="detail__price">{formatListPrice(listPrice)}</p>
          <p
            className={`product-card__status${available ? " is-available" : " is-unavailable"}`}
          >
            {statusSummary}
          </p>
          <a
            className="detail__external"
            href={product.url}
            target="_blank"
            rel="noreferrer"
          >
            {externalLinkLabel(product.url)}
          </a>
        </div>
      </article>

      <p className="detail__disclaimer">{CATALOG_DISCLAIMER}</p>

      {stockStatus === "loading" && (
        <div className="detail-loader" role="status" aria-live="polite">
          <div className="loader__spinner" aria-hidden />
          <p className="state">Загрузка наличия…</p>
        </div>
      )}

      {stockStatus === "error" && (
        <p className="state state--error">{stockError}</p>
      )}

      {stockStatus === "ready" && filteredOnline.length > 0 ? (
        <section className="availability availability--online">
          <h2 className="availability__title">Онлайн</h2>
          <ul className="online-list">
            {filteredOnline.map((offer) => (
              <li key={offer.locationId} className="online-row">
                <div className="online-row__info">
                  <p className="online-row__name">{offer.name}</p>
                  <p className="online-row__status">
                    {formatStockLabel(offer.status, true)}
                    {offer.price != null
                      ? ` · ${formatPrice(offer.price, offer.currency)}`
                      : ` · ${offer.currency}`}
                  </p>
                </div>
                {offer.url ? (
                  <a
                    className="detail__external online-row__link"
                    href={offer.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {onlineLinkLabel(offer.source, offer.name)}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stockStatus === "ready" &&
      (country != null || regionId != null || countries.length > 0) ? (
        <section className="availability">
          <h2 className="availability__title">Магазины Hobby Games</h2>
          {showCitySearch ? (
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
          ) : null}

          {layout.mode === "empty" ? (
            <p className="state">
              {regionId != null || country != null
                ? "В выбранном регионе не найдено"
                : cityQuery.trim()
                  ? "Город не найден"
                  : "Сейчас товар нигде не найден в наличии."}
            </p>
          ) : null}

          {layout.mode === "single-store" ? (
            <>
              <p className="availability__note">{layout.note}</p>
              <ul className="store-list">
                <StoreRow store={layout.store} />
              </ul>
            </>
          ) : null}

          {layout.mode === "single-country" ? (
            <>
              <p className="availability__note">
                {layout.note}
                {singleCountryLink?.url ? (
                  <>
                    {" · "}
                    <a
                      className="city-block__product-link"
                      href={singleCountryLink.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {countryProductLinkLabel(singleCountryLink.country)}
                    </a>
                  </>
                ) : null}
              </p>
              {layout.cities.length === 1 ? (
                <ul className="store-list">
                  {layout.cities[0]!.stores.map((store) => (
                    <StoreRow key={store.locationId} store={store} />
                  ))}
                </ul>
              ) : (
                <CityAccordionList
                  cities={layout.cities}
                  expandedCities={expandedCities}
                  setExpandedCities={setExpandedCities}
                />
              )}
            </>
          ) : null}

          {layout.mode === "multi-country" ? (
            <ul className="city-list">
              {layout.countries.map((group) => {
                const countryOpen = expandedCountries.has(group.country);
                const countryStoreCount = group.cities.reduce(
                  (sum, city) => sum + city.stores.length,
                  0,
                );
                const countryQty = group.cities.reduce(
                  (sum, city) =>
                    sum +
                    city.stores.reduce(
                      (inner, store) => inner + Math.max(0, store.status),
                      0,
                    ),
                  0,
                );
                const productUrl = countryProductUrl(group, product);
                const toggleCountry = () => {
                  setExpandedCountries((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.country)) {
                      next.delete(group.country);
                    } else {
                      next.add(group.country);
                    }
                    return next;
                  });
                };

                return (
                  <li
                    key={group.country}
                    className={`city-block city-block--country${countryOpen ? " city-block--open" : ""}`}
                  >
                    <div
                      className="city-block__toggle"
                      role="button"
                      tabIndex={0}
                      aria-expanded={countryOpen}
                      onClick={toggleCountry}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleCountry();
                        }
                      }}
                    >
                      <h3 className="city-block__name">
                        <span className="city-block__chevron" aria-hidden />
                        <span className="city-block__title">
                          {group.countryName}
                          {productUrl ? (
                            <a
                              className="city-block__product-link"
                              href={productUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              {countryProductLinkLabel(group.country)}
                            </a>
                          ) : null}
                          {countryStoreCount > 1 ? (
                            <span className="city-block__stores">
                              {countryStoreCount}{" "}
                              {pluralStores(countryStoreCount)}
                            </span>
                          ) : null}
                        </span>
                        <span className="city-block__qty">
                          {formatQuantity(countryQty)}
                        </span>
                      </h3>
                    </div>

                    {countryOpen ? (
                      group.cities.length === 1 ? (
                        <>
                          <p className="availability__note availability__note--nested">
                            {group.cities[0]!.regionName}
                          </p>
                          <ul className="store-list">
                            {group.cities[0]!.stores.map((store) => (
                              <StoreRow
                                key={store.locationId}
                                store={store}
                              />
                            ))}
                          </ul>
                        </>
                      ) : (
                        <CityAccordionList
                          cities={group.cities}
                          expandedCities={expandedCities}
                          setExpandedCities={setExpandedCities}
                          nested
                        />
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      {stockStatus === "ready" &&
      filteredCountries.length === 0 &&
      filteredOnline.length === 0 &&
      country == null &&
      regionId == null ? (
        <p className="state">Сейчас товар нигде не найден в наличии.</p>
      ) : null}
    </div>
  );
}

type StoreLayout =
  | { mode: "empty" }
  | { mode: "single-store"; store: AvailabilityStore; note: string }
  | {
      mode: "single-country";
      cities: AvailabilityCity[];
      note: string;
    }
  | { mode: "multi-country"; countries: AvailabilityCountry[] };

function resolveStoreLayout(groups: AvailabilityCountry[]): StoreLayout {
  if (groups.length === 0) return { mode: "empty" };

  if (groups.length === 1) {
    const group = groups[0]!;
    const storeTotal = group.cities.reduce(
      (sum, city) => sum + city.stores.length,
      0,
    );

    if (storeTotal === 1 && group.cities.length === 1) {
      const city = group.cities[0]!;
      return {
        mode: "single-store",
        store: city.stores[0]!,
        note: `${group.countryName} · ${city.regionName}`,
      };
    }

    return {
      mode: "single-country",
      cities: group.cities,
      note:
        group.cities.length === 1
          ? `${group.countryName} · ${group.cities[0]!.regionName}`
          : group.countryName,
    };
  }

  return { mode: "multi-country", countries: groups };
}

function CityAccordionList({
  cities,
  expandedCities,
  setExpandedCities,
  nested = false,
}: {
  cities: AvailabilityCity[];
  expandedCities: Set<number>;
  setExpandedCities: Dispatch<SetStateAction<Set<number>>>;
  nested?: boolean;
}) {
  return (
    <ul className={nested ? "city-list city-list--nested" : "city-list"}>
      {cities.map((city) => {
        const cityOpen = expandedCities.has(city.regionId);
        return (
          <li
            key={city.regionId}
            className={`city-block${cityOpen ? " city-block--open" : ""}`}
          >
            <button
              type="button"
              className="city-block__toggle"
              aria-expanded={cityOpen}
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
              <h4 className="city-block__name">
                <span className="city-block__chevron" aria-hidden />
                <span className="city-block__title">
                  {city.regionName}
                  {city.stores.length > 1 ? (
                    <span className="city-block__stores">
                      {city.stores.length} {pluralStores(city.stores.length)}
                    </span>
                  ) : null}
                </span>
                <span className="city-block__qty">
                  {formatQuantity(
                    city.stores.reduce(
                      (sum, store) => sum + Math.max(0, store.status),
                      0,
                    ),
                  )}
                </span>
              </h4>
            </button>

            {cityOpen ? (
              <ul className="store-list">
                {city.stores.map((store) => (
                  <StoreRow key={store.locationId} store={store} />
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function StoreRow({ store }: { store: AvailabilityStore }) {
  const linkSource =
    store.source === "hobbygames_by" || store.source === "hobbygames_kz"
      ? store.source
      : "hobbygames";

  return (
    <li className="store-row">
      <div className="store-row__info">
        <p className="store-row__name">{store.name}</p>
        {store.address ? (
          <p className="store-row__address">{store.address}</p>
        ) : null}
        {store.url ? (
          <a
            className="store-row__link"
            href={store.url}
            target="_blank"
            rel="noreferrer"
          >
            {onlineLinkLabel(linkSource, store.name)}
          </a>
        ) : null}
      </div>
      <div className="store-row__meta">
        <p className="store-row__status">
          {formatQuantity(store.status)}
          {store.price != null
            ? ` · ${formatPrice(store.price, store.currency)}`
            : null}
        </p>
        {store.phone ? (
          <a
            className="store-row__phone-btn"
            href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
            aria-label={`Позвонить: ${store.phone}`}
            title={store.phone}
            onClick={(e) => e.stopPropagation()}
          >
            <PhoneIcon />
          </a>
        ) : null}
      </div>
    </li>
  );
}

function countryProductUrl(
  group: AvailabilityCountry,
  product: CatalogProduct,
): string | null {
  if (group.country !== "BY" && group.country !== "KZ") return null;

  for (const city of group.cities) {
    for (const store of city.stores) {
      if (store.url) return store.url;
    }
  }

  const source = group.country === "BY" ? "hobbygames_by" : "hobbygames_kz";
  return (
    product.priceOffers?.find((offer) => offer.source === source)?.url ??
    product.onlineOffers?.find((offer) => offer.source === source)?.url ??
    null
  );
}

function countryProductLinkLabel(country: Country): string {
  if (country === "BY") return "Открыть на Hobby Games BY";
  if (country === "KZ") return "Открыть на Hobby Games KZ";
  return "Открыть";
}

function onlineOfferCountry(source: string | undefined): Country {
  if (source === "hobbygames_by") return "BY";
  if (source === "hobbygames_kz") return "KZ";
  return "RU";
}

function summarizeAvailability(input: {
  cityCount: number;
  storeCount: number;
  onlineCount: number;
  regionId: number | null;
}): string {
  if (input.regionId != null && input.storeCount > 0) {
    return `${input.storeCount} ${pluralStores(input.storeCount)}`;
  }
  if (input.cityCount > 0) {
    return `${input.cityCount} ${pluralCities(input.cityCount)}`;
  }
  if (input.onlineCount > 0) return "Есть онлайн";
  return "В наличии";
}

function pluralCities(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "город";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "города";
  return "городов";
}

function externalLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("hobbygames.by")) return "Открыть на Hobby Games BY";
    if (host.includes("hobbygames.kz")) return "Открыть на Hobby Games KZ";
    if (host.includes("hobbygames")) return "Открыть на Hobby Games RU";
    if (host.includes("lavkaigr")) return "Открыть в Лавке игр";
    if (host.includes("gaga.ru")) return "Открыть на GaGa";
    if (host.includes("znaemigraem")) return "Открыть в Знаем Играем";
  } catch {
    // ignore
  }
  return "Открыть на сайте";
}

function onlineLinkLabel(source: string | undefined, name: string): string {
  if (source === "lavka") return "Открыть в Лавке игр";
  if (source === "gaga") return "Открыть на GaGa";
  if (source === "znaemigraem") return "Открыть в Знаем Играем";
  if (source === "hobbygames_by") return "Открыть на Hobby Games BY";
  if (source === "hobbygames_kz") return "Открыть на Hobby Games KZ";
  if (source === "hobbygames") return "Открыть на Hobby Games RU";
  return `Открыть в ${name}`;
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
