export type ModulePermissionKey =
  | "crm"
  | "trading"
  | "production"
  | "warehouse"
  | "finance"
  | "hr"
  | "settings";

export interface ActionPermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

export type UserPermissions = Record<ModulePermissionKey, ActionPermission>;

export interface UserScope {
  allPlants: boolean;
  plantIds: string[];
  viewCostPrice: boolean; // Tannarxni ko'rish ruxsati
  viewMargin: boolean; // Savdo marjasi va rentabellikni ko'rish
  maxDiscountPercent: number; // Chegirma limiti (%)
  ownDocumentsOnly: boolean; // Faqat o'ziga biriktirilgan mijozlar/hujjatlar
}

export interface UserAuditEntry {
  id: string;
  action: string;
  ip: string;
  device: string;
  timestamp: string;
  status: "success" | "warning" | "failed";
}

export interface UserSecurity {
  twoFactorEnabled: boolean;
  sessionTimeoutMinutes: number;
  allowedIpOnly: boolean;
  allowedIps: string;
  workHoursOnly: boolean;
  requirePasswordChange: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  auditLog: UserAuditEntry[];
}

export type UserStatus = "Active" | "Suspended" | "Pending";

export interface SystemUserRecord {
  id: string;
  code: string;
  username: string; // Login nomi
  password?: string; // Tizim paroli / vaqtinchalik parol
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  plant: string;
  status: UserStatus;
  avatar?: string;
  initials?: string;
  language: "uz" | "ru" | "en" | "tr";
  defaultModule: ModulePermissionKey;
  linkedEmployeeId?: string; // HR xodimlar reestridan bog'lanish ID
  permissions: UserPermissions;
  scope: UserScope;
  security: UserSecurity;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleTemplate {
  id: string;
  name: string;
  roleName: string;
  department: string;
  defaultModule: ModulePermissionKey;
  permissions: UserPermissions;
  scope: UserScope;
}
