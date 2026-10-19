"use client";

import { useEffect } from "react";
import { initFontDeviceCache } from "@/lib/fonts/fontCache";

/**
 * Initializes the device-local font cache as early as possible on the client.
 * Pre-warms `/fonts/Roboto-Regular.ttf` and `/fonts/Roboto-Bold.ttf` in user device CacheStorage
 * and installs the Cache-First fetch interceptor.
 */
export function FontCacheInitializer() {
  useEffect(() => {
    initFontDeviceCache();
  }, []);

  return null;
}
