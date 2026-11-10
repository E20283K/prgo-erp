"use client";

import React, { useState } from "react";
import { Sun, Moon, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useWorkspaceStore, UserProfile } from "@/store/workspaceStore";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useTranslations } from "next-intl";

export function LoginScreen() {
  const { login, theme, toggleTheme } = useWorkspaceStore();
  const t = useTranslations("Auth");
  const tTop = useTranslations("Topbar");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (idValue: string, passValue: string) => {
    if (isLoading) return;

    const trimmedId = idValue.trim();
    if (!trimmedId || !passValue) {
      const emptyMsg = t("emptyCredentials");
      setError(emptyMsg);
      toast.add({
        title: t("loginErrorTitle"),
        description: emptyMsg,
        type: "error",
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameOrEmail: trimmedId,
          password: passValue,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        let errorMsg = t("invalidCredentials");
        if (data.error) {
          if (res.status === 403 || data.error.includes("bloklangan") || data.error.includes("faol emas")) {
            errorMsg = t("accountInactive");
          } else if (res.status === 401) {
            errorMsg = t("invalidCredentials");
          } else {
            errorMsg = data.error;
          }
        }
        setError(errorMsg);
        toast.add({
          title: t("loginErrorTitle"),
          description: errorMsg,
          type: "error",
        });
        setIsLoading(false);
        return;
      }

      const u = data.user;
      const userProfile: UserProfile = {
        id: u.id,
        code: u.code,
        username: u.username,
        name: u.fullName,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        department: u.department,
        plant: u.plant,
        initials: u.initials,
        defaultModule: u.defaultModule,
        avatar: u.avatar,
        permissions: u.permissions,
        scope: u.scope,
        security: u.security,
      };

      login(userProfile);

      toast.add({
        title: t("welcomeToastTitle", { name: userProfile.name }),
        description: t("welcomeToastDesc", { role: userProfile.role }),
        type: "success",
      });
    } catch (err: any) {
      const serverMsg = err.message || t("serverErrorDesc");
      setError(serverMsg);
      toast.add({
        title: t("serverErrorTitle"),
        description: serverMsg,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (e) e.preventDefault();
    performLogin(identifier, password);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center px-4 py-8 bg-white dark:bg-black text-neutral-900 dark:text-white select-none transition-colors duration-200 relative">
      {/* Top right language & theme toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20">
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="h-8 w-8 p-0 text-neutral-400 hover:text-foreground dark:hover:text-white cursor-pointer"
          title={tTop("toggleTheme")}
          aria-label={tTop("toggleTheme")}
        >
          {theme === "dark" ? (
            <Sun className="size-4 text-amber-400" />
          ) : (
            <Moon className="size-4 text-blue-500" />
          )}
        </Button>
      </div>

      {/* Centered Auth Card / Box */}
      <main className="my-auto w-full max-w-[340px] flex flex-col items-center">
        {/* Brand Logo Circle Badge */}
        <div className="size-11 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/90 flex items-center justify-center p-1.5 mb-4 shadow-xs">
          <img
            src="/icon-192x192.png"
            alt="PrintGoo"
            className="size-7 object-contain rounded-full select-none"
          />
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white text-center">
          {t("title")}
        </h1>

        {/* Subtitle */}
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 mb-6 text-center">
          {t("description")}
        </p>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-2.5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs animate-in fade-in-50 duration-150"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="flex-1 leading-snug">
                <span className="font-semibold block text-xs">{t("loginErrorTitle")}</span>
                <span className="text-[11px] opacity-90">{error}</span>
              </div>
            </div>
          )}

          {/* Username / Email Field */}
          <div className="space-y-1">
            <Input
              id="identifier"
              name="username"
              type="text"
              placeholder={t("emailPlaceholder")}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError(null);
              }}
              required
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={!!error}
              className={cn(
                "h-10 px-3 text-xs sm:text-sm rounded-lg transition-colors",
                "bg-neutral-50 dark:bg-[#111111] border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
                "focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 focus-visible:border-neutral-400 dark:focus-visible:border-neutral-600",
                error && "border-destructive/60 focus-visible:ring-destructive/30"
              )}
            />
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("passwordLabel")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                required
                autoComplete="current-password"
                aria-invalid={!!error}
                className={cn(
                  "h-10 px-3 pr-10 text-xs sm:text-sm rounded-lg transition-colors",
                  "bg-neutral-50 dark:bg-[#111111] border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
                  "focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 focus-visible:border-neutral-400 dark:focus-visible:border-neutral-600",
                  error && "border-destructive/60 focus-visible:ring-destructive/30"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 focus:outline-none p-1 cursor-pointer transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center justify-center shadow-xs"
          >
            {isLoading ? (
              <>
                <Spinner className="size-4 text-white dark:text-black mr-2 animate-spin" />
                <span>{t("signingIn")}</span>
              </>
            ) : (
              <span>{t("signInButton")}</span>
            )}
          </Button>
        </form>

        {/* Links: Forgot password & Need access / Contact admin */}
        <div className="mt-5 flex flex-col items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              toast.add({
                title: t("forgotPasswordTitle"),
                description: t("forgotPasswordDesc"),
                type: "info",
              });
            }}
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            {t("forgotPassword")}
          </button>
          <div className="text-neutral-500 dark:text-neutral-400">
            <span>{t("needAccess")}</span>{" "}
            <button
              type="button"
              onClick={() => {
                toast.add({
                  title: t("contactSupportTitle"),
                  description: t("contactSupportDesc"),
                  type: "info",
                });
              }}
              className="text-neutral-900 dark:text-white font-medium hover:underline cursor-pointer transition-colors"
            >
              {t("contactAdmin")}
            </button>
          </div>
        </div>
      </main>

      {/* Footer Legal Terms Notice */}
      <footer className="w-full text-center py-4">
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto leading-relaxed">
          {t("termsPrefix")}{" "}
          <span className="text-neutral-600 dark:text-neutral-300 font-medium">
            {t("termsOfService")}
          </span>{" "}
          {t("termsAnd")}{" "}
          <span className="text-neutral-600 dark:text-neutral-300 font-medium">
            {t("privacyPolicy")}
          </span>
          .
        </p>
      </footer>
    </div>
  );
}
