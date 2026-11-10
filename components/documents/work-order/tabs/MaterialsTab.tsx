"use client";

import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import type { DocumentTab } from "@/store/workspaceStore";
import type { BomItem } from "../../BomMaterialsGrid";
import type { MasterSpecification } from "../types";

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

interface MaterialsTabProps {
  tabId: string;
  department: string;
  recipe?: string;
  activeSpec?: MasterSpecification;
  onRecipeChange?: (code: string, department: string) => void;
  onOpenTab?: (tab: DocumentTab) => void;
  isOperator?: boolean;
  onSaveAsSpec?: (items: BomItem[]) => void;
  onItemsChange?: (items: BomItem[]) => void;
  initialItems?: BomItem[];
  currency?: string;
  exchangeRate?: number;
  materialsConsumed?: boolean;
  materialIssueDocNo?: string;
  onExecuteSpisanie?: (customItems?: BomItem[]) => void;
  onOpenIssueTab?: (docNo: string) => void;
  shiftWasteSheets?: number;
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
  currency,
  exchangeRate,
  materialsConsumed,
  materialIssueDocNo,
  onExecuteSpisanie,
  onOpenIssueTab,
  shiftWasteSheets,
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
        currency={currency}
        exchangeRate={exchangeRate}
        materialsConsumed={materialsConsumed}
        materialIssueDocNo={materialIssueDocNo}
        onExecuteSpisanie={onExecuteSpisanie}
        onOpenIssueTab={onOpenIssueTab}
        shiftWasteSheets={shiftWasteSheets}
      />
    </TabsContent>
  );
}
