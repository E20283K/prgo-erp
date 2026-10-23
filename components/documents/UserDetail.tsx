"use client";

import React, { useState, useMemo, useEffect } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { SystemUserRecord } from "./user/types";
import { INITIAL_SYSTEM_USERS, createEmptyUser } from "./user/data";
import {
  DocumentHeader,
  DocumentSidebar,
  SidebarSummaryCard,
  DocumentNavItem,
  InfoRow,
} from "./common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { getUserInitials } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  User,
  ShieldCheck,
  Building2,
  KeyRound,
  Save,
  X,
  CheckCircle2,
  Ban,
  UserCog,
  RefreshCw,
  Lock,
} from "lucide-react";
import { UserGeneralTab } from "./user/tabs/UserGeneralTab";
import { UserPermissionsTab } from "./user/tabs/UserPermissionsTab";
import { UserScopeTab } from "./user/tabs/UserScopeTab";
import { UserSecurityTab } from "./user/tabs/UserSecurityTab";

interface UserDetailProps {
  tab: DocumentTab;
}

export function UserDetail({ tab }: UserDetailProps) {
  const {
    users,
    upsertUser,
    saveUserToDb,
    resetUserPasswordInDb,
    currentUser,
    setTabUnsaved,
    updateTabData,
    closeTab,
    addNotification,
  } = useWorkspaceStore();

  // Resolve user ID from tab data or tab id
  const userId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("user-new-")) return tab.id;
    return tab.id.replace(/^user-/, "");
  }, [tab.id, tab.documentData]);

  // Find existing or draft
  const initialUser: SystemUserRecord = useMemo(() => {
    if (tab.documentData) return tab.documentData;
    const found = users.find((u) => u.id === userId || u.code === userId);
    if (found) return found;

    // Check fallback
    const fallback = INITIAL_SYSTEM_USERS.find((u) => u.id === userId || u.code === userId);
    if (fallback) return fallback;

    // Create empty draft
    return createEmptyUser(userId.startsWith("user-new-") ? `USR-${Date.now().toString().slice(-4)}` : userId);
  }, [userId, users, tab.documentData]);

  const [userData, setUserData] = useState<SystemUserRecord>(initialUser);
  const [activeTab, setActiveTab] = useState<string>(
    tab.activeLevel3Tab || "general"
  );
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Password reset dialog state
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Sync state if tab documentData changes externally
  useEffect(() => {
    if (tab.documentData && tab.documentData.id === userData.id) {
      setUserData(tab.documentData);
    }
  }, [tab.documentData]);

  const handleUpdate = (patch: Partial<SystemUserRecord>) => {
    setUserData((prev) => ({
      ...prev,
      ...patch,
    }));
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    if (!userData.username && !userData.fullName) {
      addNotification({
        title: "Xatolik: Login yoki F.I.Sh kiritilishi shart",
        description: "Foydalanuvchi hisobini saqlashdan oldin login va F.I.Sh maydonlarini to'ldiring.",
        severity: "error",
      });
      return;
    }

    setIsSaving(true);

    // Generate valid id & code if draft
    const finalUser: SystemUserRecord = {
      ...userData,
      id: userData.id.startsWith("user-new-") ? userData.code || `USR-${Date.now().toString().slice(-4)}` : userData.id,
      code: userData.code || userData.id,
      updatedAt: new Date().toISOString(),
    };

    upsertUser(finalUser);
    updateTabData(tab.id, finalUser);

    const success = await saveUserToDb(finalUser);
    setIsSaving(false);
    setTabUnsaved(tab.id, false);
    setIsSaved(true);

    if (success) {
      addNotification({
        title: "Foydalanuvchi muvaffaqiyatli saqlandi",
        description: `${finalUser.fullName || finalUser.username} (${finalUser.code}) ma'lumotlar bazasida yangilandi.`,
        severity: "success",
      });
    } else {
      addNotification({
        title: "Ogohlantirish",
        description: "Lokal o'zgarish saqlandi, biroq serverga yozishda muammo bo'ldi.",
        severity: "warning",
      });
    }
  };

  const handleToggleStatus = () => {
    const nextStatus = userData.status === "Active" ? "Suspended" : "Active";
    handleUpdate({ status: nextStatus });
  };

  const handleResetPassword = async () => {
    if (!newPasswordVal || newPasswordVal.trim().length < 3) {
      toast.add({
        title: "Xatolik",
        description: "Parol kamida 3 ta belgidan iborat bo'lishi kerak",
        type: "danger",
      });
      return;
    }

    setIsResetting(true);
    const success = await resetUserPasswordInDb(userData.id, newPasswordVal.trim());
    setIsResetting(false);

    if (success) {
      setIsResetPasswordOpen(false);
      setNewPasswordVal("");
      toast.add({
        title: "Parol yangilandi",
        description: `${userData.fullName || userData.username} uchun yangi parol muvaffaqiyatli o'rnatildi.`,
        type: "success",
      });
    } else {
      toast.add({
        title: "Xatolik",
        description: "Parolni yangilashda xatolik yuz berdi.",
        type: "danger",
      });
    }
  };

  // Nav items for sidebar
  const navItems: DocumentNavItem[] = [
    {
      id: "general",
      label: "Asosiy va HR",
      icon: User,
      badge: userData.role || undefined,
    },
    {
      id: "permissions",
      label: "Ruxsatlar Matritsasi",
      icon: ShieldCheck,
      badge: "7 ta modul",
    },
    {
      id: "scope",
      label: "Filial va Cheklovlar",
      icon: Building2,
      badge: userData.scope?.allPlants ? "Barchasi" : undefined,
    },
    {
      id: "security",
      label: "Xavfsizlik va Audit",
      icon: KeyRound,
      badge: userData.security?.twoFactorEnabled ? "2FA" : undefined,
    },
  ];

  const canResetPassword =
    currentUser?.role === "admin" && !userData.id.startsWith("user-new-");

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden select-none">
      {/* ── Document Header ────────────────────────────────────────────── */}
      <DocumentHeader
        icon={UserCog}
        title={userData.fullName || userData.username || "Yangi Foydalanuvchi"}
        docNo={userData.code || userData.id}
        status={userData.status}
        actions={
          <div className="flex items-center gap-1.5">
            {/* Admin Reset Password Button */}
            {canResetPassword && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResetPasswordOpen(true)}
                className="h-7 px-2.5 text-xs gap-1 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                title="Foydalanuvchi parolini qayta tiklash"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Parolni tiklash</span>
              </Button>
            )}

            {/* Toggle Active / Suspended */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              className={`h-7 px-2.5 text-xs gap-1 cursor-pointer ${
                userData.status === "Active"
                  ? "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              }`}
            >
              {userData.status === "Active" ? (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Bloklash</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Faollashtirish</span>
                </>
              )}
            </Button>

            {/* Save Button */}
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saqlanmoqda..." : "Saqlash"}</span>
            </Button>

            {/* Close Tab Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => closeTab(tab.id)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      {/* ── Body: Sidebar + Active Tab Content ────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Document Sidebar */}
        <DocumentSidebar
          summary={
            <SidebarSummaryCard
              avatar={
                <Avatar size="sm" className="size-8">
                  {userData.avatar && (
                    <AvatarImage
                      src={userData.avatar}
                      alt={userData.fullName || userData.username}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {getUserInitials(userData.fullName || userData.username, "U")}
                  </AvatarFallback>
                </Avatar>
              }
              title={userData.fullName || userData.username || "Yangi Hisob"}
              subtitle={userData.role || "Operator"}
            >
              <InfoRow label="Login" className="font-mono">
                {userData.username ? `@${userData.username}` : "—"}
              </InfoRow>
              <InfoRow label="Filial">
                {userData.plant || "Bosh Ofis"}
              </InfoRow>
              <InfoRow label="Bo'lim">
                {userData.department || "—"}
              </InfoRow>
              <InfoRow label="Status">
                <Badge
                  variant={userData.status === "Active" ? "default" : "destructive"}
                  className="h-4 text-[10px] px-1 font-normal"
                >
                  {userData.status}
                </Badge>
              </InfoRow>
            </SidebarSummaryCard>
          }
          sectionsLabel="Bo'limlar"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
        />

        {/* Tab Content Canvas */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
          <div className="max-w-5xl mx-auto space-y-4">
            {activeTab === "general" && (
              <UserGeneralTab data={userData} onChange={handleUpdate} />
            )}
            {activeTab === "permissions" && (
              <UserPermissionsTab data={userData} onChange={handleUpdate} />
            )}
            {activeTab === "scope" && (
              <UserScopeTab data={userData} onChange={handleUpdate} />
            )}
            {activeTab === "security" && (
              <UserSecurityTab data={userData} onChange={handleUpdate} />
            )}
          </div>
        </div>
      </div>

      {/* ── Admin Password Reset Modal ──────────────────────────────────── */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span>Foydalanuvchi parolini qayta tiklash</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {userData.fullName || userData.username} ({userData.code}) uchun yangi tizim parolini belgilang.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Yangi parol</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="Yangi parol kiriting"
                  className="h-8 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewPasswordVal(`PrintGoo${Math.floor(100 + Math.random() * 900)}`)}
                  className="h-8 text-[11px] px-2 whitespace-nowrap cursor-pointer"
                >
                  Generatsiya
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Foydalanuvchi tizimga kirishda ushbu paroldan foydalanadi. Saqlangandan so'ng u xavfsiz heshlanadi.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsResetPasswordOpen(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isResetting || !newPasswordVal}
              onClick={handleResetPassword}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {isResetting ? "Saqlanmoqda..." : "Parolni yangilash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
