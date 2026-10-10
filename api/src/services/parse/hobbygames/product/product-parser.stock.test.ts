import assert from "node:assert/strict";
import test from "node:test";
import { readStockStatus } from "./product-parser.js";

test("readStockStatus treats stock-status-preorder as preorder, not zero stock", () => {
	assert.deepEqual(
		readStockStatus("stock-status stock-status-preorder", "Предзаказ"),
		{ status: 0, statusText: "Предзаказ", preorder: true },
	);
	assert.deepEqual(readStockStatus("stock-status stock-status-preorder", ""), {
		status: 0,
		statusText: "Предзаказ",
		preorder: true,
	});
});

test("readStockStatus keeps piece counts", () => {
	assert.deepEqual(readStockStatus("stock-status stock-status-3", "3"), {
		status: 3,
		statusText: "3",
		preorder: false,
	});
});
