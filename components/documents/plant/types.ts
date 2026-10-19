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
  departments: PlantDepartment[];
  warehouses: PlantWarehouseInfo[];
  bankAccounts: PlantBankAccount[];
  integration: PlantIntegrationSettings;
  notes?: string;
}
