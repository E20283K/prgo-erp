"use client";

import * as React from "react";
import {
  ChevronRight,
  ChevronsUpDown,
  Sparkles,
  BadgeCheck,
  CreditCard,
  Bell,
  LogOut,
  Check,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { MODULE_NAV } from "@/lib/modules";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Avatar, AvatarFallback, AvatarImage, AvatarBadge } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Kbd } from "@/components/ui/kbd";

// ─── Constants ────────────────────────────────────────────────────────────────

// Module accent colours — used for the icon tile background
const MODULE_COLORS: Record<string, string> = {
  production: "bg-blue-600",
  crm:        "bg-violet-600",
  sales:      "bg-emerald-600",
  warehouse:  "bg-amber-600",
  finance:    "bg-rose-600",
  settings:   "bg-zinc-600",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const tSide = useTranslations("Sidebar");
  const tMod = useTranslations("Modules");
  const tAuth = useTranslations("Auth");

  const {
    activeModule,
    currentSubModule,
    setActiveModule,
    setModule,
    openTab,
    currentUser,
    logout,
  } = useWorkspaceStore();

  const getRoleLabel = (role: string) => {
    if (role === "Production Shift Lead" && tAuth.has("roleShiftLead")) return tAuth("roleShiftLead");
    if (role === "Sales & Client Director" && tAuth.has("roleSalesDirector")) return tAuth("roleSalesDirector");
    if (role === "System Administrator" && tAuth.has("roleSysAdmin")) return tAuth("roleSysAdmin");
    return role;
  };

  // Resolve the currently active module definition
  const activeMod = MODULE_NAV.find((m) => m.id === activeModule) ?? MODULE_NAV[0];
  const ActiveModIcon = activeMod.icon;
  const activeModColor = MODULE_COLORS[activeMod.id] ?? "bg-zinc-600";
  const activeModLabel = tMod.has(activeMod.id) ? tMod(activeMod.id) : activeMod.label;

  const handleModuleSelect = (modId: string) => {
    const mod = MODULE_NAV.find((m) => m.id === modId);
    const firstItem = mod?.sections[0]?.items[0];
    const modLabel = tMod.has(modId) ? tMod(modId) : (mod?.label ?? modId);
    setActiveModule(modId);
    if (firstItem) {
      const itemLabel = tMod.has(firstItem.id) ? tMod(firstItem.id) : firstItem.label;
      setModule(modId, firstItem.id);
      openTab({
        id: firstItem.id === "work-orders" ? "registry-work-orders" : `tab-${modId}-${firstItem.id}`,
        title: firstItem.id === "work-orders" ? `${itemLabel} (${tMod("registry")})` : itemLabel,
        type: "registry",
        module: modId,
      });
    }
  };

  const handleSubItemClick = (subId: string, defaultLabel: string) => {
    const subLabel = tMod.has(subId) ? tMod(subId) : defaultLabel;
    setModule(activeMod.id, subId);
    openTab({
      id: subId === "work-orders" ? "registry-work-orders" : `tab-${activeMod.id}-${subId}`,
      title: subId === "work-orders" ? `${subLabel} (${tMod("registry")})` : subLabel,
      type: "registry",
      module: activeMod.id,
    });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar select-none" {...props}>

      {/* ── Header: Module switcher ─────────────────────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  />
                }
              >
                <div className={`flex aspect-square size-8 items-center justify-center rounded-lg ${activeModColor} text-white shadow-xs`}>
                  <ActiveModIcon className="size-4 text-white" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-sidebar-foreground">
                    {activeModLabel}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {tSide("erpModule")}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-64 rounded-lg" side="right" align="start" sideOffset={8}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {tSide("modules")}
                  </DropdownMenuLabel>
                  {MODULE_NAV.map((mod, index) => {
                    const ModIcon = mod.icon;
                    const color = MODULE_COLORS[mod.id] ?? "bg-zinc-600";
                    const modName = tMod.has(mod.id) ? tMod(mod.id) : mod.label;
                    return (
                      <DropdownMenuItem
                        key={mod.id}
                        onClick={() => handleModuleSelect(mod.id)}
                        className="gap-2 p-2 cursor-pointer"
                      >
                        <div className={`flex size-6 items-center justify-center rounded-sm ${color} shrink-0`}>
                          <ModIcon className="size-3.5 text-white shrink-0" />
                        </div>
                        <span className="flex-1 text-sm font-medium text-foreground truncate">
                          {modName}
                        </span>
                        {mod.id === activeModule && (
                          <Check className="size-3.5 text-primary shrink-0" />
                        )}
                        <Kbd className="ml-auto opacity-60 bg-muted border-muted-foreground/20">
                          <span className="text-[11px]">⌘</span>{index + 1}
                        </Kbd>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content: Active module nav — changes when module is switched ── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2">
            {activeModLabel}
          </SidebarGroupLabel>
          <SidebarMenu>
            {activeMod.sections.map((section) => {
              const SectionIcon = section.icon;
              const sectionName = tMod.has(section.id) ? tMod(section.id) : section.label;
              return (
                <Collapsible
                  key={section.id}
                  defaultOpen={section.defaultOpen ?? false}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton
                          tooltip={sectionName}
                          isActive={section.items.some((i) => i.id === currentSubModule)}
                        />
                      }
                    >
                      {SectionIcon && <SectionIcon className="size-4 shrink-0 text-muted-foreground" />}
                      <span className="font-medium">{sectionName}</span>
                      <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {section.items.map((item) => {
                          const ItemIcon = item.icon;
                          const itemName = tMod.has(item.id) ? tMod(item.id) : item.label;
                          return (
                            <SidebarMenuSubItem key={item.id}>
                              <SidebarMenuSubButton
                                render={<button type="button" />}
                                isActive={currentSubModule === item.id}
                                onClick={() => handleSubItemClick(item.id, item.label)}
                                className="cursor-pointer"
                              >
                                {ItemIcon && <ItemIcon className="size-3.5 shrink-0" />}
                                <span>{itemName}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: User Menu ─────────────────────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar className="size-8">
                  {currentUser.avatar && (
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                  )}
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {currentUser.initials}
                  </AvatarFallback>
                  <AvatarBadge className="bg-emerald-500" />
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-sidebar-foreground">{currentUser.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{getRoleLabel(currentUser.role)}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-lg" align="end" side="top" sideOffset={4}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="size-8">
                        {currentUser.avatar && (
                          <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                        )}
                        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                          {currentUser.initials}
                        </AvatarFallback>
                        <AvatarBadge className="bg-emerald-500" />
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold text-foreground">{currentUser.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{currentUser.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="gap-2 cursor-pointer">
                    <BadgeCheck className="size-4 text-muted-foreground" />
                    <span>{tSide("accountDetails")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer">
                    <Bell className="size-4 text-muted-foreground" />
                    <span>{tSide("notifications")}</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem 
                    onClick={() => logout()}
                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="size-4" />
                    <span>{tSide("logout")}</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export { AppSidebar as Sidebar };
