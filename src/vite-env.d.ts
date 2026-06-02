/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_D2_ARMOR_CLEANER_BUNGIE_API_KEY?: string;
  readonly VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_ID?: string;
  readonly VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_SECRET?: string;
  readonly VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI?: string;
  readonly VITE_D2_ARMOR_CLEANER_DIM_API_KEY?: string;
  /** @deprecated Use VITE_D2_ARMOR_CLEANER_*: kept for one release */
  readonly VITE_BUNGIE_API_KEY?: string;
  readonly VITE_BUNGIE_CLIENT_ID?: string;
  readonly VITE_BUNGIE_CLIENT_SECRET?: string;
  readonly VITE_BUNGIE_REDIRECT_URI?: string;
  readonly VITE_DIM_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
