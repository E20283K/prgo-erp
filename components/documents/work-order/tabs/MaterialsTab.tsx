"use client";

import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import dynamic from "next/dynamic";

const BomMaterialsGrid = dynamic(
  () => import("../../BomMaterialsGrid").then((mod) => mod.BomMaterialsGrid),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
        Loading BOM & Materials Grid...
      </div>
    ),
  }
);

import { MasterSpecification } from "../types";

interface MaterialsTabProps {
  tabId: string;
  department: string;
  recipe?: string;
  activeSpec?: MasterSpecification;
  onRecipeChange?: (code: string, department: string) => void;
  onOpenTab?: (tab: any) => void;
  isOperator?: boolean;
  onSaveAsSpec?: (items: any[]) => void;
  onItemsChange?: (items: any[]) => void;
  initialItems?: any[];
}

export function MaterialsTab({
  tabId,
  department,
  recipe,
  activeSpec,
  onRecipeChange,
  onOpenTab,
  isOperator,
  onSaveAsSpec,
  onItemsChange,
  initialItems,
}: MaterialsTabProps) {
  return (
    <TabsContent value="materials" className="flex-1 overflow-hidden p-0 m-0 h-full flex flex-col data-[state=inactive]:hidden">
      <BomMaterialsGrid
        tabId={tabId}
        department={department}
        recipe={recipe}
        activeSpec={activeSpec}
        initialItems={initialItems}
        onRecipeChange={onRecipeChange}
        onOpenTab={onOpenTab}
        isOperator={isOperator}
        onSaveAsSpec={onSaveAsSpec}
        onItemsChange={onItemsChange}
      />
    </TabsContent>
  );
}
