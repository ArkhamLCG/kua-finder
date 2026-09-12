import type { CatalogSource } from "../types";

const FAVICONS: Record<CatalogSource, string> = {
  hobbygames: `${import.meta.env.BASE_URL}retailers/hobbygames.png`,
  hobbygames_by: `${import.meta.env.BASE_URL}retailers/hobbygames_by.png`,
  hobbygames_kz: `${import.meta.env.BASE_URL}retailers/hobbygames_kz.png`,
  lavka: `${import.meta.env.BASE_URL}retailers/lavka.png`,
  gaga: `${import.meta.env.BASE_URL}retailers/gaga.png`,
  znaemigraem: `${import.meta.env.BASE_URL}retailers/znaemigraem.png`,
};

type Props = {
  source: CatalogSource;
  className?: string;
};

/** Favicons taken from the retailer sites. */
export function RetailerIcon({ source, className }: Props) {
  return (
    <img
      className={className ? `retailer-icon ${className}` : "retailer-icon"}
      src={FAVICONS[source]}
      alt=""
      width={18}
      height={18}
      loading="lazy"
      decoding="async"
    />
  );
}
