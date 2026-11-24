import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "../globals.css";
import { TgSessionProvider } from "./TgSession";
import { TgGate } from "./TgGate";

export const metadata: Metadata = {
  title: "PrintGoo",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/** Root layout of the Telegram Mini App (separate from the ERP desktop shell under [locale]). */
export default function TgLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased bg-background text-foreground min-h-dvh">
        <TgSessionProvider>
          <TgGate>{children}</TgGate>
        </TgSessionProvider>
      </body>
    </html>
  );
}
