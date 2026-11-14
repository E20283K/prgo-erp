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

/** Converts a work rate's per-unit pay into USD per unit. */
export function workRateToUsd(rate: number, currency: string, exchangeRate: number): number {
  const fx = Number(exchangeRate) || 12850;
  return (currency || "UZS").toUpperCase() === "USD" ? rate : rate / fx;
}
