import { create } from "zustand";

export interface DocumentTab {
  id: string;
  title: string;
  type: "registry" | "work-order" | "bom" | "product-spec" | "customer" | "invoice" | "client-order" | "sales-record";
  module: string;
  isUnsaved?: boolean;
  documentData?: any;
  activeLevel3Tab?: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotifSeverity = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  severity: NotifSeverity;
  timestamp: number; // Date.now()
  read: boolean;
  /** Optional deep-link: module + subModule to navigate to */
  link?: { module: string; subModule: string };
}

export type AppTheme = "dark" | "light";

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  initials: string;
  defaultModule: string;
  avatar?: string;
}

export const DEMO_USERS: Record<string, UserProfile> = {
  operator: {
    name: "Alexey Kovalev",
    email: "a.kovalev@printgoo.com",
    role: "Production Shift Lead",
    initials: "AK",
    defaultModule: "production",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  },
  sales: {
    name: "Elena Voronina",
    email: "e.voronina@printgoo.com",
    role: "Sales & Client Director",
    initials: "EV",
    defaultModule: "sales",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
  },
  admin: {
    name: "Dmitry Morozov",
    email: "admin@printgoo.com",
    role: "System Administrator",
    initials: "DM",
    defaultModule: "settings",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  },
};

interface WorkspaceState {
  tabs: DocumentTab[];
  activeTabId: string;
  activeModule: string;      // top-level ERP module selected in the sidebar rail
  currentModule: string;     // sub-navigation module context
  currentSubModule: string;
  selectedCount: number;
  totalCount: number;
  activeCellCoords: string;
  theme: AppTheme;
  isCommandOpen: boolean;
  sidebarWidth: number;
  isAuthenticated: boolean;
  currentUser: UserProfile;

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: AppNotification[];
  isNotifPanelOpen: boolean;
  setNotifPanelOpen: (open: boolean) => void;
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  dismissNotification: (id: string) => void;
  markAllRead: () => void;
  clearAllNotifications: () => void;

  // ── AI Copilot Chat ────────────────────────────────────────────────────────
  isAiChatOpen: boolean;
  setAiChatOpen: (open: boolean) => void;
  toggleAiChat: () => void;

  // ── Modals ───────────────────────────────────────────────────────────────
  isCreateOrderOpen: boolean;
  setCreateOrderOpen: (open: boolean) => void;
  isCreateWorkOrderOpen: boolean;
  setCreateWorkOrderOpen: (open: boolean) => void;

  // Actions
  openTab: (tab: DocumentTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setActiveModule: (module: string) => void;
  setModule: (mod: string, subMod?: string) => void;
  setSubModule: (subMod: string) => void;
  setTabUnsaved: (id: string, isUnsaved: boolean) => void;
  setLevel3Tab: (tabId: string, level3Tab: string) => void;
  updateGridStats: (selectedCount: number, totalCount: number, cellCoords?: string) => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  setSidebarWidth: (width: number) => void;
  login: (user?: Partial<UserProfile>) => void;
  logout: () => void;
  switchTab: (direction?: "next" | "prev") => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [
    {
      id: "registry-work-orders",
      title: "Work Orders (Registry)",
      type: "registry",
      module: "production",
      isUnsaved: false,
    },
    {
      id: "WO-00351",
      title: "WO-00351: Hardcover Catalog (5k)",
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: "WO-00351",
        customer: "Alpha Media Group LLC",
        product: "A4 Hardcover Catalog 96p",
        quantity: 5000,
        unit: "pcs",
        status: "Active",
        priority: "High",
        orderType: "Production",
        linkedOrderId: "CO-00041",
        pressMachine: "Heidelberg Speedmaster XL 106",
        startDate: "2026-09-30",
        deadline: "2026-10-06",
        prepressStatus: "Approved by Client",
        paperStock: "Galerie Art Silk 150g/m²",
        coating: "Soft-Touch Matte + Spot UV",
        priceTotal: 14850.00,
        currency: "USD",
        responsible: "K. Anderson (Prepress Lead)",
      },
    },
    {
      id: "CO-00041",
      title: "CO-00041: Alpha Media — Catalog",
      type: "client-order",
      module: "crm",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: "CO-00041",
        customer: "Alpha Media Group LLC",
        product: "A4 Hardcover Catalog 96p",
        quantity: 5000,
        unit: "pcs",
        orderType: "Production",
        approvalStatus: "Approved",
        currency: "USD",
        recipe: "OFFSET_STD_V1",
        department: "Offset",
        deadline: "2026-10-06",
        responsible: "Elena Voronina",
        linkedWoId: "WO-00351",
        sampleDispatched: true,
        sampleDispatchDate: "2026-09-27",
        sampleCourier: "Company driver",
        sampleRecipient: "John Smith",
        sampleQty: 5,
      },
    },
  ],
  activeTabId: "registry-work-orders",
  activeModule: "production",
  currentModule: "production",
  currentSubModule: "work-orders",
  selectedCount: 0,
  totalCount: 1250,
  activeCellCoords: "R1:C1",
  theme: "dark",
  isCommandOpen: false,
  sidebarWidth: 280,

  // ── Notifications seed data ─────────────────────────────────────────────────
  isNotifPanelOpen: false,
  notifications: [
    {
      id: "notif-1",
      title: "WO-00351 deadline approaching",
      description: "Hardcover Catalog is due in 6 days. Prepress: Approved.",
      severity: "warning",
      timestamp: Date.now() - 1000 * 60 * 8,
      read: false,
      link: { module: "production", subModule: "work-orders" },
    },
    {
      id: "notif-2",
      title: "Stock alert: Galerie Art Silk 150g",
      description: "Warehouse stock below reorder point (42 sheets remaining).",
      severity: "error",
      timestamp: Date.now() - 1000 * 60 * 35,
      read: false,
      link: { module: "warehouse", subModule: "stock" },
    },
    {
      id: "notif-3",
      title: "Invoice INV-2026-0892 paid",
      description: "Alpha Media Group LLC settled \$14,850.00.",
      severity: "success",
      timestamp: Date.now() - 1000 * 60 * 60 * 2,
      read: false,
      link: { module: "finance", subModule: "invoices" },
    },
    {
      id: "notif-4",
      title: "Sync completed",
      description: "All registries refreshed at 00:58.",
      severity: "info",
      timestamp: Date.now() - 1000 * 60 * 60 * 6,
      read: true,
    },
  ],

  setNotifPanelOpen: (open) => set({ isNotifPanelOpen: open }),

  addNotification: (notif) =>
    set((state) => ({
      notifications: [
        {
          ...notif,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          read: false,
        },
        ...state.notifications,
      ],
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearAllNotifications: () => set({ notifications: [] }),

  // ── AI Copilot Chat state & actions ─────────────────────────────────────────
  isAiChatOpen: false,
  setAiChatOpen: (open) => set({ isAiChatOpen: open }),
  toggleAiChat: () => set((state) => ({ isAiChatOpen: !state.isAiChatOpen })),

  isCreateOrderOpen: false,
  setCreateOrderOpen: (open) => set({ isCreateOrderOpen: open }),
  isCreateWorkOrderOpen: false,
  setCreateWorkOrderOpen: (open) => set({ isCreateWorkOrderOpen: open }),

  openTab: (tab) =>
    set((state) => {
      const exists = state.tabs.find((t) => t.id === tab.id);
      if (exists) {
        return { activeTabId: tab.id };
      }
      return {
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }),

  closeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === id) {
        const closedIndex = state.tabs.findIndex((t) => t.id === id);
        const nextTab = newTabs[closedIndex] || newTabs[closedIndex - 1] || newTabs[0];
        newActiveId = nextTab ? nextTab.id : "";
      }
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  setActiveModule: (module) =>
    set({ activeModule: module, currentModule: module }),

  setModule: (module, subMod = "work-orders") =>
    set({ currentModule: module, currentSubModule: subMod }),

  setSubModule: (subMod) => set({ currentSubModule: subMod }),

  setTabUnsaved: (id, isUnsaved) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, isUnsaved } : t)),
    })),

  setLevel3Tab: (tabId, level3Tab) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, activeLevel3Tab: level3Tab } : t
      ),
    })),

  updateGridStats: (selectedCount, totalCount, cellCoords) =>
    set((state) => ({
      selectedCount,
      totalCount,
      activeCellCoords: cellCoords || state.activeCellCoords,
    })),

  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      try {
        localStorage.setItem("printgoo_theme", theme);
      } catch (e) {}
    }
    set({ theme });
  },

  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        if (nextTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        try {
          localStorage.setItem("printgoo_theme", nextTheme);
        } catch (e) {}
      }
      return { theme: nextTheme };
    });
  },

  setCommandOpen: (open) => set({ isCommandOpen: open }),
  toggleCommand: () => set((state) => ({ isCommandOpen: !state.isCommandOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  isAuthenticated: false,
  currentUser: DEMO_USERS.operator,

  switchTab: (direction = "next") =>
    set((state) => {
      if (state.tabs.length <= 1) return state;
      const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
      const step = direction === "prev" ? -1 : 1;
      let nextIndex = 0;
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + step + state.tabs.length) % state.tabs.length;
      }
      const nextTab = state.tabs[nextIndex];
      if (!nextTab) return state;
      return {
        activeTabId: nextTab.id,
      };
    }),


  login: (user) => {
    set((state) => {
      const updatedUser = user ? { ...state.currentUser, ...user } : state.currentUser;
      try {
        localStorage.setItem("printgoo_auth", "true");
        localStorage.setItem("printgoo_user", JSON.stringify(updatedUser));
      } catch (e) {}
      return {
        isAuthenticated: true,
        currentUser: updatedUser,
        activeModule: updatedUser.defaultModule || state.activeModule,
      };
    });
  },

  logout: () => {
    try {
      localStorage.removeItem("printgoo_auth");
    } catch (e) {}
    set({ isAuthenticated: false });
  },
}));
