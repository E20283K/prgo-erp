import type { LucideIcon } from "lucide-react";
import {
  Factory,
  Users,
  ShoppingCart,
  Package,
  Banknote,
  Settings2,
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

// ─── Module Registry ──────────────────────────────────────────────────────────

export const MODULE_NAV: ModuleDef[] = [
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
          { id: "planning", label: "Planning", icon: Calendar },
          { id: "history", label: "History", icon: History },
        ],
      },
      {
        id: "master-data",
        label: "Master Data",
        icon: Database,
        items: [
          { id: "machines", label: "Machines", icon: Cpu },
          { id: "bom", label: "BOM & Spec", icon: Layers },
          { id: "materials", label: "Materials", icon: Scroll },
        ],
      },
      {
        id: "quality",
        label: "Quality",
        icon: ShieldCheck,
        items: [
          { id: "qc-checks", label: "QC Checks", icon: BadgeCheck },
          { id: "defects", label: "Defect Log", icon: AlertOctagon },
        ],
      },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    sections: [
      {
        id: "contacts",
        label: "Contacts",
        icon: Contact,
        defaultOpen: true,
        items: [
          { id: "customers", label: "Customers", icon: Building2 },
          { id: "contacts", label: "Contacts", icon: Users },
          { id: "leads", label: "Leads", icon: UserPlus },
        ],
      },
      {
        id: "activities",
        label: "Activities",
        icon: CheckSquare,
        items: [
          { id: "requests", label: "Requests", icon: ClipboardList },
          { id: "tasks", label: "Tasks", icon: ListTodo },
          { id: "calls", label: "Calls", icon: PhoneCall },
          { id: "pipeline", label: "Pipeline", icon: GitFork },
        ],
      },
      {
        id: "orders",
        label: "Orders",
        icon: FileSignature,
        defaultOpen: true,
        items: [
          { id: "client-orders", label: "Client Orders", icon: ClipboardList },
          { id: "estimates", label: "Cost Estimates", icon: Calculator },
        ],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: ShoppingCart,
    sections: [
      {
        id: "documents",
        label: "Sales & Orders",
        icon: FileText,
        defaultOpen: true,
        items: [
          { id: "quotations", label: "Quotations", icon: FileSignature },
          { id: "orders", label: "Sales History", icon: History },
          { id: "invoices", label: "Invoices", icon: Receipt },
          { id: "returns", label: "Returns", icon: RotateCcw },
          { id: "products", label: "Products", icon: Package },
        ],
      },
      {
        id: "catalog",
        label: "Catalog",
        icon: Tag,
        items: [
          { id: "price-lists", label: "Price Lists", icon: BadgePercent },
          { id: "discounts", label: "Discounts", icon: Percent },
        ],
      },
      {
        id: "retail",
        label: "Retail & POS",
        icon: ShoppingBag,
        items: [
          { id: "pos", label: "Point of Sale", icon: Calculator },
          { id: "shifts", label: "Cashier Shifts", icon: History },
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
        label: "Stock",
        icon: Boxes,
        defaultOpen: true,
        items: [
          { id: "stock-balance", label: "Stock Balance", icon: Layers },
          { id: "movements", label: "Movements", icon: ArrowLeftRight },
          { id: "inventory", label: "Inventory Count", icon: ClipboardCheck },
        ],
      },
      {
        id: "logistics",
        label: "Logistics",
        icon: Truck,
        items: [
          { id: "receipts", label: "Receipts", icon: ArrowDownToLine },
          { id: "shipments", label: "Shipments", icon: Send },
          { id: "locations", label: "Locations", icon: MapPin },
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
        label: "Accounting",
        icon: Calculator,
        defaultOpen: true,
        items: [
          { id: "accounts", label: "Chart of Accounts", icon: BookOpen },
          { id: "payments", label: "Payments", icon: CreditCard },
          { id: "bank", label: "Bank Statements", icon: Landmark },
        ],
      },
      {
        id: "reporting",
        label: "Reporting",
        icon: BarChart3,
        items: [
          { id: "pnl", label: "P&L Report", icon: TrendingUp },
          { id: "budget", label: "Budget", icon: PiggyBank },
          { id: "cost-analysis", label: "Cost Analysis", icon: Scale },
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
        label: "System",
        icon: Sliders,
        defaultOpen: true,
        items: [
          { id: "general", label: "General", icon: SlidersHorizontal },
          { id: "users", label: "Users & Roles", icon: Shield },
          { id: "plants", label: "Plants & Branches", icon: Building },
        ],
      },
      {
        id: "integrations",
        label: "Integrations",
        icon: Plug,
        items: [
          { id: "api", label: "API & Webhooks", icon: Code },
          { id: "billing", label: "Billing & License", icon: Coins },
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
