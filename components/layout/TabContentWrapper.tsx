import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DocumentTabContextValue {
  tabId: string;
  tabType: string;
  isActive: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const DocumentTabContext = createContext<DocumentTabContextValue | null>(null);

/** The workspace tab a document is rendered in, or null outside tabs. */
export function useDocumentTab() {
  return useContext(DocumentTabContext);
}

export function TabContentWrapper({
  isActive,
  tabId,
  tabType,
  children,
}: {
  isActive: boolean;
  tabId: string;
  tabType: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      // Force window resize event to make canvas grids (Glide Data Grid) redraw on next frame
      const raf = requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isActive]);

  const ctx = useMemo(
    () => ({ tabId, tabType, isActive, containerRef }),
    [tabId, tabType, isActive]
  );

  return (
    <DocumentTabContext.Provider value={ctx}>
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 h-full w-full overflow-hidden",
          isActive ? "block pointer-events-auto z-10" : "hidden pointer-events-none z-0"
        )}
      >
        {children}
      </div>
    </DocumentTabContext.Provider>
  );
}
