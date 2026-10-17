import type { Platform } from "./types.js";

/** Detects the operating-system family. Returns `"other"` where there is no `navigator` (SSR). */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") {
    return "other";
  }
  const info = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const name = info.userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(name) ? "mac" : "other";
}
