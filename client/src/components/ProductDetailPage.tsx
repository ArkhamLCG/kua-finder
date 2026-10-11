import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useCatalog } from "../hooks/useCatalog";
import { useCatalogFilters } from "../hooks/useCatalogFilters";
import { useProductStock } from "../hooks/useProductStock";
import {
	formatListPrice,
	formatPrice,
	formatQuantity,
	formatStockLabel,
} from "../lib/catalog";
import { CATALOG_DISCLAIMER } from "../lib/disclaimer";
import {
	countryProductLinkLabel,
	externalLinkLabel,
	isHobbyGamesRuUrl,
	onlineLinkLabel,
	phoneTelHref,
} from "../lib/links";
import { pluralStores } from "../lib/plural";
import {
	buildStoreView,
	describeCountryGroup,
	storeGroupSummary,
} from "../lib/store-view";
import type { AvailabilityCity, AvailabilityStore } from "../types";
import { OnlineMarker } from "./ProductCard";

export function ProductDetailPage() {
	const { productId } = useParams();
	const { products, catalog } = useCatalog();
	const { country, regionId } = useCatalogFilters();

	const id = Number(productId);
	const product = products.find((item) => item.id === id) ?? null;
	const stock = useProductStock(product?.id ?? null);

	const view = useMemo(
		() =>
			product
				? buildStoreView({
						product,
						rates: catalog?.rates,
						country,
						regionId,
						stockStatus: stock.status,
						countries: stock.countries,
						onlineOffers: stock.onlineOffers,
						cityQuery: stock.cityQuery,
					})
				: null,
		[
			product,
			catalog?.rates,
			country,
			regionId,
			stock.status,
			stock.countries,
			stock.onlineOffers,
			stock.cityQuery,
		],
	);

	if (!product || !view) {
		return (
			<div className="page">
				<Link to="/" className="back-link">
					← К списку
				</Link>
				<p className="state">Товар не найден</p>
			</div>
		);
	}

	const { layout } = view;

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
					<p className="detail__price">{formatListPrice(view.listPrice)}</p>
					<div className="product-card__status-line">
						<p
							className={`product-card__status${view.preorderStatus ? " is-preorder" : view.available ? " is-available" : " is-unavailable"}`}
						>
							{view.statusSummary}
						</p>
						{view.showOnlineMarker ? <OnlineMarker /> : null}
					</div>
					<div className="detail__cta">
						<a
							className="detail__external"
							href={product.url}
							target="_blank"
							rel="noreferrer"
						>
							{externalLinkLabel(product.url)}
						</a>
						{isHobbyGamesRuUrl(product.url) ? (
							<p className="detail__cta-note">
								Если вы планируете покупать игру из другого региона — не
								забудьте сменить его на сайте Hobby Games
							</p>
						) : null}
					</div>
				</div>
			</article>

			<p className="detail__disclaimer">{CATALOG_DISCLAIMER}</p>

			{stock.status === "loading" && (
				<div className="detail-loader" role="status" aria-live="polite">
					<div className="loader__spinner" aria-hidden />
					<p className="state">Загрузка наличия…</p>
				</div>
			)}

			{stock.status === "error" && (
				<p className="state state--error">{stock.error}</p>
			)}

			{stock.status === "ready" && view.filteredOnline.length > 0 ? (
				<section className="availability availability--online">
					<h2 className="availability__title">Онлайн</h2>
					<ul className="online-list">
						{view.filteredOnline.map((offer) => (
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

			{stock.status === "ready" &&
			(country != null || regionId != null || stock.countries.length > 0) ? (
				<section className="availability">
					<h2 className="availability__title">Магазины Hobby Games</h2>
					{view.showCitySearch ? (
						<label className="search availability__search">
							<span className="visually-hidden">Фильтр по городу</span>
							<input
								type="search"
								value={stock.cityQuery}
								onChange={(e) => stock.setCityQuery(e.target.value)}
								placeholder="Название города…"
								autoComplete="off"
							/>
						</label>
					) : null}

					{layout.mode === "empty" ? (
						<p className="state">{view.emptyMessage}</p>
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
								{view.singleCountryLink?.url ? (
									<>
										{" · "}
										<a
											className="city-block__product-link"
											href={view.singleCountryLink.url}
											target="_blank"
											rel="noreferrer"
										>
											{countryProductLinkLabel(view.singleCountryLink.country)}
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
									expandedCities={stock.expandedCities}
									onToggleCity={stock.toggleCity}
								/>
							)}
						</>
					) : null}

					{layout.mode === "multi-country" ? (
						<ul className="city-list">
							{layout.countries.map((group) => {
								const countryOpen = stock.expandedCountries.has(group.country);
								const groupView = describeCountryGroup(group, product);
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
											onClick={() => stock.toggleCountry(group.country)}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													stock.toggleCountry(group.country);
												}
											}}
										>
											<h3 className="city-block__name">
												<span className="city-block__chevron" aria-hidden />
												<span className="city-block__title">
													{group.countryName}
													{groupView.productUrl ? (
														<a
															className="city-block__product-link"
															href={groupView.productUrl}
															target="_blank"
															rel="noreferrer"
															onClick={(e) => e.stopPropagation()}
															onKeyDown={(e) => e.stopPropagation()}
														>
															{countryProductLinkLabel(group.country)}
														</a>
													) : null}
													{groupView.storeCount > 1 ? (
														<span className="city-block__stores">
															{groupView.storeCount}{" "}
															{pluralStores(groupView.storeCount)}
														</span>
													) : null}
												</span>
												<span
													className={`city-block__qty${groupView.preorder ? " store-row__status--preorder" : ""}`}
												>
													{groupView.label}
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
															<StoreRow key={store.locationId} store={store} />
														))}
													</ul>
												</>
											) : (
												<CityAccordionList
													cities={group.cities}
													expandedCities={stock.expandedCities}
													onToggleCity={stock.toggleCity}
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

			{stock.status === "ready" &&
			view.filteredCountries.length === 0 &&
			view.filteredOnline.length === 0 &&
			country == null &&
			regionId == null ? (
				<p className="state">Сейчас товар нигде не найден в наличии.</p>
			) : null}
		</div>
	);
}

function CityAccordionList({
	cities,
	expandedCities,
	onToggleCity,
	nested = false,
}: {
	cities: AvailabilityCity[];
	expandedCities: Set<number>;
	onToggleCity: (regionId: number) => void;
	nested?: boolean;
}) {
	return (
		<ul className={nested ? "city-list city-list--nested" : "city-list"}>
			{cities.map((city) => {
				const cityOpen = expandedCities.has(city.regionId);
				const summary = storeGroupSummary(city.stores);
				return (
					<li
						key={city.regionId}
						className={`city-block${cityOpen ? " city-block--open" : ""}`}
					>
						<button
							type="button"
							className="city-block__toggle"
							aria-expanded={cityOpen}
							onClick={() => onToggleCity(city.regionId)}
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
								<span
									className={`city-block__qty${summary.preorder ? " store-row__status--preorder" : ""}`}
								>
									{summary.label}
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
	return (
		<li className="store-row">
			<div className="store-row__info">
				<p className="store-row__name">{store.name}</p>
				{store.address ? (
					<p className="store-row__address">{store.address}</p>
				) : null}
			</div>
			<div className="store-row__meta">
				<p
					className={`store-row__status${store.preorder ? " store-row__status--preorder" : ""}`}
				>
					{store.preorder ? "Предзаказ" : formatQuantity(store.status)}
					{store.price != null
						? ` · ${formatPrice(store.price, store.currency)}`
						: null}
				</p>
				{store.phone ? (
					<a
						className="store-row__phone-btn"
						href={phoneTelHref(store.phone)}
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
