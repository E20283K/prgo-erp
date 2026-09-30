"use client";

import React, { useState } from "react";
import { Printer, Sun, Moon, ArrowRight } from "lucide-react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useWorkspaceStore, DEMO_USERS, UserProfile } from "@/store/workspaceStore";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useTranslations } from "next-intl";

export function LoginScreen() {
  const { login, theme, toggleTheme } = useWorkspaceStore();
  const t = useTranslations("Auth");
  const tTop = useTranslations("Topbar");

  const [email, setEmail] = useState("a.kovalev@printgoo.com");
  const [password, setPassword] = useState("••••••••");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent, customUser?: UserProfile) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    const userToLogin = customUser || DEMO_USERS.operator;

    setTimeout(() => {
      setIsLoading(false);
      login(userToLogin);

      toast.add({
        title: t("welcomeToastTitle", { name: userToLogin.name }),
        description: t("welcomeToastDesc", { role: userToLogin.role }),
        type: "success",
      });
    }, 600);
  };

  const handleQuickDemo = (roleKey: "operator" | "sales" | "admin") => {
    const user = DEMO_USERS[roleKey];
    setEmail(user.email);
    setPassword("password123");
    handleSubmit(null as any, user);
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
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
      <Card className="w-full max-w-sm sm:max-w-md shadow-lg border-border bg-card">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 size-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Printer className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {t("description")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="email" className="text-xs font-medium">
                {t("emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 text-xs"
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
                      description: t("forgotPasswordDesc"),
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
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9 text-xs"
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
              onClick={() => handleQuickDemo("operator")}
              className="text-[11px] h-8 px-2 truncate"
              title="Sign in as Production Operator"
            >
              {t("demoProduction")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickDemo("sales")}
              className="text-[11px] h-8 px-2 truncate"
              title="Sign in as Sales Manager"
            >
              {t("demoSales")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickDemo("admin")}
              className="text-[11px] h-8 px-2 truncate"
              title="Sign in as Administrator"
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
