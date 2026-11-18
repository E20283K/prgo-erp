/**
 * Catalog operation (Operatsiya): route steps pick their name, default machine and
 * piecework pay from here. Customer prices live in tariffs; piece rates are what operators earn.
 */
export interface WorkRateRecord {
  id: string;
  code: string;
  name: string;
  department: string;
  /** Machine filled into a new step that picks this operation. */
  defaultMachineId?: string | null;
  /** A TARIFF_CALC_UNITS value, e.g. "1,000 sheets". */
  unit: string;
  unitDivisor: number;
  currency: string;
  /** Lead operator pay per `unit`, in `currency`. */
  pieceRate: number;
  /** Assistant pay per `unit`, in `currency`. */
  helperPieceRate: number;
  status: "Active" | "Archived";
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Department of a catalog operation: its default machine's department when it has one
 * (the machine card is the one place it is kept), else the department picked for machine-less work.
 */
export function operationDepartment(
  rate: Pick<WorkRateRecord, "department" | "defaultMachineId">,
  machines: { id: string; department?: string }[]
): string {
  if (rate.defaultMachineId) {
    const m = machines.find((x) => x.id === rate.defaultMachineId);
    if (m) return m.department || "";
  }
  return rate.department || "";
}

/** Converts a work rate's per-unit pay into USD per unit. */
export function workRateToUsd(rate: number, currency: string, exchangeRate: number): number {
  const fx = Number(exchangeRate) || 12850;
  return (currency || "UZS").toUpperCase() === "USD" ? rate : rate / fx;
}
