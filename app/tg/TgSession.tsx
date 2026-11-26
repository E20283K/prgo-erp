"use client";

import * as React from "react";
import type { SanitizedUser } from "@/lib/server/authService";

/** Minimal surface of `window.Telegram.WebApp` used by the Mini App. */
export interface TelegramWebApp {
  initData: string;
  /** `start_param` is the `startapp` value of the link that opened the app. */
  initDataUnsafe?: { start_param?: string };
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  onEvent(event: "themeChanged", cb: () => void): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: { notificationOccurred(type: "success" | "error" | "warning"): void };
  showConfirm?(message: string, cb: (ok: boolean) => void): void;
  openLink?(url: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function telegramApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

const TOKEN_KEY = "printgoo_tg_session";

type SessionState =
  | { status: "loading" }
  | { status: "ready"; user: SanitizedUser }
  | { status: "not_linked" }
  | { status: "error"; message: string };

interface SessionContext {
  state: SessionState;
  /** fetch() against the ERP API with the Mini App session attached. */
  api: (path: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = React.createContext<SessionContext | null>(null);

export function useTgSession(): SessionContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useTgSession must be used inside TgSessionProvider");
  return ctx;
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the token then lives only in memory */
  }
}

function applyTheme(app: TelegramWebApp | null) {
  const dark = app ? app.colorScheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
}

/** Waits briefly for telegram-web-app.js; outside Telegram it resolves to null. */
async function waitForTelegram(): Promise<TelegramWebApp | null> {
  for (let i = 0; i < 20; i++) {
    const app = telegramApp();
    if (app) return app;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

export function TgSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SessionState>({ status: "loading" });
  const tokenRef = React.useRef<string | null>(null);

  const api = React.useCallback((path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (tokenRef.current) headers.set("Authorization", `Bearer ${tokenRef.current}`);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(path, { ...init, headers, credentials: "same-origin", cache: init?.cache ?? "no-store" });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const app = await waitForTelegram();
      // telegram-web-app.js also loads in a normal browser, with empty initData.
      const inTelegram = !!app?.initData;
      if (inTelegram) {
        app!.ready();
        app!.expand();
        app!.onEvent("themeChanged", () => applyTheme(app));
      }
      applyTheme(inTelegram ? app : null);

      try {
        // 1. A session from an earlier launch in this Telegram window.
        tokenRef.current = readToken();
        if (tokenRef.current) {
          const me = await api("/api/v1/auth/me");
          if (me.ok) {
            const json = await me.json();
            if (!cancelled) setState({ status: "ready", user: json.user });
            return;
          }
          tokenRef.current = null;
          writeToken(null);
        }

        // 2. Telegram launch: exchange the signed initData for an ERP session.
        if (inTelegram) {
          const res = await fetch("/api/v1/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: app!.initData }),
          });
          const json = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.ok && json.token) {
            tokenRef.current = json.token;
            writeToken(json.token);
            setState({ status: "ready", user: json.user });
          } else if (json.code === "not_linked") {
            setState({ status: "not_linked" });
          } else {
            setState({ status: "error", message: json.error || "Kirib bo'lmadi" });
          }
          return;
        }

        // 3. Opened in a normal browser: use the ERP login cookie.
        const me = await api("/api/v1/auth/me");
        const json = await me.json().catch(() => ({}));
        if (cancelled) return;
        if (me.ok && json.user) setState({ status: "ready", user: json.user });
        else setState({ status: "error", message: "Ilovani Telegram bot orqali oching" });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Server bilan aloqa yo'q" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const value = React.useMemo(() => ({ state, api }), [state, api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const START_HANDLED_KEY = "printgoo_tg_start_handled";

/**
 * Screen a launch link asks for (`startapp=att_d_20261125` → day shift roll call of that date),
 * returned once per Telegram launch so going back to the home screen does not bounce again.
 */
export function takeStartRoute(): string | null {
  const param = telegramApp()?.initDataUnsafe?.start_param;
  if (!param) return null;
  try {
    if (sessionStorage.getItem(START_HANDLED_KEY) === param) return null;
    sessionStorage.setItem(START_HANDLED_KEY, param);
  } catch {
    /* storage blocked: route anyway */
  }
  const m = param.match(/^att_([dn])_(\d{4})(\d{2})(\d{2})$/);
  if (m) return `/tg/attendance?shift=${m[1] === "n" ? "night" : "day"}&date=${m[2]}-${m[3]}-${m[4]}`;
  if (param === "att") return "/tg/attendance";
  return null;
}

/** Hooks the Telegram back button to `onBack` while the calling screen is shown. */
export function useTelegramBackButton(onBack: () => void) {
  React.useEffect(() => {
    const app = telegramApp();
    if (!app?.initData) return;
    app.BackButton.show();
    app.BackButton.onClick(onBack);
    return () => {
      app.BackButton.offClick(onBack);
      app.BackButton.hide();
    };
  }, [onBack]);
}
