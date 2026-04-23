/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "static" → no server proxy is available (CF Pages / any SPA-only host). */
  readonly VITE_BCAL_MODE?: 'static' | 'local';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
