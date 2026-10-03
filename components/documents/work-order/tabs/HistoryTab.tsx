"use client";

import React from "react";
import { TabsContent } from "@/components/ui/tabs";

export function HistoryTab() {
  return (
    <TabsContent value="history" className="flex-1 p-4 m-0">
      <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-500 font-mono text-[11px] space-y-1">
        <div>[2026-09-29 14:20:00] Document created by K. Anderson (Prepress Lead)</div>
        <div>[2026-09-29 15:45:12] Status changed to &quot;Active&quot; by Shift Supervisor</div>
        <div>[2026-09-29 16:30:00] Material Reservation confirmed in Warehouse DB</div>
        <div>[2026-09-30 08:15:00] Shift 1 (Day Shift) assigned to K. Anderson</div>
      </div>
    </TabsContent>
  );
}
