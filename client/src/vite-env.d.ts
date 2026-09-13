/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_YANDEX_METRIKA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  ym?: (id: number | string, method: string, ...args: unknown[]) => void;
}
