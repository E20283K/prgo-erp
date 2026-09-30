import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Polygraph ERP",
  description: "Enterprise CRM + ERP System",
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const { locale } = await params;
  
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }
  
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground h-screen w-screen overflow-hidden`}
      >
        <NextIntlClientProvider messages={messages}>
          <TooltipProvider>{children}</TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

