import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function TabContentWrapper({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      // Force window resize event to make canvas grids (Glide Data Grid) redraw
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 10);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 h-full w-full overflow-hidden",
        isActive ? "block pointer-events-auto z-10" : "hidden pointer-events-none z-0"
      )}
    >
      {children}
    </div>
  );
}
