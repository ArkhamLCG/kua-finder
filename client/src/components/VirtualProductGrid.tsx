import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useColumnCount } from "../hooks/useColumnCount";
import { productHasStock } from "../lib/catalog";
import { chunkRows } from "../lib/grid";
import type { CatalogProduct, CatalogRates, Country } from "../types";
import { ProductCard } from "./ProductCard";

const MIN_COLUMN_WIDTH = 240;
const GRID_GAP = 16;
const ESTIMATED_ROW_HEIGHT = 420;

type Props = {
	products: CatalogProduct[];
	regionId: number | null;
	country: Country | null;
	rates?: CatalogRates;
};

export function VirtualProductGrid({
	products,
	regionId,
	country,
	rates,
}: Props) {
	const listRef = useRef<HTMLDivElement>(null);
	const columns = useColumnCount(listRef, MIN_COLUMN_WIDTH, GRID_GAP);
	const rowCount = Math.max(1, Math.ceil(products.length / columns));

	const [scrollMargin, setScrollMargin] = useState(0);
	useLayoutEffect(() => {
		const el = listRef.current;
		if (!el) return;
		const update = () => setScrollMargin(el.offsetTop);
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	const rowVirtualizer = useWindowVirtualizer({
		count: products.length === 0 ? 0 : rowCount,
		estimateSize: () => ESTIMATED_ROW_HEIGHT,
		overscan: 4,
		scrollMargin,
	});

	const rows = useMemo(() => chunkRows(products, columns), [products, columns]);

	return (
		<div ref={listRef} className="product-grid-virtual">
			<div
				className="product-grid product-grid--virtual"
				style={{
					height: `${rowVirtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{rowVirtualizer.getVirtualItems().map((virtualRow) => {
					const rowProducts = rows[virtualRow.index] ?? [];
					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={rowVirtualizer.measureElement}
							className="product-grid__row"
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${virtualRow.start - scrollMargin}px)`,
								display: "grid",
								gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
								gap: `${GRID_GAP}px`,
							}}
						>
							{rowProducts.map((product) => (
								<div key={product.id} className="product-grid__cell">
									<ProductCard
										product={product}
										available={productHasStock(product, regionId, country)}
										regionId={regionId}
										country={country}
										rates={rates}
									/>
								</div>
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
}
