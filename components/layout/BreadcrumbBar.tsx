"use client";

import React from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { cn } from "cn";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getModule } from "@/lib/modules";
import { useAllowedModules, useModuleNavigation } from "@/hooks/use-module-navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const crumbBtn =
  "flex items-center gap-1 h-5 px-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer min-w-0 data-[popup-open]:bg-muted data-[popup-open]:text-foreground";

function Separator() {
  return <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />;
}

/** Navigation breadcrumb shown in the bottom bar for non-admin users. */
export function BreadcrumbBar() {
  const { tabs, activeTabId, activeModule, currentSubModule } = useWorkspaceStore();
  const allowedModules = useAllowedModules();
  const { label, openModule, openSubItem } = useModuleNavigation();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isDocument = Boolean(activeTab && activeTab.type !== "registry");

  const moduleId = isDocument && activeTab && getModule(activeTab.module) ? activeTab.module : activeModule;
  const mod = getModule(moduleId);
  const section = mod?.sections.find((s) => s.items.some((i) => i.id === currentSubModule));
  const item = section?.items.find((i) => i.id === currentSubModule);

  const ModIcon = mod?.icon;

  return (
    <footer className="h-7 bg-card border-t border-border flex items-center px-2 text-xs select-none shrink-0 z-20">
      <nav aria-label="breadcrumb" className="flex items-center gap-0.5 min-w-0 overflow-hidden">
        {/* Module */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className={cn(crumbBtn, "text-foreground font-medium")} />}>
            {ModIcon && <ModIcon className="size-3.5 shrink-0" />}
            <span className="truncate">{mod ? label(mod.id, mod.label) : moduleId}</span>
            <ChevronDown className="size-3 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-52 p-1">
            {allowedModules.map((m) => {
              const Icon = m.icon;
              return (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => openModule(m.id)}
                  className="gap-2 h-7 text-xs cursor-pointer"
                >
                  <Icon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className={cn("flex-1 truncate", m.id === moduleId && "font-semibold text-foreground")}>
                    {label(m.id, m.label)}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Section */}
        {mod && section && (
          <>
            <Separator />
            <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" className={crumbBtn} />}>
                <span className="truncate">{label(section.id, section.label)}</span>
                <ChevronDown className="size-3 shrink-0 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-52 p-1">
                {mod.sections.map((s) => {
                  const Icon = s.icon;
                  const first = s.items[0];
                  if (!first) return null;
                  return (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => openSubItem(mod.id, first.id)}
                      className="gap-2 h-7 text-xs cursor-pointer"
                    >
                      {Icon && <Icon className="size-3.5 text-muted-foreground shrink-0" />}
                      <span className={cn("flex-1 truncate", s.id === section.id && "font-semibold text-foreground")}>
                        {label(s.id, s.label)}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Sub-item */}
        {mod && section && item && (
          <>
            <Separator />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" className={cn(crumbBtn, !isDocument && "text-foreground font-medium")} />}
              >
                <span className="truncate">{label(item.id, item.label)}</span>
                <ChevronDown className="size-3 shrink-0 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-56 p-1">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {label(section.id, section.label)}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />
                  {section.items.map((i) => {
                    const Icon = i.icon;
                    return (
                      <DropdownMenuItem
                        key={i.id}
                        onClick={() => openSubItem(mod.id, i.id)}
                        className="gap-2 h-7 text-xs cursor-pointer"
                      >
                        {Icon && <Icon className="size-3.5 text-muted-foreground shrink-0" />}
                        <span className={cn("flex-1 truncate", i.id === item.id && "font-semibold text-foreground")}>
                          {label(i.id, i.label)}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Open document */}
        {isDocument && activeTab && (
          <>
            <Separator />
            <span className="flex items-center gap-1 h-5 px-1.5 text-foreground font-medium min-w-0" aria-current="page">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate max-w-[320px]">{activeTab.title}</span>
              {activeTab.isUnsaved && <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />}
            </span>
          </>
        )}
      </nav>
    </footer>
  );
}
