/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Воронка для входа без параметров (BotFather «Открыть приложение», /sitelab).
  readonly VITE_DEFAULT_FUNNEL_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
