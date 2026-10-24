import type { LucideIcon } from "lucide-react";
import {
  Factory,
  Users,
  ShoppingCart,
  Package,
  Banknote,
  Settings2,
  Briefcase,
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
  MessageSquare,
  Contact,
  Building2,
  UserPlus,
  CheckSquare,
  ListTodo,
  PhoneCall,
  GitFork,
  // Sales icons
  FileText,
  ShoppingBag,
  Receipt,
  Tag,
  BadgePercent,
  Percent,
  // Warehouse icons
  Boxes,
  ArrowLeftRight,
  Truck,
  ArrowDownToLine,
  Send,
  MapPin,
  PackageCheck,
  AlertTriangle,
  // Finance icons
  Calculator,
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
  Volume2,
  // HR icons
  UserCheck,
  CalendarClock,
  Clock,
  Award,
  // Trading icons
  Ship,
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
          { id: "telegram-inbox", label: "Telegram Inbox", icon: MessageSquare },
          { id: "customers", label: "Customers", icon: Building2 },
          { id: "suppliers", label: "Suppliers & Partners", icon: Truck },
          { id: "leads", label: "Leads & Requests", icon: UserPlus },
        ],
      },
    ],
  },
  {
    id: "trading",
    label: "Savdo",
    icon: ShoppingCart,
    sections: [
      {
        id: "trading-sales-sec",
        label: "Savdo",
        icon: FileText,
        defaultOpen: true,
        items: [
          { id: "trading-sales", label: "Sotuvlar", icon: Receipt },
          { id: "trading-orders", label: "Buyurtmalar", icon: ShoppingBag },
        ],
      },
      {
        id: "trading-entities-sec",
        label: "Tashkilotlar",
        icon: Building2,
        defaultOpen: true,
        items: [
          { id: "trading-ytt-limits", label: "YTT limitlari", icon: Scale },
          { id: "trading-settlements", label: "Akt-sverka", icon: Calculator },
        ],
      },
      {
        id: "trading-procurement-sec",
        label: "Xaridlar",
        icon: Truck,
        defaultOpen: true,
        items: [
          { id: "trading-imports", label: "Import", icon: Ship },
          { id: "trading-catalog", label: "Katalog", icon: Tag },
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
          { id: "products", label: "Products & BOMs", icon: Layers },
          { id: "machines", label: "Machines & Rates", icon: Cpu },
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
          { id: "requirements", label: "Ehtiyojlar va Defitsit", icon: AlertTriangle },
          { id: "finished-goods", label: "Tayyor Mahsulotlar (Zaxira)", icon: PackageCheck },
          { id: "movements", label: "Movements & Transfers", icon: ArrowLeftRight },
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
          { id: "delivery-acts", label: "Schet-fakturas (Waybills)", icon: Truck },
          { id: "settlements", label: "Client Settlements (Akt sverka)", icon: Scale },
          { id: "payments", label: "Payments & Cashflow", icon: CreditCard },
          { id: "cost-analysis", label: "Order Cost & Margin", icon: TrendingUp },
        ],
      },
    ],
  },
  {
    id: "hr",
    label: "HR & Payroll",
    icon: Users,
    sections: [
      {
        id: "staff",
        label: "Staff & Personnel",
        icon: UserCheck,
        defaultOpen: true,
        items: [
          { id: "employees", label: "Employees Registry", icon: UserCheck },
          { id: "departments", label: "Departments & Workshops", icon: Building2 },
          { id: "positions", label: "Positions & Rates", icon: Briefcase },
        ],
      },
      {
        id: "attendance-sec",
        label: "Time & Attendance",
        icon: CalendarClock,
        defaultOpen: true,
        items: [
          { id: "attendance", label: "Timesheet (T-13)", icon: CalendarClock },
          { id: "shifts", label: "Shift Schedules", icon: Clock },
        ],
      },
      {
        id: "compensation",
        label: "Compensation & Wages",
        icon: Banknote,
        defaultOpen: true,
        items: [
          { id: "piecework", label: "Piecework Wages (Sdelka)", icon: Award },
          { id: "payroll", label: "Payroll Ledger", icon: Calculator },
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
          { id: "notifications-sound", label: "Notifications & Sound", icon: Volume2 },
        ],
      },
      {
        id: "integrations",
        label: "Integrations & API",
        icon: Plug,
        defaultOpen: true,
        items: [
          { id: "telegram-settings", label: "Telegram Bot & API", icon: Send },
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
