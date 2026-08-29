// Minimal Vite client env typing for the GitHub Pages hosting adapter, which reads
// `import.meta.env.BASE_URL` (the Vite `base`). Additive only — no runtime effect.
interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
