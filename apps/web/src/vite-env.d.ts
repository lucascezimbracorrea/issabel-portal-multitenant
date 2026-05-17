/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ISSABEL_BASE_URL?: string;
  readonly VITE_BASE?: string;
  /** Set to "0" to hide PBX sidebar group */
  readonly VITE_FEATURE_PBX?: string;
  /** Set to "0" to hide Reports nav item */
  readonly VITE_FEATURE_REPORTS?: string;
  /** Set to "1" to hide Webhooks from main nav and show link under Integrations */
  readonly VITE_WEBHOOKS_UNDER_INTEGRATIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
