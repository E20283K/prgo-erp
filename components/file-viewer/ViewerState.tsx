"use client";

import React from "react";
import { TriangleAlert } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export function ViewerLoading({ label }: { label: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <Spinner className="size-5" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function ViewerError({
  message,
  detail,
  icon: Icon = TriangleAlert,
  children,
}: {
  message: string;
  detail?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-center p-6">
      <Icon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
      <p className="text-xs font-medium text-foreground">{message}</p>
      {detail && <p className="text-[11px] text-muted-foreground max-w-md break-words">{detail}</p>}
      {children}
    </div>
  );
}
