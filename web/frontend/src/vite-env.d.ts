/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_ARCGIS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
