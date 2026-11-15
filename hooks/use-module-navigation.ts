"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { MODULE_NAV, getModule, type ModuleDef } from "@/lib/modules";

/** Modules the current user may view (same rule as the sidebar). */
export function useAllowedModules(): ModuleDef[] {
  const currentUser = useWorkspaceStore((s) => s.currentUser);
  return useMemo(() => {
    if (!currentUser || currentUser.role === "admin" || !currentUser.permissions) {
      return MODULE_NAV;
    }
    return MODULE_NAV.filter((mod) => {
      const perm = (currentUser.permissions as Record<string, { view?: boolean } | undefined>)[mod.id];
      return perm ? perm.view === true : true;
    });
  }, [currentUser]);
}

/** Opens a module registry the same way the sidebar does. */
export function useModuleNavigation() {
  const tMod = useTranslations("Modules");
  const setActiveModule = useWorkspaceStore((s) => s.setActiveModule);
  const setModule = useWorkspaceStore((s) => s.setModule);
  const openTab = useWorkspaceStore((s) => s.openTab);

  const label = useCallback(
    (id: string, fallback: string) => (tMod.has(id) ? tMod(id) : fallback),
    [tMod],
  );

  const openSubItem = useCallback(
    (modId: string, subId: string) => {
      const mod = getModule(modId);
      const item = mod?.sections.flatMap((s) => s.items).find((i) => i.id === subId);
      if (!mod || !item) return;
      const subLabel = label(subId, item.label);
      setActiveModule(modId);
      setModule(modId, subId);
      openTab({
        id: subId === "work-orders" ? "registry-work-orders" : `tab-${modId}-${subId}`,
        title: subId === "work-orders" ? `${subLabel} (${tMod("registry")})` : subLabel,
        type: "registry",
        module: modId,
      });
    },
    [label, setActiveModule, setModule, openTab, tMod],
  );

  const openModule = useCallback(
    (modId: string) => {
      const firstItem = getModule(modId)?.sections[0]?.items[0];
      if (firstItem) openSubItem(modId, firstItem.id);
      else setActiveModule(modId);
    },
    [openSubItem, setActiveModule],
  );

  return { label, openModule, openSubItem };
}
