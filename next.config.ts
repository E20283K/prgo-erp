import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { execSync } from "node:child_process";
import withPWAInit from "@ducanh2912/next-pwa";
import pkg from "./package.json";

function getGitBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim() || "master";
  } catch {
    return "master";
  }
}

function getMajorVersion(version: string | undefined, fallback: string): string {
  if (!version) return fallback;
  const match = version.match(/\d+/);
  return match ? match[0] : fallback;
}

const withNextIntl = createNextIntlPlugin();

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Cache-First strategy for local & static fonts on user device
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-font-assets",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      {
        // Cache-First strategy for Google webfonts
        urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-webfonts",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
        },
      },
      {
        // Cache-First strategy for Google stylesheets
        urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-stylesheets",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_WORKSPACE_ROOT: process.cwd().replace(/\\/g, "/"),
    NEXT_PUBLIC_GIT_BRANCH: getGitBranch(),
    NEXT_PUBLIC_NEXT_VERSION: getMajorVersion(pkg.dependencies?.next, "16"),
    NEXT_PUBLIC_REACT_VERSION: getMajorVersion(pkg.dependencies?.react, "19"),
  },
  async headers() {
    return [
      {
        // Instruct user browsers to permanently cache local font assets on device
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async rewrites() {
    // Ish vaqtida yuklangan fayllar (public/ ro'yxatida yo'q) app/api/files route'i orqali beriladi.
    // fallback: build paytida mavjud public fayllar va sahifalar avval tekshiriladi.
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        { source: "/uploads/:path*", destination: "/api/files/uploads/:path*" },
        { source: "/artwork/:path*", destination: "/api/files/artwork/:path*" },
        { source: "/cache/:path*", destination: "/api/files/cache/:path*" },
      ],
    };
  },
};

export default withNextIntl(withPWA(nextConfig));
