"use client";

import React from "react";
import { History, User, Cog, CheckCircle2, Clock } from "lucide-react";
import { AuditLogItem } from "../types";

interface Props {
  events?: AuditLogItem[];
}

export function AuditTab({ events = [] }: Props) {
  const defaultEvents: AuditLogItem[] = [
    {
      id: "init-1",
      action: "Document Created",
      detail: "Created by System via Quick Add",
      user: "System",
      timestamp: "Today, 10:23 AM",
    },
  ];

  const allEvents = [...events, ...defaultEvents];

  return (
    <div className="bg-card border border-border rounded-md p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-xs">
          <History className="w-4 h-4 text-blue-600" />
          Audit Trail & Calculation History ({allEvents.length})
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">Immutable Log</span>
      </div>

      <div className="space-y-3">
        {allEvents.map((item) => {
          const isFlexo = item.action.toLowerCase().includes("cylinder") ||
                          item.action.toLowerCase().includes("flexo") ||
                          item.action.toLowerCase().includes("material") ||
                          item.action.toLowerCase().includes("across");

          return (
            <div key={item.id} className="flex gap-3 items-start p-2 rounded-md hover:bg-muted/30 transition-colors">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                  isFlexo
                    ? "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300"
                    : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                }`}
              >
                {isFlexo ? <Cog className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground text-xs">{item.action}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{item.timestamp}</span>
                </div>
                <p className="text-muted-foreground text-xs">{item.detail}</p>
                <div className="text-[10px] text-muted-foreground/75 font-mono">User: {item.user}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
