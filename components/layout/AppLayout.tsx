"use client";

import React, { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { StatusBar } from "./StatusBar";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toggleAppFullscreen } from "@/lib/fullscreen";
import { CommandPalette } from "@/components/command/CommandPalette";
import { AiChatSheet } from "./AiChatSheet";
import { Toaster } from "@/components/ui/toast";
import { MODULE_NAV } from "@/lib/modules";
import { ElementInspectorOverlay } from "@/components/dev/ElementInspectorOverlay";


export function AppLayout({ children }: { children: React.ReactNode }) {
  const { 
    setTheme, 
    isCommandOpen, 
    toggleCommand, 
    sidebarWidth, 
    setSidebarWidth, 
    activeTabId,
    showStatusBar,
    setShowStatusBar
  } = useWorkspaceStore();

  const isPOSActive = activeTabId.includes("pos");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("printgoo_theme") as "dark" | "light" | null;
      if (savedTheme) {
        setTheme(savedTheme);
      } else {
        setTheme("dark");
      }

      const savedWidth = localStorage.getItem("printgoo_sidebar_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 200 && parsed <= 500) {
          setSidebarWidth(parsed === 280 ? 300 : parsed);
        }
      }

      const savedStatusBar = localStorage.getItem("printgoo_show_status_bar");
      if (savedStatusBar !== null) {
        setShowStatusBar(savedStatusBar === "true");
      }
    } catch (e) {}
  }, [setTheme, setSidebarWidth, setShowStatusBar]);
  useEffect(() => {
    // 1. Block the default right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      // Allow right-click on input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      e.preventDefault();
    };

    // 2. Block standard browser keyboard shortcuts & unify F11 fullscreen
    const handleKeyDown = (e: KeyboardEvent) => {
      // 0. Ctrl+Shift+C / Cmd+Shift+C: Toggle AI Element & Container Inspector
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === "c" || e.code === "KeyC")) {
        e.preventDefault();
        e.stopPropagation();
        useWorkspaceStore.getState().toggleInspectorMode();
        return;
      }

      // 1. Ctrl+K / Cmd+K: Activate or toggle Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        useWorkspaceStore.getState().toggleCommand();
        return;
      }

      // 2. Esc: Exit Inspector Mode first if active
      if (e.key === "Escape") {
        const store = useWorkspaceStore.getState();
        if (store.isInspectorActive) {
          e.preventDefault();
          e.stopPropagation();
          store.setInspectorActive(false);
          return;
        }
      }

      // 3. Ctrl+J / Cmd+J: Toggle AI Copilot Chat Sheet
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        e.stopPropagation();
        useWorkspaceStore.getState().toggleAiChat();
        return;
      }

      // Explicitly block Ctrl+T / Cmd+T (New Tab in browser)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 4. Ctrl+W / Cmd+W: Close active tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        e.stopPropagation();
        const store = useWorkspaceStore.getState();
        if (store.activeTabId) {
          store.requestCloseTab(store.activeTabId);
        }
        return;
      }

      // 5. Ctrl+Tab / Ctrl+Shift+Tab: Switch between tabs
      if ((e.ctrlKey || e.metaKey) && (e.key === "Tab" || e.code === "Tab")) {
        e.preventDefault();
        e.stopPropagation();
        useWorkspaceStore.getState().switchTab(e.shiftKey ? "prev" : "next");
        return;
      }


      // 6. Switch ERP Module: Alt+1..6, Ctrl+Shift+1..6, or Ctrl/Cmd+1..6
      // IMPORTANT: Never intercept when focus is inside an editable input/textarea/contenteditable!
      const isInputFocused =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      const codeMatch = e.code.match(/^(?:Digit|Numpad)([1-6])$/);
      const keyMatch = e.key.match(/^[1-6]$/);
      const digit = codeMatch ? parseInt(codeMatch[1], 10) : (keyMatch ? parseInt(keyMatch[0], 10) : null);

      if (!isInputFocused && digit !== null && digit >= 1 && digit <= MODULE_NAV.length) {
        const isAlt = e.altKey && !e.ctrlKey && !e.metaKey;
        const isCtrlShift = (e.ctrlKey || e.metaKey) && e.shiftKey;
        const isCtrlCmd = (e.ctrlKey || e.metaKey) && !e.altKey;

        if (isAlt || isCtrlShift || isCtrlCmd) {
          e.preventDefault();
          e.stopPropagation();
          const targetMod = MODULE_NAV[digit - 1];
          if (targetMod) {
            const store = useWorkspaceStore.getState();
            if (store.isCommandOpen) {
              store.setCommandOpen(false);
            }
            const firstItem = targetMod.sections[0]?.items[0];
            store.setActiveModule(targetMod.id);
            if (firstItem) {
              store.setModule(targetMod.id, firstItem.id);
              store.openTab({
                id: firstItem.id === "work-orders" ? "registry-work-orders" : `tab-${targetMod.id}-${firstItem.id}`,
                title: firstItem.id === "work-orders" ? `${firstItem.label} (Registry)` : firstItem.label,
                type: "registry",
                module: targetMod.id,
              });
            }
          }
          return;
        }
      }

      // Allow standard text operations: Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+Z, Ctrl+J
      const allowedCtrlKeys = ['c', 'v', 'x', 'a', 'z', 'j'];

      
      if ((e.ctrlKey || e.metaKey) && !allowedCtrlKeys.includes(e.key.toLowerCase())) {
        e.preventDefault(); // Blocks Ctrl+S, Ctrl+P, Ctrl+F, etc.
      }

      // Intercept F11: trigger HTML5 document fullscreen instead of browser window fullscreen.
      // This guarantees the in-app toggle button, F11, and Esc all stay in 100% sync.
      if (e.key === "F11") {
        e.preventDefault();
        e.stopPropagation();
        toggleAppFullscreen();
        return;
      }
      
      // Block common function keys like F3 (Find), F12 (DevTools)
      if (['F3', 'F12'].includes(e.key)) {
        e.preventDefault();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && typeof navigator !== "undefined" && "keyboard" in navigator && (navigator as any).keyboard?.unlock) {
        (navigator as any).keyboard.unlock();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return (
    <SidebarProvider
      defaultOpen={true}
      className="h-screen w-screen overflow-hidden bg-background font-sans antialiased select-none"
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as React.CSSProperties
      }
    >
      {/* 300px Enterprise 1C Collapsible Sidebar */}
      <Sidebar />

      {/* Main App Canvas */}
      <SidebarInset className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* VS Code + 1C Document Workspace */}
        <Workspace>{children}</Workspace>

        {/* High-Utility Developer Tools Status Bar */}
        {!isPOSActive && showStatusBar && <StatusBar />}
      </SidebarInset>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette />

      {/* AI Copilot Chat Sheet (Ctrl+J or Topbar/Command) */}
      <AiChatSheet />

      {/* Global Toast Notification System */}
      <Toaster />

      {/* AI UI Element & Container Inspector Overlay (Ctrl+Shift+C) */}
      <ElementInspectorOverlay />
    </SidebarProvider>
  );
}

