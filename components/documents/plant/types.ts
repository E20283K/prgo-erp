export interface PlantDepartment {
  id: string;
  name: string;
  code: string;
  headPerson: string;
  phone?: string;
  staffCount: number;
  machinesCount: number;
  operations?: string[];
  status: "Active" | "Maintenance";
}

export interface PlantWarehouseInfo {
  id: string;
  code: string;
  name: string;
  type: "RawMaterials" | "FinishedGoods" | "WIP" | "Chemicals" | "Spares";
  manager: string;
  phone?: string;
  capacityM2: number;
  locationDetails: string;
  status: "Active" | "Full" | "Maintenance";
}

export interface PlantBankAccount {
  id: string;
  bankName: string;
  mfo: string;
  accountNumber: string;
  currency: "UZS" | "USD" | "EUR";
  isPrimary: boolean;
  transitAccount?: string;
}

export interface PlantIntegrationSettings {
  didoxEnabled: boolean;
  didoxContractorCode: string;
  apiKeySet: boolean;
  autoSyncInvoices: boolean;
  oneCSyncEnabled: boolean;
  oneCEndpoint?: string;
  lastSyncAt?: string;
}

export interface PlantRecord {
  id: string;
  code: string;
  name: string;
  shortName: string;
  legalEntityName: string;
  branchType: string;
  tin: string; // STIR / INN
  vatNumber?: string; // QQS kodi
  oked?: string; // Faoliyat kodi (OKED)
  address: string;
  legalAddress: string;
  landmark?: string;
  phone: string;
  email: string;
  director: string;
  directorPhone?: string;
  chiefAccountant: string;
  chiefAccountantPhone?: string;
  productionHead?: string;
  productionHeadPhone?: string;
  shiftRegime: string;
  workingHours: string;
  daysOfWeek: string;
  totalFloorAreaM2?: number;
  machinesCount: number;
  status: "Active" | "Maintenance" | "Inactive";
  isMain?: boolean;
  departments: PlantDepartment[];
  warehouses: PlantWarehouseInfo[];
  bankAccounts: PlantBankAccount[];
  integration: PlantIntegrationSettings;
  notes?: string;
}

export function generateNextPlantCode(
  existingCodes: (string | null | undefined)[]
): string {
  let maxNum = 0;
  const upperSet = new Set<string>();

  for (const raw of existingCodes) {
    if (!raw) continue;
    const clean = String(raw).trim().toUpperCase();
    if (!clean) continue;
    upperSet.add(clean);

    const match = clean.match(/(?:BRN|PLT|BR)[-_]?(\d+)/i) || clean.match(/(\d+)$/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let nextNum = Math.max(maxNum + 1, existingCodes.filter(Boolean).length + 1);
  let candidate = `BRN-${String(nextNum).padStart(2, "0")}`;
  while (upperSet.has(candidate)) {
    nextNum += 1;
    candidate = `BRN-${String(nextNum).padStart(2, "0")}`;
  }
  return candidate;
}

export function createEmptyPlant(id: string = `PLT-${Date.now().toString().slice(-6)}`, code: string = ""): PlantRecord {
  return {
    id,
    code,
    name: "",
    shortName: "",
    legalEntityName: "",
    branchType: "",
    tin: "",
    vatNumber: "",
    oked: "",
    address: "",
    legalAddress: "",
    landmark: "",
    phone: "",
    email: "",
    director: "",
    directorPhone: "",
    chiefAccountant: "",
    chiefAccountantPhone: "",
    productionHead: "",
    productionHeadPhone: "",
    shiftRegime: "",
    workingHours: "",
    daysOfWeek: "",
    totalFloorAreaM2: 0,
    machinesCount: 0,
    status: "Active",
    isMain: false,
    departments: [],
    warehouses: [],
    bankAccounts: [],
    integration: {
      didoxEnabled: false,
      didoxContractorCode: "",
      apiKeySet: false,
      autoSyncInvoices: false,
      oneCSyncEnabled: false,
    },
    notes: "",
  };
}

export function branchToPlantRecord(b: any): PlantRecord {
  const rawIntegration = b.integration && typeof b.integration === "object" ? b.integration : {};
  return {
    id: b.id,
    code: b.code || "",
    name: b.name || "",
    shortName: b.shortName || "",
    legalEntityName: b.legalEntityName || "",
    branchType: b.branchType || (b.isMain ? "Bosh Korxona (HQ / Asosiy korpus)" : ""),
    tin: b.tin || "",
    vatNumber: b.vatNumber || "",
    oked: b.oked || "",
    address: b.address || "",
    legalAddress: b.legalAddress || "",
    landmark: b.landmark || "",
    phone: b.phone || "",
    email: b.email || "",
    director: b.director || "",
    directorPhone: b.directorPhone || "",
    chiefAccountant: b.chiefAccountant || "",
    chiefAccountantPhone: b.chiefAccountantPhone || "",
    productionHead: b.productionHead || "",
    productionHeadPhone: b.productionHeadPhone || "",
    shiftRegime: b.shiftRegime || "",
    workingHours: b.workingHours || "",
    daysOfWeek: b.daysOfWeek || "",
    totalFloorAreaM2: Number(b.totalFloorAreaM2) || 0,
    machinesCount: Number(b.machinesCount) || 0,
    status: (b.status as PlantRecord["status"]) || (b.isActive === false ? "Inactive" : "Active"),
    isMain: Boolean(b.isMain),
    departments: Array.isArray(b.departments) ? b.departments : [],
    warehouses: Array.isArray(b.warehouses) ? b.warehouses : [],
    bankAccounts: Array.isArray(b.bankAccounts) ? b.bankAccounts : [],
    integration: {
      didoxEnabled: Boolean(rawIntegration.didoxEnabled),
      didoxContractorCode: rawIntegration.didoxContractorCode || "",
      apiKeySet: Boolean(rawIntegration.apiKeySet),
      autoSyncInvoices: Boolean(rawIntegration.autoSyncInvoices),
      oneCSyncEnabled: Boolean(rawIntegration.oneCSyncEnabled),
      oneCEndpoint: rawIntegration.oneCEndpoint || "",
      lastSyncAt: rawIntegration.lastSyncAt || "",
    },
    notes: b.notes || "",
  };
}
