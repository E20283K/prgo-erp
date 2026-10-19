export type EmployeeStatus = "Active" | "OnLeave" | "Probation" | "Terminated";
export type WageType = "Piecework" | "Salary" | "Hourly" | "Mixed";
export type AttendanceStatus = "Present" | "Late" | "Absent" | "OnLeave" | "SickLeave";
export type PieceworkStatus = "Draft" | "Verified" | "Approved" | "Paid";
export type PayrollStatus = "Draft" | "Calculated" | "Approved" | "Paid";

export interface EmployeeRecord {
  id: string;
  badgeNo: string;
  fullName: string;
  avatarUrl?: string;
  department: string;
  departmentCode: string;
  position: string;
  plant: string;
  phone: string;
  email?: string;
  hireDate: string;
  status: EmployeeStatus;
  wageType: WageType;
  baseSalary: number;
  pieceworkRateMultiplier: number;
  hourlyRate: number;
  currentShift: string;
  passportNo?: string;
  pinfl?: string; // JSHSHIR
  bankCardNo?: string;
  emergencyPhone?: string;
  notes?: string;
  skills?: string[];
}

export interface AttendanceRecord {
  id: string;
  date: string;
  employeeId: string;
  badgeNo: string;
  employeeName: string;
  department: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  workedHours: number;
  overtimeHours: number;
  delayMinutes: number;
  status: AttendanceStatus;
  notes?: string;
}

export interface PieceworkRecord {
  id: string;
  date: string;
  workOrderId: string;
  employeeId: string;
  badgeNo: string;
  employeeName: string;
  department: string;
  machine: string;
  operation: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
  status: PieceworkStatus;
  approvedBy?: string;
}

export interface PayrollRecord {
  id: string;
  period: string; // "2026-10"
  employeeId: string;
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
  status: PayrollStatus;
  paymentDate?: string;
  paymentMethod: "BankCard" | "Cash";
}

export interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  headPerson: string;
  phone: string;
  staffCount: number;
  plant: string;
  status: "Active" | "Maintenance";
}

export interface ShiftRecord {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  type: "Day" | "Night" | "Daily";
  activeWorkers: number;
}
