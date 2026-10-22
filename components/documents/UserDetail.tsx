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
    setTabUnsaved,
    updateTabData,
    closeTab,
    addNotification,
  } = useWorkspaceStore();

  // Resolve user ID from tab data or tab id
  const userId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("user-new-")) return tab.id;
    if (tab.id.startsWith("user-")) return tab.id.replace("user-", "");
    return tab.id;
  }, [tab]);

  // Find matching record from store, or fallback
  const storeUser = useMemo(() => {
    if (tab.documentData && (tab.documentData.username || tab.documentData.fullName)) {
      return tab.documentData as SystemUserRecord;
    }
    const list = users && users.length > 0 ? users : INITIAL_SYSTEM_USERS;
    const found = list.find(
      (u) =>
        u.id === userId ||
        u.code?.toLowerCase() === userId.toLowerCase() ||
        u.username?.toLowerCase() === userId.toLowerCase()
    );
    if (found) return found;

    // Check if new draft
    if (tab.id.startsWith("user-new-") || userId.startsWith("user-new-")) {
      const nextNum = (users?.length || 0) + 1;
      const customCode = `USR-${String(nextNum).padStart(3, "0")}`;
      return createEmptyUser(customCode);
    }

    return INITIAL_SYSTEM_USERS[0];
  }, [users, userId, tab.documentData, tab.id]);

  const [userData, setUserData] = useState<SystemUserRecord>(storeUser);
  const [activeTab, setActiveTab] = useState<string>(
    tab.activeLevel3Tab || "general"
  );
  const [isSaved, setIsSaved] = useState(false);

  // Sync state if tab documentData changes externally
  useEffect(() => {
    if (tab.documentData && tab.documentData.id === userData.id) {
      setUserData(tab.documentData);
    }
  }, [tab.documentData, userData.id]);

  const handleUpdate = (updated: Partial<SystemUserRecord>) => {
    setUserData((prev) => ({
      ...prev,
      ...updated,
      updatedAt: new Date().toISOString(),
    }));
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handleSave = () => {
    if (!userData.username && !userData.fullName) {
      addNotification({
        title: "Xatolik: Login yoki F.I.Sh kiritilishi shart",
        description: "Foydalanuvchi hisobini saqlashdan oldin login va F.I.Sh maydonlarini to'ldiring.",
        severity: "error",
      });
      return;
    }

    // Generate valid id & code if draft
    const finalUser: SystemUserRecord = {
      ...userData,
      id: userData.id.startsWith("user-new-") ? userData.code || `USR-${Date.now().toString().slice(-4)}` : userData.id,
      code: userData.code || userData.id,
      updatedAt: new Date().toISOString(),
    };

    upsertUser(finalUser);
    updateTabData(tab.id, finalUser);
    setTabUnsaved(tab.id, false);
    setIsSaved(true);

    addNotification({
      title: "Foydalanuvchi muvaffaqiyatli saqlandi",
      description: `${finalUser.fullName || finalUser.username} (${finalUser.code}) ma'lumotlari yangilandi.`,
      severity: "success",
    });
  };

  const handleToggleStatus = () => {
    const nextStatus = userData.status === "Active" ? "Suspended" : "Active";
    handleUpdate({ status: nextStatus });
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
            {/* Toggle Active / Suspended */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              className={`h-7 px-2.5 text-xs gap-1 ${
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
              onClick={handleSave}
              className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Saqlash</span>
            </Button>

            {/* Close Tab Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => closeTab(tab.id)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
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
              icon={User}
              title={userData.fullName || userData.username || "Yangi Hisob"}
              subtitle={userData.role || "Operator"}
            >
              <InfoRow label="Login" className="font-mono">
                {userData.username ? `@${userData.username}` : "—"}
              </InfoRow>
              <InfoRow label="Filial">
                {userData.plant || "Bosh Ofis"}
              </InfoRow>
              <InfoRow label="Status">
                <span
                  className={
                    userData.status === "Active"
                      ? "text-emerald-600 font-semibold"
                      : "text-red-600 font-semibold"
                  }
                >
                  {userData.status}
                </span>
              </InfoRow>
              <InfoRow label="2FA">
                {userData.security?.twoFactorEnabled ? "Yoqilgan" : "O'chirilgan"}
              </InfoRow>
              <InfoRow label="Tili">
                {userData.language === "uz"
                  ? "O'zbekcha"
                  : userData.language === "ru"
                  ? "Русский"
                  : userData.language === "en"
                  ? "English"
                  : "Türkçe"}
              </InfoRow>
            </SidebarSummaryCard>
          }
          sectionsLabel="Foydalanuvchi Sozlamalari"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
        />

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
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
  );
}
