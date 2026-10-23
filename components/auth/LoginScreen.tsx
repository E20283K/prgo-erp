"use client";

import React, { useState } from "react";
import { Sun, Moon, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Card, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useWorkspaceStore, UserProfile } from "@/store/workspaceStore";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useTranslations } from "next-intl";

export function LoginScreen() {
  const { login, theme, toggleTheme } = useWorkspaceStore();
  const t = useTranslations("Auth");
  const tTop = useTranslations("Topbar");

  const [email, setEmail] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (identifier: string, pass: string) => {
    if (isLoading) return;

    if (!identifier.trim() || !pass) {
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
          usernameOrEmail: identifier.trim(),
          password: pass,
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
    performLogin(email, password);
  };

  const handleQuickDemo = (roleKey: "operator" | "sales" | "admin") => {
    setError(null);
    if (roleKey === "admin") {
      setEmail("admin");
      setPassword("admin");
      performLogin("admin", "admin");
    } else if (roleKey === "sales") {
      setEmail("manager");
      setPassword("manager");
      performLogin("manager", "manager");
    } else {
      setEmail("operator");
      setPassword("operator");
      performLogin("operator", "operator");
    }
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
        >
          {theme === "dark" ? (
            <Sun className="size-4 text-amber-500" />
          ) : (
            <Moon className="size-4 text-blue-500" />
          )}
        </Button>
      </div>

      {/* Simple Centered Card */}
      <Card className="w-full max-w-sm sm:max-w-md shadow-lg border-border bg-card pt-2">
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
              <Label htmlFor="email" className="text-xs font-medium">
                {t("emailLabel")} / Login
              </Label>
              <Input
                id="email"
                type="text"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                required
                className={cn(
                  "h-9 text-xs transition-colors",
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
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.add({
                      title: t("forgotPasswordTitle"),
                      description: "Parolingizni unutgan bo'lsangiz, administratorga murojaat qiling.",
                      type: "info",
                    });
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  {t("forgotPassword")}
                </a>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                required
                className={cn(
                  "h-9 text-xs transition-colors",
                  error && "border-destructive/60 focus-visible:ring-destructive/30"
                )}
              />
            </div>

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Spinner className="size-3.5 text-white mr-2" />
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

          {/* Separator */}
          <div className="relative flex items-center justify-center my-3">
            <Separator className="w-full" />
            <span className="absolute bg-card px-2 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              {t("orDemoProfiles")}
            </span>
          </div>

          {/* Fast 1-Click Demo Profiles */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickDemo("operator")}
              className="text-[11px] h-8 px-2 truncate cursor-pointer"
              title="Operator: operator / operator"
            >
              {t("demoProduction")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickDemo("sales")}
              className="text-[11px] h-8 px-2 truncate cursor-pointer"
              title="Manager: manager / manager"
            >
              {t("demoSales")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickDemo("admin")}
              className="text-[11px] h-8 px-2 truncate cursor-pointer"
              title="Admin: admin / admin"
            >
              {t("demoAdmin")}
            </Button>
          </div>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/50 py-3 bg-muted/20 text-xs text-muted-foreground">
          <span>{t("needAccess")}</span>
          <a
            href="#support"
            onClick={(e) => {
              e.preventDefault();
              toast.add({
                title: t("contactSupportTitle"),
                description: t("contactSupportDesc"),
                type: "info",
              });
            }}
            className="text-primary hover:underline ml-1 font-medium"
          >
            {t("contactAdmin")}
          </a>
        </CardFooter>
      </Card>
    </div>
  );
}
