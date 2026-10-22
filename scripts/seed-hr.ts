import { db, pgClient } from "../db";
import {
  companies,
  departments,
  positions,
  shifts,
  employees,
  attendanceLogs,
  pieceworkLogs,
  payrollRecords,
} from "../db/schema";
import { eq } from "drizzle-orm";

async function seedHr() {
  console.log("🌱 [Seed] HR & Payroll ma'lumotlarini PostgreSQL bazasiga kiritish boshlandi...");

  // 1. Kompaniyani topish yoki yaratish
  let company = await db.query.companies.findFirst({
    where: eq(companies.code, "PRINTGOO"),
  });

  if (!company) {
    const [newComp] = await db
      .insert(companies)
      .values({
        code: "PRINTGOO",
        name: "PrintGoo Packaging & Labels MCHJ",
      })
      .returning();
    company = newComp;
    console.log("🏢 Yangi kompaniya yaratildi:", company.name);
  }

  const companyId = company.id;

  // 2. Sexlar va Bo'limlar (Departments)
  console.log("📂 Sexlar kiritilmoqda...");
  const deptsData = [
    { code: "DEP-FLEXO", name: "Flekso bosma sexi", description: "Rulonli etiketka va flekso bosma" },
    { code: "DEP-SEWING", name: "Tikuvchilik va lenta sexi", description: "To'quv va satin lenta ishlab chiqarish" },
    { code: "DEP-FINISHING", name: "Kesish va qadoqlash sexi", description: "Rulon kesish, shtamp va qadoqlash" },
    { code: "DEP-PREPRESS", name: "Prepress va dizayn markazi", description: "Klishe, CTP va rang ajratish" },
    { code: "DEP-QC", name: "Texnik sifat nazorati (OTK)", description: "Laboratoriya va sifat ekspertizasi" },
  ];

  const createdDepts: Record<string, string> = {};
  for (const d of deptsData) {
    const existing = await db.query.departments.findFirst({
      where: eq(departments.code, d.code),
    });
    if (existing) {
      createdDepts[d.code] = existing.id;
    } else {
      const [inserted] = await db
        .insert(departments)
        .values({
          companyId,
          code: d.code,
          name: d.name,
          description: d.description,
          isActive: true,
        })
        .returning();
      createdDepts[d.code] = inserted.id;
    }
  }
  console.log("✅ Sexlar saqlandi:", Object.keys(createdDepts).length);

  // 3. Smenalar (Shifts)
  console.log("⏰ Smenalar kiritilmoqda...");
  const shiftsData = [
    { code: "SHIFT-DAY-12", name: "Smena A (Kunduzgi 12 soat)", startTime: "08:00", endTime: "20:00", durationHours: "12.00", shiftType: "day", activeWorkers: 18 },
    { code: "SHIFT-NIGHT-12", name: "Smena B (Tungi 12 soat)", startTime: "20:00", endTime: "08:00", durationHours: "12.00", shiftType: "night", activeWorkers: 12 },
    { code: "SHIFT-OFFICE-8", name: "Standart Ofis (8 soat)", startTime: "09:00", endTime: "18:00", durationHours: "8.00", shiftType: "daily", activeWorkers: 10 },
  ];

  for (const s of shiftsData) {
    const existing = await db.query.shifts.findFirst({
      where: eq(shifts.code, s.code),
    });
    if (!existing) {
      await db.insert(shifts).values({
        companyId,
        code: s.code,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        durationHours: s.durationHours,
        shiftType: s.shiftType,
        activeWorkers: s.activeWorkers,
        isActive: true,
      });
    }
  }
  console.log("✅ Smenalar saqlandi.");

  // 4. Lavozimlar (Positions)
  console.log("💼 Lavozimlar kiritilmoqda...");
  const positionsData = [
    { code: "POS-FLEXO-LEAD", title: "Bosh Pechatnik (Flexo Lead)", deptCode: "DEP-FLEXO", defaultWageType: "mixed" as const, standardRate: "4500000" },
    { code: "POS-FLEXO-ASST", title: "Pechatnik yordamchisi", deptCode: "DEP-FLEXO", defaultWageType: "piecework" as const, standardRate: "2500000" },
    { code: "POS-SEW-OP", title: "Katta tikuvchi-operator", deptCode: "DEP-SEWING", defaultWageType: "piecework" as const, standardRate: "3000000" },
    { code: "POS-CUTTER", title: "Rezchik-qadoqlovchi", deptCode: "DEP-FINISHING", defaultWageType: "piecework" as const, standardRate: "2800000" },
    { code: "POS-DESIGNER", title: "Bosh Dizayner-texnolog", deptCode: "DEP-PREPRESS", defaultWageType: "salary" as const, standardRate: "9500000" },
    { code: "POS-QC-INSP", title: "OTK Nazoratchisi", deptCode: "DEP-QC", defaultWageType: "salary" as const, standardRate: "5200000" },
  ];

  const createdPositions: Record<string, string> = {};
  for (const p of positionsData) {
    const existing = await db.query.positions.findFirst({
      where: eq(positions.code, p.code),
    });
    if (existing) {
      createdPositions[p.code] = existing.id;
    } else {
      const [inserted] = await db
        .insert(positions)
        .values({
          companyId,
          departmentId: createdDepts[p.deptCode] || null,
          code: p.code,
          title: p.title,
          defaultWageType: p.defaultWageType,
          standardRate: p.standardRate,
          currency: "UZS",
          isActive: true,
        })
        .returning();
      createdPositions[p.code] = inserted.id;
    }
  }
  console.log("✅ Lavozimlar saqlandi:", Object.keys(createdPositions).length);

  // 5. Xodimlar (Employees)
  console.log("👥 Xodimlar kiritilmoqda...");
  const employeesData = [
    {
      badgeNumber: "EMP-0101",
      firstName: "Alisher",
      lastName: "Rustamov",
      fullName: "Alisher Rustamov",
      phone: "+998 90 123-45-67",
      email: "a.rustamov@printgoo.uz",
      deptCode: "DEP-FLEXO",
      posCode: "POS-FLEXO-LEAD",
      status: "active" as const,
      wageType: "mixed" as const,
      baseSalary: "4500000",
      hourlyRate: "35000",
      pieceworkMultiplier: "1.15",
      currentShift: "Smena A (08:00 - 20:00)",
      hireDate: "2023-02-15",
      details: {
        passportSeries: "AA",
        passportNumber: "1234567",
        pinfl: "31502910010023",
        bankCardNo: "8600 **** **** 1024",
        skills: ["Mark Andy 2200", "Nilpeter FB-3", "Anilox sozlash"],
        notes: "Yuqori malakali mutaxassis, 8 yillik flekso bosma tajribasi.",
      },
    },
    {
      badgeNumber: "EMP-0102",
      firstName: "Dilshod",
      lastName: "Karimov",
      fullName: "Dilshod Karimov",
      phone: "+998 93 456-78-90",
      email: "d.karimov@printgoo.uz",
      deptCode: "DEP-FLEXO",
      posCode: "POS-FLEXO-ASST",
      status: "active" as const,
      wageType: "piecework" as const,
      baseSalary: "2500000",
      hourlyRate: "25000",
      pieceworkMultiplier: "1.00",
      currentShift: "Smena A (08:00 - 20:00)",
      hireDate: "2024-05-10",
      details: {
        passportSeries: "AB",
        passportNumber: "9876543",
        pinfl: "32005950020045",
        bankCardNo: "8600 **** **** 5512",
        skills: ["Rulon yuklash", "Bo'yoq tayyorlash", "Stanok yuvish"],
        notes: "O'rganuvchi bosqichida.",
      },
    },
    {
      badgeNumber: "EMP-0201",
      firstName: "Zulfiya",
      lastName: "Mirzayeva",
      fullName: "Zulfiya Mirzayeva",
      phone: "+998 94 987-65-43",
      email: "z.mirzayeva@printgoo.uz",
      deptCode: "DEP-SEWING",
      posCode: "POS-SEW-OP",
      status: "active" as const,
      wageType: "piecework" as const,
      baseSalary: "3000000",
      hourlyRate: "28000",
      pieceworkMultiplier: "1.20",
      currentShift: "Smena B (08:00 - 17:00)",
      hireDate: "2023-08-01",
      details: {
        passportSeries: "AC",
        passportNumber: "4561234",
        pinfl: "41208940030089",
        bankCardNo: "9860 **** **** 3341",
        skills: ["Juki DDL-8700", "Avtomatik yorliq tikish"],
        notes: "Kunlik norma: 3,500 dona yorliq tikish.",
      },
    },
    {
      badgeNumber: "EMP-0301",
      firstName: "Farhod",
      lastName: "Ergashev",
      fullName: "Farhod Ergashev",
      phone: "+998 91 333-22-11",
      email: "f.ergashev@printgoo.uz",
      deptCode: "DEP-FINISHING",
      posCode: "POS-CUTTER",
      status: "active" as const,
      wageType: "piecework" as const,
      baseSalary: "2800000",
      hourlyRate: "26000",
      pieceworkMultiplier: "1.05",
      currentShift: "Smena A (08:00 - 20:00)",
      hireDate: "2023-11-20",
      details: {
        passportSeries: "AB",
        passportNumber: "5544332",
        pinfl: "31811920040012",
        bankCardNo: "8600 **** **** 8820",
        skills: ["Polar 92X", "Rulon kesish stanogi"],
      },
    },
    {
      badgeNumber: "EMP-0401",
      firstName: "Jamshid",
      lastName: "Qodirov",
      fullName: "Jamshid Qodirov",
      phone: "+998 97 777-88-99",
      email: "j.qodirov@printgoo.uz",
      deptCode: "DEP-PREPRESS",
      posCode: "POS-DESIGNER",
      status: "active" as const,
      wageType: "salary" as const,
      baseSalary: "9500000",
      hourlyRate: "60000",
      pieceworkMultiplier: "1.00",
      currentShift: "Ofis (09:00 - 18:00)",
      hireDate: "2022-09-01",
      details: {
        passportSeries: "AA",
        passportNumber: "7891234",
        pinfl: "30509890050078",
        bankCardNo: "9860 **** **** 9012",
        skills: ["Adobe Illustrator", "Esko DeskPack", "Klishe chiqarish (CTP)"],
      },
    },
    {
      badgeNumber: "EMP-0501",
      firstName: "Nodira",
      lastName: "Rahimova",
      fullName: "Nodira Rahimova",
      phone: "+998 90 555-12-34",
      email: "n.rahimova@printgoo.uz",
      deptCode: "DEP-QC",
      posCode: "POS-QC-INSP",
      status: "active" as const,
      wageType: "salary" as const,
      baseSalary: "5200000",
      hourlyRate: "32000",
      pieceworkMultiplier: "1.00",
      currentShift: "Smena A (08:00 - 20:00)",
      hireDate: "2024-01-15",
      details: {
        passportSeries: "AD",
        passportNumber: "1122334",
        pinfl: "42501930060034",
        bankCardNo: "8600 **** **** 4499",
        skills: ["Spektrofotometr X-Rite", "Shtrix-kod verifikatori"],
      },
    },
  ];

  const createdEmployees: Record<string, string> = {};
  for (const emp of employeesData) {
    const existing = await db.query.employees.findFirst({
      where: eq(employees.badgeNumber, emp.badgeNumber),
    });
    if (existing) {
      createdEmployees[emp.badgeNumber] = existing.id;
    } else {
      const [inserted] = await db
        .insert(employees)
        .values({
          companyId,
          departmentId: createdDepts[emp.deptCode] || null,
          positionId: createdPositions[emp.posCode] || null,
          badgeNumber: emp.badgeNumber,
          firstName: emp.firstName,
          lastName: emp.lastName,
          fullName: emp.fullName,
          phone: emp.phone,
          email: emp.email,
          status: emp.status,
          wageType: emp.wageType,
          baseSalary: emp.baseSalary,
          hourlyRate: emp.hourlyRate,
          pieceworkMultiplier: emp.pieceworkMultiplier,
          currentShift: emp.currentShift,
          hireDate: emp.hireDate,
          details: emp.details,
        })
        .returning();
      createdEmployees[emp.badgeNumber] = inserted.id;
    }
  }
  console.log("✅ Xodimlar saqlandi:", Object.keys(createdEmployees).length);

  // 6. Davomat (Attendance Logs)
  console.log("📅 Davomat yozuvlari kiritilmoqda...");
  const alisherId = createdEmployees["EMP-0101"];
  const dilshodId = createdEmployees["EMP-0102"];
  const zulfiyaId = createdEmployees["EMP-0201"];

  if (alisherId) {
    const existing = await db.query.attendanceLogs.findFirst({
      where: eq(attendanceLogs.employeeId, alisherId),
    });
    if (!existing) {
      await db.insert(attendanceLogs).values([
        {
          companyId,
          employeeId: alisherId,
          workDate: "2026-10-18",
          shiftType: "day",
          checkIn: new Date("2026-10-18T07:52:00+05:00"),
          checkOut: new Date("2026-10-18T20:05:00+05:00"),
          workedHours: "11.50",
          overtimeHours: "0.50",
          delayMinutes: 0,
          status: "present",
          sourceDevice: "Turniket-FaceID-01",
          notes: "Stanokni o'z vaqtida qabul qildi",
        },
        {
          companyId,
          employeeId: alisherId,
          workDate: "2026-10-19",
          shiftType: "day",
          checkIn: new Date("2026-10-19T07:55:00+05:00"),
          checkOut: new Date("2026-10-19T20:00:00+05:00"),
          workedHours: "11.50",
          overtimeHours: "0.00",
          delayMinutes: 0,
          status: "present",
          sourceDevice: "Turniket-FaceID-01",
        },
      ]);
    }
  }

  if (dilshodId) {
    const existing = await db.query.attendanceLogs.findFirst({
      where: eq(attendanceLogs.employeeId, dilshodId),
    });
    if (!existing) {
      await db.insert(attendanceLogs).values({
        companyId,
        employeeId: dilshodId,
        workDate: "2026-10-18",
        shiftType: "day",
        checkIn: new Date("2026-10-18T08:14:00+05:00"),
        checkOut: new Date("2026-10-18T20:00:00+05:00"),
        workedHours: "11.00",
        overtimeHours: "0.00",
        delayMinutes: 14,
        status: "late",
        sourceDevice: "Turniket-FaceID-01",
        notes: "Transport ushlanib qolgani sababli kechikdi",
      });
    }
  }
  console.log("✅ Davomat yozuvlari saqlandi.");

  // 7. Ishbay Naryadlar (Piecework Logs)
  console.log("🏭 Ishbay naryadlar kiritilmoqda...");
  if (alisherId) {
    const existing = await db.query.pieceworkLogs.findFirst({
      where: eq(pieceworkLogs.employeeId, alisherId),
    });
    if (!existing) {
      await db.insert(pieceworkLogs).values([
        {
          companyId,
          employeeId: alisherId,
          workOrderId: "WOOF-26-0351",
          workDate: "2026-10-18",
          machineCode: "Mark Andy 2200 #1",
          operationCode: "OP-FLEXO",
          operationName: "Flekso bosma (Samo-kleyka yorliq)",
          completedQuantity: "45000",
          unit: "dona",
          pieceRate: "18.5000",
          totalAmount: "832500.00",
          status: "approved",
          approvedBy: "Sex boshlig'i O. Toirov",
        },
        {
          companyId,
          employeeId: alisherId,
          workOrderId: "WO-00349",
          workDate: "2026-10-17",
          machineCode: "Mark Andy 2200 #1",
          operationCode: "OP-UV-VARNISH",
          operationName: "Flekso bosma + UV lak",
          completedQuantity: "60000",
          unit: "dona",
          pieceRate: "19.0000",
          totalAmount: "1140000.00",
          status: "approved",
          approvedBy: "Sex boshlig'i O. Toirov",
        },
      ]);
    }
  }
  console.log("✅ Ishbay naryadlar saqlandi.");

  // 8. Oylik hisob-kitob (Payroll Records)
  console.log("💰 Oylik hisob-kitoblari kiritilmoqda...");
  if (alisherId) {
    const existing = await db.query.payrollRecords.findFirst({
      where: eq(payrollRecords.employeeId, alisherId),
    });
    if (!existing) {
      await db.insert(payrollRecords).values({
        companyId,
        period: "2026-10",
        employeeId: alisherId,
        baseSalary: "4500000.00",
        pieceworkAmount: "6850000.00",
        overtimeAmount: "450000.00",
        bonusAmount: "1000000.00",
        grossPay: "12800000.00",
        advanceDeduction: "3000000.00",
        taxDeduction: "1536000.00",
        penaltyDeduction: "0.00",
        totalDeductions: "4536000.00",
        netPay: "8264000.00",
        status: "calculated",
        paymentMethod: "bank_card",
      });
    }
  }
  console.log("✅ Oylik hisob-kitoblari saqlandi.");

  console.log("🎉 HR & Payroll MVP ma'lumotlar bazasi to'liq muvaffaqiyatli to'ldirildi!");
  await pgClient.end();
}

seedHr().catch((err) => {
  console.error("❌ Seed xatoligi:", err);
  process.exit(1);
});
