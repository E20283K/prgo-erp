"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "uz", label: "O'zbekcha", short: "UZ" },
  { code: "tr", label: "Türkçe", short: "TR" },
] as const;

export function LanguageSwitcher({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleSelect = (nextLocale: string) => {
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
  };

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant}
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
            title={t("title")}
          />
        }
      >
        <Globe className="size-3.5" />
        <span className="font-semibold text-[11px] uppercase tracking-wider">
          {currentLang.short}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <span>{t(lang.code as any) || lang.label}</span>
            {locale === lang.code && <Check className="size-3.5 text-primary ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
