"use client";

export function isAppFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.fullscreenElement || (document as any).webkitFullscreenElement
  );
}

export function toggleAppFullscreen(): void {
  if (typeof document === "undefined") return;

  const isFullscreen = Boolean(
    document.fullscreenElement || (document as any).webkitFullscreenElement
  );

  if (isFullscreen) {
    if (typeof navigator !== "undefined" && "keyboard" in navigator && (navigator as any).keyboard?.unlock) {
      (navigator as any).keyboard.unlock();
    }
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    }
  } else {
    const el = document.documentElement;
    const enableKeyLock = () => {
      if (typeof navigator !== "undefined" && "keyboard" in navigator && (navigator as any).keyboard?.lock) {
        (navigator as any).keyboard.lock().catch(() => {});
      }
    };
    if (el.requestFullscreen) {
      el.requestFullscreen().then(enableKeyLock).catch(() => {});
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
      enableKeyLock();
    }
  }
}
