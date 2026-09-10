import { CATEGORY_URL } from "./src/config.js";
import { parsePage } from "./src/services/parse/page/page-parser.js";

const products = await parsePage(CATEGORY_URL);
console.log(JSON.stringify(products, null, 2));
