export function chunkRows<T>(items: T[], columns: number): T[][] {
	const rowCount = Math.max(1, Math.ceil(items.length / columns));
	return Array.from({ length: rowCount }, (_, rowIndex) => {
		const start = rowIndex * columns;
		return items.slice(start, start + columns);
	});
}
