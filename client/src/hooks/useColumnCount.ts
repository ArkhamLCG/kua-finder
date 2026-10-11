import { type RefObject, useLayoutEffect, useState } from "react";

export function useColumnCount(
	containerRef: RefObject<HTMLElement | null>,
	minColumnWidth: number,
	gap: number,
) {
	const [columns, setColumns] = useState(1);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const update = (width: number) => {
			const next = Math.max(
				1,
				Math.floor((width + gap) / (minColumnWidth + gap)),
			);
			setColumns((prev) => (prev === next ? prev : next));
		};

		update(el.clientWidth);

		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width != null) update(width);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [containerRef, minColumnWidth, gap]);

	return columns;
}
