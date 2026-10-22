export type EmployeeStatus =
  | "active"
  | "on_leave"
  | "probation"
  | "terminated"
  | "Active"
  | "OnLeave"
  | "Probation"
  | "Terminated";

export type WageType =
  | "salary"
  | "piecework"
  | "hourly"
  | "mixed"
  | "Salary"
  | "Piecework"
  | "Hourly"
  | "Mixed";

export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "sick_leave"
  | "vacation"
  | "day_off"
  | "Present"
  | "Late"
  | "Absent"
  | "OnLeave"
  | "SickLeave";

export type PieceworkStatus =
  | "draft"
  | "verified"
  | "approved"
  | "paid"
  | "Draft"
  | "Verified"
  | "Approved"
  | "Paid";

export type PayrollStatus =
  | "draft"
  | "calculated"
  | "approved"
  | "paid"
  | "Draft"
  | "Calculated"
  | "Approved"
  | "Paid";

export interface EmployeeRecord {
  id: string;
  badgeNumber?: string;
  badgeNo: string;
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  fullName: string;
  phone: string;
  email?: string | null;
  status: EmployeeStatus;
  wageType: WageType;
  baseSalary: number;
  hourlyRate: number;
  pieceworkMultiplier?: number;
  pieceworkRateMultiplier: number;
  currentShift: string;
  hireDate: string;
  terminationDate?: string | null;
  departmentId?: string | null;
  departmentName?: string;
  department: string;
  departmentCode?: string;
  positionId?: string | null;
  positionTitle?: string;
  position: string;
  plant: string;
  avatarUrl?: string | null;
  // details / passport / legal
  passportSeries?: string;
  passportNumber?: string;
  passportNo?: string;
  pinfl?: string;
  bankCardNo?: string;
  bankName?: string;
  address?: string;
  education?: string;
  uniformSize?: string;
  emergencyPhone?: string;
  skills?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  headPerson?: string;
  phone?: string;
  staffCount: number;
  plant: string;
  branchId?: string | null;
  status?: "Active" | "Maintenance" | "active" | "maintenance";
  isActive?: boolean;
  createdAt?: string;
}

export interface PositionRecord {
  id: string;
  code: string;
  title: string;
  departmentId?: string | null;
  departmentName?: string;
  defaultWageType: WageType;
  standardRate: number;
  currency: string;
  isActive: boolean;
  employeesCount?: number;
}

export interface ShiftRecord {
  id: string;
  code: string;
  name: string;
  startTime: string; // "08:00"
  endTime: string;   // "20:00"
  durationHours?: number;
  shiftType?: "day" | "night" | "daily";
  type: "Day" | "Night" | "Daily" | "day" | "night" | "daily";
  activeWorkers: number;
  isActive?: boolean;
}

export interface AttendanceRecord {
  id: string;
  workDate?: string;
  date: string;
  employeeId: string;
  badgeNumber?: string;
  badgeNo: string;
  employeeName: string;
  department: string;
  shiftType?: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  workedHours: number;
  overtimeHours: number;
  delayMinutes: number;
  status: AttendanceStatus;
  sourceDevice?: string;
  notes?: string;
}

export interface PieceworkRecord {
  id: string;
  workDate?: string;
  date: string;
  workOrderId: string;
  employeeId: string;
  badgeNumber?: string;
  badgeNo: string;
  employeeName: string;
  department: string;
  machineCode?: string | null;
  machine: string;
  operationCode?: string;
  operationName?: string;
  operation: string;
  completedQuantity?: number;
  quantity: number;
  unit: string;
  pieceRate?: number;
  rate: number;
  totalAmount: number;
  currency?: string;
  status: PieceworkStatus;
  approvedBy?: string;
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  period: string; // "2026-10"
  employeeId: string;
  badgeNumber?: string;
  badgeNo: string;
  employeeName: string;
  department: string;
  position: string;
  wageType: WageType;
  baseSalary: number;
  pieceworkAmount: number;
  overtimeAmount: number;
  bonusAmount: number;
  grossPay: number;
  advanceDeduction: number;
  taxDeduction: number;
  penaltyDeduction: number;
  totalDeductions: number;
  netPay: number;
  currency?: string;
  status: PayrollStatus;
  paymentDate?: string;
  paymentMethod: "bank_card" | "cash" | "BankCard" | "Cash";
  notes?: string;
}

export interface EmployeeAdvanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  badgeNumber?: string;
  amount: number;
  advanceDate: string;
  period: string;
  status: "pending" | "deducted" | "cancelled";
  notes?: string | null;
}

export interface PayrollAdjustmentRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  period: string;
  adjustmentType: "bonus" | "penalty" | "tax_inps" | "tax_income" | "vacation_pay";
  amount: number;
  description?: string | null;
  createdAt?: string;
}

export interface EmployeeHistoryItem {
  id: string;
  employeeId: string;
  changeType: "position_change" | "salary_change" | "department_change" | "status_change";
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  changedBy?: string | null;
  changedAt: string;
}
