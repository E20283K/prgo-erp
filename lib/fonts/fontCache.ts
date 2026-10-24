/**
 * Enterprise Font Device Cache Manager for PrintGoo ERP/MES
 *
 * Implements a true Local-First / Cache-First strategy for all ERP fonts:
 * 1. Checks user device cache (CacheStorage API: `erp-fonts-v1`) before making any network request.
 * 2. Pre-caches core ERP typography (Roboto Regular & Bold) to local device storage on app boot.
 * 3. Intercepts font network requests (including @react-pdf/renderer) to serve directly from device cache.
 * 4. Hydrates `document.fonts` via FontFace API so canvas, SVG engines, and Glide Data Grid render instantly.
 */

export const ERP_FONT_CACHE_NAME = "erp-fonts-v1";

export const ERP_CORE_FONTS = [
  {
    family: "Inter",
    url: "/fonts/inter-latin.woff2",
    weight: "100 900",
    style: "normal",
  },
  {
    family: "Inter",
    url: "/fonts/inter-cyrillic.woff2",
    weight: "100 900",
    style: "normal",
  },
] as const;

let isInitialized = false;

/**
 * Checks if the browser environment supports CacheStorage
 */
export function isCacheStorageSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

/**
 * Cache-First fetch helper for fonts:
 * Tries the user device CacheStorage first; falls back to network only if missing,
 * then saves the fetched font to the device cache for all subsequent usages.
 */
export async function fetchFontCacheFirst(url: string): Promise<Response> {
  if (!isCacheStorageSupported()) {
    return fetch(url);
  }

  try {
    const cache = await window.caches.open(ERP_FONT_CACHE_NAME);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Not in local device cache: fetch from network and store to device
    const networkResponse = await fetch(url, {
      cache: "force-cache",
    });

    if (networkResponse.ok) {
      // Put a clone into the device persistent cache
      await cache.put(url, networkResponse.clone());
    }

    return networkResponse;
  } catch (err) {
    console.warn(`[FontCache] Device cache lookup failed for ${url}, falling back to network:`, err);
    return fetch(url);
  }
}

/**
 * Retrieves the ArrayBuffer of a font directly from device cache (or network if first run)
 */
export async function getCachedFontBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetchFontCacheFirst(url);
  return response.arrayBuffer();
}

/**
 * Retrieves a Blob URL of a font directly from device cache
 */
export async function getCachedFontBlobUrl(url: string): Promise<string> {
  const response = await fetchFontCacheFirst(url);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Pre-caches all core ERP fonts directly onto the user device storage and registers
 * them into document.fonts via the native FontFace API.
 */
export async function precacheCoreFonts(): Promise<void> {
  if (typeof window === "undefined") return;

  await Promise.allSettled(
    ERP_CORE_FONTS.map(async (font) => {
      try {
        const response = await fetchFontCacheFirst(font.url);
        if (!response.ok) return;

        // Register font with FontFace API if supported and not already loaded
        if ("fonts" in document) {
          const fontData = await response.clone().arrayBuffer();
          const fontFace = new FontFace(font.family, fontData, {
            weight: font.weight,
            style: font.style,
            display: "swap",
          });

          const loadedFace = await fontFace.load();
          document.fonts.add(loadedFace);
        }
      } catch (err) {
        console.warn(`[FontCache] Failed to precache font ${font.family} (${font.url}):`, err);
      }
    })
  );
}

/**
 * Installs a Cache-First hook onto window.fetch specifically for font files.
 * This guarantees that any library (e.g. @react-pdf/renderer or dynamic CSS)
 * requesting fonts will automatically hit the user's local device cache FIRST.
 */
export function installFontFetchInterceptor(): void {
  if (typeof window === "undefined" || !isCacheStorageSupported()) return;

  const originalFetch = window.fetch;
  const FONT_URL_PATTERN = /(\/fonts\/.*|\.(?:ttf|woff|woff2|otf|eot))(\?.*)?$/i;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    if (FONT_URL_PATTERN.test(urlStr)) {
      try {
        const cache = await window.caches.open(ERP_FONT_CACHE_NAME);
        const cached = await cache.match(input);
        if (cached) {
          return cached;
        }

        // Fetch from network and write to user device cache
        const res = await originalFetch.call(this, input, init);
        if (res.ok) {
          cache.put(input, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        // In case of error in cache matching, fall back to native fetch
        return originalFetch.call(this, input, init);
      }
    }

    return originalFetch.call(this, input, init);
  };
}

/**
 * Master initializer: Pre-warms device cache and configures cache-first interception.
 * Idempotent, safe to call multiple times.
 */
export function initFontDeviceCache(): void {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  // 1. Hook fetch to prioritize user device cache
  installFontFetchInterceptor();

  // 2. Pre-cache all ERP fonts in the background
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(() => {
      precacheCoreFonts();
    });
  } else {
    setTimeout(() => {
      precacheCoreFonts();
    }, 100);
  }
}
