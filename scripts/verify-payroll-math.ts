import assert from "node:assert/strict";
import { computeTotals, previousPeriod, prorateSalary, workingDaysInPeriod } from "../lib/server/payrollMath";

// Foydalanuvchi misoli: oylik 5 mln, 3 \x 2 mln avans = 6 mln.
const t = computeTotals({ gross: 5_000_000, penalty: 0, advances: 6_000_000, carriedDebtIn: 0 });
assert.equal(t.netPay, 0);
assert.equal(t.carriedDebtOut, 1_000_000);
// Keyingi oy: 1 mln qarz ushlanadi.
const t2 = computeTotals({ gross: 5_000_000, penalty: 0, advances: 0, carriedDebtIn: t.carriedDebtOut });
assert.equal(t2.netPay, 4_000_000);
assert.equal(t2.carriedDebtOut, 0);

// 2026-11: 30 kun, yakshanbalar 1,8,15,22,29 => 25 ish kuni.
assert.equal(workingDaysInPeriod("2026-11"), 25);
assert.equal(workingDaysInPeriod("2026-11", "2026-11-16"), 13); // 16..30 = 15 kun, yakshanba 22 va 29 chiqariladi
assert.equal(workingDaysInPeriod("2026-11", "2026-12-01"), 0);
assert.equal(previousPeriod("2026-01"), "2025-12");

assert.equal(prorateSalary(5_000_000, 25, ["a", "b", "a"], true).workedDays, 2);
assert.equal(prorateSalary(5_000_000, 25, [], false).amount, 5_000_000); // tabel yo'q = to'liq
assert.equal(prorateSalary(5_000_000, 25, Array.from({ length: 20 }, (_, i) => String(i)), true).amount, 4_000_000);
console.log("payroll math ok");
