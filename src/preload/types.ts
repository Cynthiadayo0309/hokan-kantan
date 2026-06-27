import type { HokanApi } from "../shared/types";

declare global {
  interface Window {
    hokanApi: HokanApi;
  }
}

export {};
