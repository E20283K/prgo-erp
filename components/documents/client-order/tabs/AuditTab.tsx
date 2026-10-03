"use client";

import React from "react";
import { History, User } from "lucide-react";

export function AuditTab() {
  return (
    <div className="bg-card border border-border rounded-md p-4">
      <h3 className="font-semibold text-foreground pb-2 border-b border-border mb-4 flex items-center gap-2">
        <History className="w-4 h-4 text-blue-600" />
        Audit Trail
      </h3>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex justify-between">
              <span className="font-medium text-foreground">Document Created</span>
              <span className="text-muted-foreground">Today, 10:23 AM</span>
            </div>
            <p className="text-muted-foreground">Created by System via Quick Add</p>
          </div>
        </div>
      </div>
    </div>
  );
}
