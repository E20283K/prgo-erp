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

interface MaterialsTabProps {
  tabId: string;
  department: string;
}

export function MaterialsTab({ tabId, department }: MaterialsTabProps) {
  return (
    <TabsContent value="materials" className="flex-1 overflow-hidden p-0 m-0 h-full flex flex-col data-[state=inactive]:hidden">
      <BomMaterialsGrid tabId={tabId} department={department} />
    </TabsContent>
  );
}
