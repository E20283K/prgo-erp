import { db } from "@/db";
import {
  employees,
  departments,
  positions,
  shifts,
  employeeShiftAssignments,
  attendanceLogs,
  pieceworkLogs,
  employeeAdvances,
  payrollAdjustments,
  payrollRecords,
  employeeHistory,
  companies,
} from "@/db/schema";
import { eq, desc, and, sql, between, gte, lte } from "drizzle-orm";
import type {
  EmployeeRecord,
  DepartmentRecord,
  PositionRecord,
  ShiftRecord,
  AttendanceRecord,
  PieceworkRecord,
  PayrollRecord,
  EmployeeAdvanceRecord,
  PayrollAdjustmentRecord,
  EmployeeHistoryItem,
} from "@/components/documents/hr/types";
import { getCompanyIdByCode } from "./crmService";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── 1. Employees Service ─────────────────────────────────────────────────────

export async function getEmployeesList(
  companyCode: string = "PRINTGOO",
  filters?: { departmentId?: string; status?: string; search?: string }
): Promise<EmployeeRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawEmployees = await db.query.employees.findMany({
    where: eq(employees.companyId, companyId),
    with: {
      department: true,
      position: true,
    },
    orderBy: [desc(employees.createdAt)],
  });

  let result = rawEmployees.map((e) => {
    const details = (e.details as any) || {};
    return {
      id: e.id,
      badgeNumber: e.badgeNumber,
      badgeNo: e.badgeNumber,
      firstName: e.firstName,
      lastName: e.lastName,
      middleName: e.middleName,
      fullName: e.fullName,
      phone: e.phone,
      email: e.email,
      status: e.status as any,
      wageType: e.wageType as any,
      baseSalary: Number(e.baseSalary) || 0,
      hourlyRate: Number(e.hourlyRate) || 0,
      pieceworkMultiplier: Number(e.pieceworkMultiplier) || 1.0,
      pieceworkRateMultiplier: Number(e.pieceworkMultiplier) || 1.0,
      currentShift: e.currentShift || "day",
      hireDate: e.hireDate,
      terminationDate: e.terminationDate,
      departmentId: e.departmentId,
      departmentName: e.department?.name || details.departmentName || details.department || "",
      department: e.department?.name || details.departmentName || details.department || "",
      departmentCode: e.department?.code || "",
      positionId: e.positionId,
      positionTitle: e.position?.title || details.positionTitle || details.position || "",
      position: e.position?.title || details.positionTitle || details.position || "",
      plant: "PrintGoo Bosh Zavod",
      avatarUrl: e.avatarUrl,
      passportSeries: details.passportSeries || "",
      passportNumber: details.passportNumber || "",
      passportNo: details.passportSeries && details.passportNumber ? `${details.passportSeries} ${details.passportNumber}` : details.passportNo || "",
      pinfl: details.pinfl || "",
      bankCardNo: details.bankCardNo || "",
      bankName: details.bankName || "",
      address: details.address || "",
      education: details.education || "",
      uniformSize: details.uniformSize || "",
      emergencyPhone: details.emergencyPhone || "",
      skills: details.skills || [],
      notes: details.notes || "",
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    } as EmployeeRecord;
  });

  if (filters?.departmentId && filters.departmentId !== "ALL") {
    result = result.filter((e) => e.departmentId === filters.departmentId);
  }
  if (filters?.status && filters.status !== "ALL") {
    result = result.filter((e) => e.status === filters.status);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.fullName.toLowerCase().includes(s) ||
        (e.badgeNumber || e.badgeNo || "").toLowerCase().includes(s) ||
        (e.positionTitle || "").toLowerCase().includes(s)
    );
  }

  return result;
}

export async function getEmployeeById(id: string): Promise<EmployeeRecord | null> {
  const e = await db.query.employees.findFirst({
    where: eq(employees.id, id),
    with: {
      department: true,
      position: true,
    },
  });

  if (!e) return null;

  const details = (e.details as any) || {};
  return {
    id: e.id,
    badgeNumber: e.badgeNumber,
    badgeNo: e.badgeNumber,
    firstName: e.firstName,
    lastName: e.lastName,
    middleName: e.middleName,
    fullName: e.fullName,
    phone: e.phone,
    email: e.email,
    status: e.status as any,
    wageType: e.wageType as any,
    baseSalary: Number(e.baseSalary) || 0,
    hourlyRate: Number(e.hourlyRate) || 0,
    pieceworkMultiplier: Number(e.pieceworkMultiplier) || 1.0,
    pieceworkRateMultiplier: Number(e.pieceworkMultiplier) || 1.0,
    currentShift: e.currentShift || "day",
    hireDate: e.hireDate,
    terminationDate: e.terminationDate,
    departmentId: e.departmentId,
    departmentName: e.department?.name || "",
    department: e.department?.name || "",
    departmentCode: e.department?.code || "",
    positionId: e.positionId,
    positionTitle: e.position?.title || "",
    position: e.position?.title || "",
    plant: "PrintGoo Bosh Zavod",
    avatarUrl: e.avatarUrl,
    passportSeries: details.passportSeries || "",
    passportNumber: details.passportNumber || "",
    passportNo: details.passportSeries && details.passportNumber ? `${details.passportSeries} ${details.passportNumber}` : details.passportNo || "",
    pinfl: details.pinfl || "",
    bankCardNo: details.bankCardNo || "",
    bankName: details.bankName || "",
    address: details.address || "",
    education: details.education || "",
    uniformSize: details.uniformSize || "",
    emergencyPhone: details.emergencyPhone || "",
    skills: details.skills || [],
    notes: details.notes || "",
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function upsertEmployeeRecord(
  data: Partial<EmployeeRecord>,
  companyCode: string = "PRINTGOO",
  changedBy: string = "Admin"
): Promise<{ success: boolean; employeeId: string; error?: string }> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);

    const fName = data.firstName || data.fullName?.split(" ")[0] || "Xodim";
    const lName = data.lastName || data.fullName?.split(" ")[1] || "Kadr";
    const fullName = data.fullName || `${fName} ${lName}`;

    // Resolve department and position UUIDs if name given
    let resolvedDeptId: string | null =
      data.departmentId && UUID_REGEX.test(data.departmentId) ? data.departmentId : null;
    const deptName = data.departmentName || data.department;
    if (!resolvedDeptId && deptName) {
      const foundDept = await db.query.departments.findFirst({
        where: and(eq(departments.companyId, companyId), eq(departments.name, deptName)),
      });
      if (foundDept) {
        resolvedDeptId = foundDept.id;
      }
    }

    let resolvedPosId: string | null =
      data.positionId && UUID_REGEX.test(data.positionId) ? data.positionId : null;
    const posTitle = data.positionTitle || data.position;
    if (!resolvedPosId && posTitle) {
      const foundPos = await db.query.positions.findFirst({
        where: and(eq(positions.companyId, companyId), eq(positions.title, posTitle)),
      });
      if (foundPos) {
        resolvedPosId = foundPos.id;
      }
    }

    const details = {
      passportSeries: data.passportSeries,
      passportNumber: data.passportNumber,
      passportNo: data.passportNo,
      pinfl: data.pinfl,
      bankCardNo: data.bankCardNo,
      bankName: data.bankName,
      address: data.address,
      education: data.education,
      uniformSize: data.uniformSize,
      emergencyPhone: data.emergencyPhone,
      skills: data.skills || [],
      notes: data.notes,
      departmentName: deptName || undefined,
      positionTitle: posTitle || undefined,
    };

    const isRealUuid = Boolean(data.id && typeof data.id === "string" && UUID_REGEX.test(data.id));

    if (isRealUuid && data.id) {
      // Check existing for history logging
      const existing = await db.query.employees.findFirst({
        where: eq(employees.id, data.id),
      });

      if (existing) {
        // Track changes if salary, position or status changed
        if (
          existing.status !== data.status ||
          Number(existing.baseSalary) !== Number(data.baseSalary) ||
          existing.positionId !== (resolvedPosId || existing.positionId) ||
          existing.departmentId !== (resolvedDeptId || existing.departmentId)
        ) {
          await db.insert(employeeHistory).values({
            employeeId: existing.id,
            changeType:
              existing.positionId !== resolvedPosId
                ? "position_change"
                : existing.baseSalary !== String(data.baseSalary)
                ? "salary_change"
                : "status_change",
            oldValue: {
              status: existing.status,
              baseSalary: existing.baseSalary,
              positionId: existing.positionId,
              departmentId: existing.departmentId,
            },
            newValue: {
              status: data.status,
              baseSalary: data.baseSalary,
              positionId: resolvedPosId || existing.positionId,
              departmentId: resolvedDeptId || existing.departmentId,
            },
            changedBy,
          });
        }

        await db
          .update(employees)
          .set({
            badgeNumber: data.badgeNumber || data.badgeNo || existing.badgeNumber,
            firstName: fName,
            lastName: lName,
            middleName: data.middleName || null,
            fullName,
            phone: data.phone || existing.phone,
            email: data.email || null,
            status: (data.status as any) || existing.status,
            wageType: (data.wageType as any) || existing.wageType,
            baseSalary: String(data.baseSalary ?? existing.baseSalary),
            hourlyRate: String(data.hourlyRate ?? existing.hourlyRate),
            pieceworkMultiplier: String(data.pieceworkMultiplier ?? existing.pieceworkMultiplier),
            currentShift: data.currentShift || existing.currentShift,
            departmentId: resolvedDeptId || existing.departmentId,
            positionId: resolvedPosId || existing.positionId,
            hireDate: data.hireDate || existing.hireDate,
            terminationDate: data.terminationDate || null,
            avatarUrl: data.avatarUrl !== undefined ? (data.avatarUrl || null) : existing.avatarUrl,
            details: { ...((existing.details as any) || {}), ...details },
            updatedAt: new Date(),
          })
          .where(eq(employees.id, existing.id));

        return { success: true, employeeId: existing.id };
      }
    }

    // Insert new employee
    const badgeNumber = data.badgeNumber || data.badgeNo || `EMP-${Date.now().toString().slice(-4)}`;
    const [inserted] = await db
      .insert(employees)
      .values({
        companyId,
        badgeNumber,
        firstName: fName,
        lastName: lName,
        middleName: data.middleName || null,
        fullName,
        phone: data.phone || "+998 90 000-00-00",
        email: data.email || null,
        status: (data.status as any) || "active",
        wageType: (data.wageType as any) || "piecework",
        baseSalary: String(data.baseSalary || 0),
        hourlyRate: String(data.hourlyRate || 0),
        pieceworkMultiplier: String(data.pieceworkMultiplier || 1.0),
        currentShift: data.currentShift || "day",
        hireDate: data.hireDate || new Date().toISOString().split("T")[0],
        departmentId: resolvedDeptId,
        positionId: resolvedPosId,
        avatarUrl: data.avatarUrl || null,
        details,
      })
      .returning();

    return { success: true, employeeId: inserted.id };
  } catch (error) {
    return {
      success: false,
      employeeId: "",
      error: error instanceof Error ? error.message : "Xodimni saqlashda xatolik",
    };
  }
}

// ─── 2. Departments Service ───────────────────────────────────────────────────

export async function getDepartmentsList(companyCode: string = "PRINTGOO"): Promise<DepartmentRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawDepts = await db.query.departments.findMany({
    where: eq(departments.companyId, companyId),
    with: {
      employees: true,
    },
    orderBy: [desc(departments.createdAt)],
  });

  return rawDepts.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    headPerson: "Mavjud emas",
    phone: "+998 71 200-00-00",
    staffCount: d.employees.length,
    plant: "PrintGoo Bosh Zavod",
    branchId: d.branchId,
    isActive: d.isActive,
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function upsertDepartmentRecord(
  data: Partial<DepartmentRecord>,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);

    if (data.id && data.id.length > 10 && !data.id.startsWith("dep-")) {
      await db
        .update(departments)
        .set({
          name: data.name!,
          code: data.code!,
          description: data.description || null,
          isActive: data.isActive ?? true,
          updatedAt: new Date(),
        })
        .where(eq(departments.id, data.id));
      return { success: true, id: data.id };
    }

    const [inserted] = await db
      .insert(departments)
      .values({
        companyId,
        code: data.code || `DEP-${Date.now().toString().slice(-4)}`,
        name: data.name || "Yangi bo'lim",
        description: data.description || null,
        isActive: data.isActive ?? true,
      })
      .returning();

    return { success: true, id: inserted.id };
  } catch (err) {
    return { success: false, id: "", error: err instanceof Error ? err.message : "Xatolik" };
  }
}

// ─── 3. Positions Service ─────────────────────────────────────────────────────

export async function getPositionsList(companyCode: string = "PRINTGOO"): Promise<PositionRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawPos = await db.query.positions.findMany({
    where: eq(positions.companyId, companyId),
    with: {
      department: true,
      employees: true,
    },
    orderBy: [desc(positions.createdAt)],
  });

  return rawPos.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    departmentId: p.departmentId,
    departmentName: p.department?.name || "",
    defaultWageType: p.defaultWageType as any,
    standardRate: Number(p.standardRate) || 0,
    currency: p.currency,
    isActive: p.isActive,
    employeesCount: p.employees.length,
  }));
}

export async function upsertPositionRecord(
  data: Partial<PositionRecord>,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);

    if (data.id && data.id.length > 10 && !data.id.startsWith("pos-")) {
      await db
        .update(positions)
        .set({
          code: data.code!,
          title: data.title!,
          departmentId: data.departmentId || null,
          defaultWageType: (data.defaultWageType as any) || "piecework",
          standardRate: String(data.standardRate || 0),
          currency: data.currency || "UZS",
          isActive: data.isActive ?? true,
          updatedAt: new Date(),
        })
        .where(eq(positions.id, data.id));
      return { success: true, id: data.id };
    }

    const [inserted] = await db
      .insert(positions)
      .values({
        companyId,
        code: data.code || `POS-${Date.now().toString().slice(-4)}`,
        title: data.title || "Yangi lavozim",
        departmentId: data.departmentId || null,
        defaultWageType: (data.defaultWageType as any) || "piecework",
        standardRate: String(data.standardRate || 0),
        currency: data.currency || "UZS",
        isActive: data.isActive ?? true,
      })
      .returning();

    return { success: true, id: inserted.id };
  } catch (err) {
    return { success: false, id: "", error: err instanceof Error ? err.message : "Lavozimni saqlashda xatolik" };
  }
}

// ─── 4. Shifts Service ────────────────────────────────────────────────────────

export async function getShiftsList(companyCode: string = "PRINTGOO"): Promise<ShiftRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawShifts = await db.query.shifts.findMany({
    where: eq(shifts.companyId, companyId),
    orderBy: [desc(shifts.createdAt)],
  });

  return rawShifts.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    durationHours: Number(s.durationHours) || 12,
    shiftType: s.shiftType as any,
    type: s.shiftType === "day" ? "Day" : s.shiftType === "night" ? "Night" : "Daily",
    activeWorkers: s.activeWorkers,
    isActive: s.isActive,
  }));
}

export async function upsertShiftRecord(
  data: Partial<ShiftRecord>,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);

    if (data.id && data.id.length > 10 && !data.id.startsWith("shift-")) {
      await db
        .update(shifts)
        .set({
          code: data.code!,
          name: data.name!,
          startTime: data.startTime || "08:00",
          endTime: data.endTime || "20:00",
          durationHours: String(data.durationHours || 12),
          shiftType: data.shiftType || "day",
          activeWorkers: data.activeWorkers || 0,
          isActive: data.isActive ?? true,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, data.id));
      return { success: true, id: data.id };
    }

    const [inserted] = await db
      .insert(shifts)
      .values({
        companyId,
        code: data.code || `SHIFT-${Date.now().toString().slice(-4)}`,
        name: data.name || "Standart smena",
        startTime: data.startTime || "08:00",
        endTime: data.endTime || "20:00",
        durationHours: String(data.durationHours || 12),
        shiftType: data.shiftType || "day",
        activeWorkers: data.activeWorkers || 0,
        isActive: data.isActive ?? true,
      })
      .returning();

    return { success: true, id: inserted.id };
  } catch (err) {
    return { success: false, id: "", error: err instanceof Error ? err.message : "Smenani saqlashda xatolik" };
  }
}

// ─── 5. Attendance & Biometric Face ID Service ─────────────────────────────────

export async function getAttendanceList(
  companyCode: string = "PRINTGOO",
  filters?: { workDate?: string; employeeId?: string; status?: string }
): Promise<AttendanceRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawLogs = await db.query.attendanceLogs.findMany({
    where: eq(attendanceLogs.companyId, companyId),
    with: {
      employee: {
        with: { department: true },
      },
    },
    orderBy: [desc(attendanceLogs.workDate), desc(attendanceLogs.createdAt)],
  });

  let result = rawLogs.map((a) => {
    const checkInTime = a.checkIn ? new Date(a.checkIn).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : null;
    const checkOutTime = a.checkOut ? new Date(a.checkOut).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : null;

    return {
      id: a.id,
      workDate: a.workDate,
      date: a.workDate,
      employeeId: a.employeeId,
      badgeNumber: a.employee?.badgeNumber || "",
      badgeNo: a.employee?.badgeNumber || "",
      employeeName: a.employee?.fullName || "Noma'lum xodim",
      department: a.employee?.department?.name || "",
      shiftType: a.shiftType,
      shift: a.shiftType,
      checkIn: checkInTime,
      checkOut: checkOutTime,
      workedHours: Number(a.workedHours) || 0,
      overtimeHours: Number(a.overtimeHours) || 0,
      delayMinutes: a.delayMinutes || 0,
      status: a.status as any,
      sourceDevice: a.sourceDevice || "manual",
      notes: a.notes,
    } as AttendanceRecord;
  });

  if (filters?.workDate) {
    result = result.filter((a) => a.workDate === filters.workDate);
  }
  if (filters?.employeeId) {
    result = result.filter((a) => a.employeeId === filters.employeeId);
  }
  if (filters?.status && filters.status !== "ALL") {
    result = result.filter((a) => a.status === filters.status);
  }

  return result;
}

/**
 * Biometrik Face ID / Turniket apparati uchun Webhook API logikasi
 */
export async function recordBiometricTurnstileEvent(
  params: {
    deviceId: string;
    badgeNumber: string;
    timestamp: string; // ISO string
    eventType: "check_in" | "check_out" | "auto";
  },
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; message: string; recordId?: string }> {
  const companyId = await getCompanyIdByCode(companyCode);

  const emp = await db.query.employees.findFirst({
    where: and(
      eq(employees.companyId, companyId),
      eq(employees.badgeNumber, params.badgeNumber)
    ),
  });

  if (!emp) {
    return { success: false, message: `Tabel raqami ${params.badgeNumber} bo'lgan xodim topilmadi!` };
  }

  const eventDate = new Date(params.timestamp);
  const workDateStr = eventDate.toISOString().split("T")[0];

  // Bugungi kundagi yozuv bormi?
  const existingLog = await db.query.attendanceLogs.findFirst({
    where: and(
      eq(attendanceLogs.employeeId, emp.id),
      eq(attendanceLogs.workDate, workDateStr)
    ),
  });

  if (!existingLog) {
    // Yangi Check-in yaratiladi
    // Kechikishni hisoblash: standart 08:00
    const targetTime = new Date(eventDate);
    targetTime.setHours(8, 0, 0, 0);
    let delayMinutes = 0;
    if (eventDate.getTime() > targetTime.getTime()) {
      delayMinutes = Math.floor((eventDate.getTime() - targetTime.getTime()) / 60000);
    }

    const [newLog] = await db
      .insert(attendanceLogs)
      .values({
        companyId,
        employeeId: emp.id,
        workDate: workDateStr,
        shiftType: emp.currentShift || "day",
        checkIn: eventDate,
        delayMinutes,
        status: delayMinutes > 15 ? "late" : "present",
        sourceDevice: params.deviceId,
        notes: `Turniket (${params.deviceId}) orqali avtomatik qayd`,
      })
      .returning();

    return { success: true, message: "Kirish (Check-in) muvaffaqiyatli qayd etildi", recordId: newLog.id };
  } else {
    // Check-out qayd etiladi va ishlangan soatlar hisoblanadi
    const checkInDate = existingLog.checkIn ? new Date(existingLog.checkIn) : eventDate;
    const durationMs = eventDate.getTime() - checkInDate.getTime();
    const workedHours = Math.max(0, parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2)));
    const overtime = workedHours > 8 ? parseFloat((workedHours - 8).toFixed(2)) : 0;

    await db
      .update(attendanceLogs)
      .set({
        checkOut: eventDate,
        workedHours: String(workedHours),
        overtimeHours: String(overtime),
        sourceDevice: `${existingLog.sourceDevice || ""}, ${params.deviceId}`,
      })
      .where(eq(attendanceLogs.id, existingLog.id));

    return {
      success: true,
      message: `Chiqish (Check-out) qayd etildi. Ishlangan vaqt: ${workedHours} soat.`,
      recordId: existingLog.id,
    };
  }
}

// ─── 6. Piecework Service ─────────────────────────────────────────────────────

export async function getPieceworkList(
  companyCode: string = "PRINTGOO",
  filters?: { employeeId?: string; status?: string; workOrderId?: string }
): Promise<PieceworkRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawList = await db.query.pieceworkLogs.findMany({
    where: eq(pieceworkLogs.companyId, companyId),
    with: {
      employee: {
        with: { department: true },
      },
    },
    orderBy: [desc(pieceworkLogs.workDate), desc(pieceworkLogs.createdAt)],
  });

  let result = rawList.map((p) => ({
    id: p.id,
    workDate: p.workDate,
    date: p.workDate,
    workOrderId: p.workOrderId,
    employeeId: p.employeeId,
    badgeNumber: p.employee?.badgeNumber || "",
    badgeNo: p.employee?.badgeNumber || "",
    employeeName: p.employee?.fullName || "",
    department: p.employee?.department?.name || "",
    machineCode: p.machineCode,
    machine: p.machineCode || "Universal Stanok",
    operationCode: p.operationCode,
    operationName: p.operationName,
    operation: p.operationName,
    completedQuantity: Number(p.completedQuantity) || 0,
    quantity: Number(p.completedQuantity) || 0,
    unit: p.unit,
    pieceRate: Number(p.pieceRate) || 0,
    rate: Number(p.pieceRate) || 0,
    totalAmount: Number(p.totalAmount) || 0,
    currency: p.currency,
    status: p.status as any,
    approvedBy: p.approvedBy || undefined,
    notes: p.notes || undefined,
  }));

  if (filters?.employeeId) {
    result = result.filter((p) => p.employeeId === filters.employeeId);
  }
  if (filters?.status && filters.status !== "ALL") {
    result = result.filter((p) => p.status === filters.status);
  }
  if (filters?.workOrderId) {
    result = result.filter((p) => p.workOrderId.toLowerCase().includes(filters.workOrderId!.toLowerCase()));
  }

  return result;
}

export async function upsertPieceworkRecord(
  data: Partial<PieceworkRecord>,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);

    const qty = Number(data.completedQuantity ?? data.quantity ?? 0);
    const rate = Number(data.pieceRate ?? data.rate ?? 0);
    const totalAmount = data.totalAmount ?? qty * rate;

    if (data.id && data.id.length > 10 && !data.id.startsWith("pw-")) {
      await db
        .update(pieceworkLogs)
        .set({
          workDate: data.workDate || data.date!,
          workOrderId: data.workOrderId!,
          machineCode: data.machineCode || data.machine || null,
          operationCode: data.operationCode || "OP-PRINT",
          operationName: data.operationName || data.operation || "Operatsiya",
          completedQuantity: String(qty),
          unit: data.unit || "dona",
          pieceRate: String(rate),
          totalAmount: String(totalAmount),
          status: (data.status as any) || "verified",
          approvedBy: data.approvedBy || null,
          notes: data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(pieceworkLogs.id, data.id));
      return { success: true, id: data.id };
    }

    const [inserted] = await db
      .insert(pieceworkLogs)
      .values({
        companyId,
        employeeId: data.employeeId!,
        workOrderId: data.workOrderId || "WO-0001",
        workDate: data.workDate || data.date || new Date().toISOString().split("T")[0],
        machineCode: data.machineCode || data.machine || null,
        operationCode: data.operationCode || "OP-PRINT",
        operationName: data.operationName || data.operation || "Bosma operatsiyasi",
        completedQuantity: String(qty),
        unit: data.unit || "dona",
        pieceRate: String(rate),
        totalAmount: String(totalAmount),
        status: (data.status as any) || "verified",
        approvedBy: data.approvedBy || "Master",
        notes: data.notes || null,
      })
      .returning();

    return { success: true, id: inserted.id };
  } catch (err) {
    return { success: false, id: "", error: err instanceof Error ? err.message : "Ishbay naryadni saqlashda xatolik" };
  }
}

// ─── 7. Payroll Engine (Oylik Hisob-Kitobi) ───────────────────────────────────

export async function getPayrollList(
  companyCode: string = "PRINTGOO",
  period?: string
): Promise<PayrollRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawList = await db.query.payrollRecords.findMany({
    where: and(
      eq(payrollRecords.companyId, companyId),
      period ? eq(payrollRecords.period, period) : undefined
    ),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
    },
    orderBy: [desc(payrollRecords.period), desc(payrollRecords.createdAt)],
  });

  return rawList.map((p) => ({
    id: p.id,
    period: p.period,
    employeeId: p.employeeId,
    badgeNumber: p.employee?.badgeNumber || "",
    badgeNo: p.employee?.badgeNumber || "",
    employeeName: p.employee?.fullName || "",
    department: p.employee?.department?.name || "",
    position: p.employee?.position?.title || "",
    wageType: (p.employee?.wageType as any) || "mixed",
    baseSalary: Number(p.baseSalary) || 0,
    pieceworkAmount: Number(p.pieceworkAmount) || 0,
    overtimeAmount: Number(p.overtimeAmount) || 0,
    bonusAmount: Number(p.bonusAmount) || 0,
    grossPay: Number(p.grossPay) || 0,
    advanceDeduction: Number(p.advanceDeduction) || 0,
    taxDeduction: Number(p.taxDeduction) || 0,
    penaltyDeduction: Number(p.penaltyDeduction) || 0,
    totalDeductions: Number(p.totalDeductions) || 0,
    netPay: Number(p.netPay) || 0,
    currency: p.currency,
    status: p.status as any,
    paymentDate: p.paymentDate || undefined,
    paymentMethod: p.paymentMethod as any,
    notes: p.notes || undefined,
  }));
}

/**
 * Belgilangan davr (masalan "2026-10") uchun avtomatik Payroll hisoblash
 * Davomat (soatlar), Ishbay naryadlar, Avanslar va Bonus/Jarimalarni yig'ib hisoblaydi.
 */
export async function calculatePeriodPayroll(
  period: string, // "2026-10"
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);

    // Barcha faol xodimlarni olish
    const activeEmps = await db.query.employees.findMany({
      where: and(
        eq(employees.companyId, companyId),
        eq(employees.status, "active")
      ),
    });

    let count = 0;

    for (const emp of activeEmps) {
      // 1. Ishbay summasi
      const pwList = await db.query.pieceworkLogs.findMany({
        where: and(
          eq(pieceworkLogs.employeeId, emp.id),
          sql`${pieceworkLogs.workDate}::text LIKE ${period + "%"}`
        ),
      });
      const pieceworkSum = pwList.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

      // 2. Davomat va overtime soatlari
      const attList = await db.query.attendanceLogs.findMany({
        where: and(
          eq(attendanceLogs.employeeId, emp.id),
          sql`${attendanceLogs.workDate}::text LIKE ${period + "%"}`
        ),
      });
      const totalWorkedHours = attList.reduce((sum, item) => sum + Number(item.workedHours || 0), 0);
      const totalOvertimeHours = attList.reduce((sum, item) => sum + Number(item.overtimeHours || 0), 0);

      // 3. Asosiy oklad yoki soatbay stavka bo'yicha to'lov
      let basePay = Number(emp.baseSalary) || 0;
      if (emp.wageType === "hourly") {
        basePay = totalWorkedHours * (Number(emp.hourlyRate) || 0);
      } else if (emp.wageType === "piecework") {
        basePay = Number(emp.baseSalary) || 0; // minimal oklad
      }

      // Overtime to'lovi: soatbay stavka × 1.5
      const hourlyBase = Number(emp.hourlyRate) > 0 ? Number(emp.hourlyRate) : (basePay / 168);
      const overtimePay = Math.round(totalOvertimeHours * hourlyBase * 1.5);

      // 4. Avanslar
      const advances = await db.query.employeeAdvances.findMany({
        where: and(
          eq(employeeAdvances.employeeId, emp.id),
          eq(employeeAdvances.period, period),
          eq(employeeAdvances.status, "pending")
        ),
      });
      const totalAdvance = advances.reduce((sum, a) => sum + Number(a.amount || 0), 0);

      // 5. Bonus va jarimalar (Adjustments)
      const adjustments = await db.query.payrollAdjustments.findMany({
        where: and(
          eq(payrollAdjustments.employeeId, emp.id),
          eq(payrollAdjustments.period, period)
        ),
      });
      const totalBonus = adjustments
        .filter((adj) => adj.adjustmentType === "bonus" || adj.adjustmentType === "vacation_pay")
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const totalPenalty = adjustments
        .filter((adj) => adj.adjustmentType === "penalty")
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);

      // 6. Gross Pay hisoblash
      const grossPay = Math.round(basePay + pieceworkSum + overtimePay + totalBonus);

      // 7. Soliqlar (O'zbekiston soliq stavkalari: 12% JShODS)
      const taxDeduction = Math.round(grossPay * 0.12);

      // 8. Total Deductions & Net Pay
      const totalDeductions = Math.round(totalAdvance + totalPenalty + taxDeduction);
      const netPay = Math.max(0, grossPay - totalDeductions);

      // Payroll yozuvini kiritish yoki yangilash
      const existingRecord = await db.query.payrollRecords.findFirst({
        where: and(
          eq(payrollRecords.employeeId, emp.id),
          eq(payrollRecords.period, period)
        ),
      });

      if (existingRecord) {
        await db
          .update(payrollRecords)
          .set({
            baseSalary: String(basePay),
            pieceworkAmount: String(pieceworkSum),
            overtimeAmount: String(overtimePay),
            bonusAmount: String(totalBonus),
            grossPay: String(grossPay),
            advanceDeduction: String(totalAdvance),
            taxDeduction: String(taxDeduction),
            penaltyDeduction: String(totalPenalty),
            totalDeductions: String(totalDeductions),
            netPay: String(netPay),
            status: "calculated",
            updatedAt: new Date(),
          })
          .where(eq(payrollRecords.id, existingRecord.id));
      } else {
        await db.insert(payrollRecords).values({
          companyId,
          period,
          employeeId: emp.id,
          baseSalary: String(basePay),
          pieceworkAmount: String(pieceworkSum),
          overtimeAmount: String(overtimePay),
          bonusAmount: String(totalBonus),
          grossPay: String(grossPay),
          advanceDeduction: String(totalAdvance),
          taxDeduction: String(taxDeduction),
          penaltyDeduction: String(totalPenalty),
          totalDeductions: String(totalDeductions),
          netPay: String(netPay),
          status: "calculated",
        });
      }

      count++;
    }

    return { success: true, count };
  } catch (err) {
    return { success: false, count: 0, error: err instanceof Error ? err.message : "Hisoblashda xatolik" };
  }
}

// ─── 8. Employee History & Advances ───────────────────────────────────────────

export async function getEmployeeHistoryList(employeeId: string): Promise<EmployeeHistoryItem[]> {
  const list = await db.query.employeeHistory.findMany({
    where: eq(employeeHistory.employeeId, employeeId),
    orderBy: [desc(employeeHistory.changedAt)],
  });

  return list.map((h) => ({
    id: h.id,
    employeeId: h.employeeId,
    changeType: h.changeType as any,
    oldValue: (h.oldValue as any) || null,
    newValue: (h.newValue as any) || null,
    changedBy: h.changedBy,
    changedAt: h.changedAt.toISOString(),
  }));
}

export async function getEmployeeAdvancesList(
  companyCode: string = "PRINTGOO",
  period?: string
): Promise<EmployeeAdvanceRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const list = await db.query.employeeAdvances.findMany({
    where: and(
      eq(employeeAdvances.companyId, companyId),
      period ? eq(employeeAdvances.period, period) : undefined
    ),
    with: {
      employee: true,
    },
    orderBy: [desc(employeeAdvances.advanceDate)],
  });

  return list.map((a) => ({
    id: a.id,
    employeeId: a.employeeId,
    employeeName: a.employee?.fullName || "",
    badgeNumber: a.employee?.badgeNumber || "",
    amount: Number(a.amount) || 0,
    advanceDate: a.advanceDate,
    period: a.period,
    status: a.status as any,
    notes: a.notes,
  }));
}
