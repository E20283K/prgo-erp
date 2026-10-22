import { db, pgClient } from "../db";
import { sql } from "drizzle-orm";

async function clearHrTables() {
  console.log("🧹 HR jadvallarini to'liq tozalash boshlandi...");

  await db.execute(sql`
    TRUNCATE TABLE 
      attendance_logs,
      piecework_logs,
      payroll_records,
      payroll_adjustments,
      employee_advances,
      employee_shift_assignments,
      employee_history,
      employees,
      positions,
      shifts,
      departments
    CASCADE;
  `);

  console.log("✨ Barcha HR jadvallari mutlaqo bo'shatildi (TRUNCATE CASCADE bajarildi).");
  await pgClient.end();
}

clearHrTables().catch((err) => {
  console.error("❌ Tozalashda xatolik:", err);
  process.exit(1);
});
