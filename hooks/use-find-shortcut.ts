import { useEffect, useRef, type RefObject } from "react";

/**
 * Ctrl+F / Cmd+F focuses (and selects) a grid's search input instead of
 * opening the browser's find bar.
 *
 * Every mounted hook registers its input in one shared stack, and a single
 * window listener picks the most recently mounted input that is currently
 * visible. So a detail view opened over a registry wins over the registry
 * behind it, and inputs in hidden tabs are ignored.
 */
const stack: RefObject<HTMLInputElement | null>[] = [];

function isUsable(el: HTMLInputElement | null): el is HTMLInputElement {
  return !!el && !el.disabled && el.getClientRects().length > 0 && !el.closest("[inert]");
}

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.altKey || e.shiftKey) return;
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "f") return;
  for (let i = stack.length - 1; i >= 0; i--) {
    const el = stack[i].current;
    if (!isUsable(el)) continue;
    e.preventDefault();
    el.focus();
    el.select();
    return;
  }
}

export function useFindShortcut() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stack.length === 0) window.addEventListener("keydown", onKeyDown, true);
    stack.push(ref);
    return () => {
      const i = stack.indexOf(ref);
      if (i !== -1) stack.splice(i, 1);
      if (stack.length === 0) window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return ref;
}
