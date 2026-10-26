"use client";

import React, { useState } from "react";
import { Sun, Moon, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Card, 
  CardHeader,
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-foreground relative">
      {/* Top right subtle theme & language toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          title={tTop("toggleTheme")}
          aria-label={tTop("toggleTheme")}
        >
          {theme === "dark" ? (
            <Sun className="size-4 text-amber-500" />
          ) : (
            <Moon className="size-4 text-blue-500" />
          )}
        </Button>
      </div>

      {/* Centered Card */}
      <Card className="w-full max-w-sm border-border bg-card shadow-sm">
        <CardHeader className="text-center pb-3 pt-7 flex flex-col items-center">
          <img
            src="/printgoo_logo.svg"
            alt="PrintGoo"
            className="h-14 sm:h-16 w-auto object-contain select-none"
          />
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-2.5 rounded-md bg-destructive/10 border border-destructive/25 text-destructive text-xs animate-in fade-in-50 duration-150"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />
                <div className="flex-1 leading-snug">
                  <span className="font-semibold block text-xs">{t("loginErrorTitle")}</span>
                  <span className="text-[11px] text-destructive/90">{error}</span>
                </div>
              </div>
            )}

            {/* Username / Email Field */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="identifier" className="text-xs font-medium">
                {t("emailLabel")}
              </Label>
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
                  "h-8 text-xs transition-colors",
                  error && "border-destructive/60 focus-visible:ring-destructive/30"
                )}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">
                  {t("passwordLabel")}
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    toast.add({
                      title: t("forgotPasswordTitle"),
                      description: t("forgotPasswordDesc"),
                      type: "info",
                    });
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                >
                  {t("forgotPassword")}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  className={cn(
                    "h-8 text-xs pr-8 transition-colors",
                    error && "border-destructive/60 focus-visible:ring-destructive/30"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none p-0.5 cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Spinner className="size-3.5 text-white mr-1.5" />
                  <span>{t("signingIn")}</span>
                </>
              ) : (
                <>
                  <span>{t("signInButton")}</span>
                  <ArrowRight className="size-3.5 ml-1.5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/50 py-3 bg-muted/20 text-xs text-muted-foreground">
          <span>{t("needAccess")}</span>
          <button
            type="button"
            onClick={() => {
              toast.add({
                title: t("contactSupportTitle"),
                description: t("contactSupportDesc"),
                type: "info",
              });
            }}
            className="text-primary hover:underline ml-1 font-medium cursor-pointer"
          >
            {t("contactAdmin")}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
