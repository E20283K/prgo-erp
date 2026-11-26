"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  ensureComponentIndexLoaded,
  getIndexedLineCount,
  subscribeComponentIndex,
} from "./elementInspector";

/** Live line count of a source file from the dev source index; null while loading. */
export function useSourceLineCount(relativePath: string | undefined): number | null {
  useEffect(() => {
    void ensureComponentIndexLoaded();
  }, []);
  return useSyncExternalStore(
    subscribeComponentIndex,
    () => (relativePath ? getIndexedLineCount(relativePath) : null),
    () => null
  );
}
