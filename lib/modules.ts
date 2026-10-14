import type { LucideIcon } from "lucide-react";
import {
  Factory,
  Users,
  ShoppingCart,
  Package,
  Banknote,
  Settings2,
  Briefcase,
  FileCheck,
  // Production icons
  PlayCircle,
  ClipboardList,
  Calendar,
  History,
  Database,
  Cpu,
  Layers,
  Scroll,
  ShieldCheck,
  BadgeCheck,
  AlertOctagon,
  // CRM icons
  Contact,
  Building2,
  UserPlus,
  CheckSquare,
  ListTodo,
  PhoneCall,
  GitFork,
  // Sales icons
  FileText,
  FileSignature,
  ShoppingBag,
  Receipt,
  RotateCcw,
  Tag,
  BadgePercent,
  Percent,
  // Warehouse icons
  Boxes,
  ArrowLeftRight,
  ClipboardCheck,
  Truck,
  ArrowDownToLine,
  Send,
  MapPin,
  // Finance icons
  Calculator,
  BookOpen,
  CreditCard,
  Landmark,
  BarChart3,
  TrendingUp,
  PiggyBank,
  Scale,
  // Settings icons
  Sliders,
  SlidersHorizontal,
  Shield,
  Building,
  Plug,
  Code,
  Coins,
  Stamp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavSubItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

export interface NavSection {
  id: string;
  label: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  items: NavSubItem[];
}

export interface ModuleDef {
  id: string;
  label: string;
  icon: LucideIcon;
  sections: NavSection[];
}

// ─── Module Registry (Production-Ready Architecture) ──────────────────────────

export const MODULE_NAV: ModuleDef[] = [
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    sections: [
      {
        id: "contacts",
        label: "Counterparties",
        icon: Contact,
        defaultOpen: true,
        items: [
          { id: "customers", label: "Customers", icon: Building2 },
          { id: "leads", label: "Leads & Requests", icon: UserPlus },
        ],
      },
      {
        id: "activities",
        label: "Activities",
        icon: CheckSquare,
        defaultOpen: true,
        items: [
          { id: "tasks", label: "Tasks & Assignments", icon: ListTodo },
        ],
      },
    ],
  },
  {
    id: "sales",
    label: "Commercial",
    icon: Briefcase,
    sections: [
      {
        id: "documents",
        label: "Commercial Documents",
        icon: FileText,
        defaultOpen: true,
        items: [
          { id: "client-orders", label: "Client Orders", icon: ClipboardList },
          { id: "quotations", label: "Quotations", icon: FileSignature },
          { id: "contracts", label: "Contracts & Agreements", icon: FileCheck },
          { id: "delivery-acts", label: "Schet-fakturas (Waybills)", icon: Truck },
          { id: "returns", label: "Customer Claims", icon: RotateCcw },
        ],
      },
      {
        id: "catalog",
        label: "Service Templates",
        icon: Tag,
        defaultOpen: true,
        items: [
          { id: "products", label: "Print Services & Templates", icon: Layers },
        ],
      },
    ],
  },
  {
    id: "production",
    label: "Production",
    icon: Factory,
    sections: [
      {
        id: "operations",
        label: "Operations",
        icon: PlayCircle,
        defaultOpen: true,
        items: [
          { id: "work-orders", label: "Work Orders", icon: ClipboardList },
          { id: "planning", label: "Production Planning", icon: Calendar },
        ],
      },
      {
        id: "master-data",
        label: "Master Data",
        icon: Database,
        defaultOpen: true,
        items: [
          { id: "machines", label: "Machines & Rates", icon: Cpu },
          { id: "bom", label: "BOM & Recipes", icon: Layers },
          { id: "tooling", label: "Dies & Tooling", icon: Stamp },
        ],
      },
    ],
  },
  {
    id: "warehouse",
    label: "Warehouse",
    icon: Package,
    sections: [
      {
        id: "stock",
        label: "Stock & Inventory",
        icon: Boxes,
        defaultOpen: true,
        items: [
          { id: "stock-balance", label: "Stock Balance", icon: Layers },
          { id: "movements", label: "Movements & Write-offs", icon: ArrowLeftRight },
          { id: "inventory", label: "Inventory Count", icon: ClipboardCheck },
        ],
      },
      {
        id: "logistics",
        label: "Logistics",
        icon: Truck,
        defaultOpen: true,
        items: [
          { id: "receipts", label: "Receipts", icon: ArrowDownToLine },
          { id: "shipments", label: "Shipments", icon: Send },
        ],
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Banknote,
    sections: [
      {
        id: "accounting",
        label: "Accounting & Settlements",
        icon: Calculator,
        defaultOpen: true,
        items: [
          { id: "settlements", label: "Client Settlements (Akt sverka)", icon: Scale },
          { id: "payments", label: "Payments & Cashflow", icon: CreditCard },
          { id: "cost-analysis", label: "Order Cost & Margin", icon: TrendingUp },
          { id: "accounts", label: "Chart of Accounts", icon: BookOpen },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings2,
    sections: [
      {
        id: "system",
        label: "Enterprise Configuration",
        icon: Sliders,
        defaultOpen: true,
        items: [
          { id: "plants", label: "Company & Branches", icon: Building },
          { id: "users", label: "Users & Roles", icon: Shield },
          { id: "tariffs", label: "Tariffs & Pricing Rules", icon: Coins },
        ],
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find a module by ID, returns undefined if not found */
export function getModule(id: string): ModuleDef | undefined {
  return MODULE_NAV.find((m) => m.id === id);
}

/** Find a sub-item label by module + sub-item ID */
export function getSubItemLabel(moduleId: string, subItemId: string): string {
  const mod = getModule(moduleId);
  if (!mod) return subItemId;
  for (const section of mod.sections) {
    const item = section.items.find((i) => i.id === subItemId);
    if (item) return item.label;
  }
  return subItemId;
}
