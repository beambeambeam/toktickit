/// <reference types="vite/client" />

declare module "bootstrap/dist/js/bootstrap.bundle.min.js";

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
