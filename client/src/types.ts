export type CatalogSource = "hobbygames" | "lavka" | "gaga";

export type CatalogLocation = {
  id: number;
  regionId: number;
  name: string;
  address: string;
  phone: string;
  delivery: boolean;
  source?: CatalogSource;
};

export type ProductStockItem = {
  locationId: number;
  status: number;
  statusText: string;
  url?: string;
};

/** Online retailer link for list/preview (no need to load stock file). */
export type ProductOnlineOffer = {
  source: "lavka" | "gaga";
  url: string;
};

export type CatalogProduct = {
  id: number;
  price: number;
  name: string;
  image: string | null;
  url: string;
  availableLocationIds: number[];
  onlineOffers?: ProductOnlineOffer[];
};

export type ProductStockDetail = {
  id: number;
  last_updated: string;
  stock: ProductStockItem[];
};

export type CatalogRegion = {
  id: number;
  name: string;
};

export type ProductsCatalog = {
  last_updated: string;
  locations: CatalogLocation[];
  products: CatalogProduct[];
};

export type StoreAvailability = {
  location: CatalogLocation;
  status: number;
  statusText: string;
};

export type CityAvailability = {
  regionId: number;
  regionName: string;
  stores: StoreAvailability[];
};

export type OnlineOffer = {
  location: CatalogLocation;
  status: number;
  statusText: string;
  url: string | null;
};

export type RetailerBadge = {
  source: CatalogSource;
  name: string;
  count: number;
  url: string;
};
