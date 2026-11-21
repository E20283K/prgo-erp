"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, RefreshCw, Search } from "lucide-react";
import type { AttendanceRecord, EmployeeRecord } from "../types";

type Status = "present" | "late" | "absent" | "sick_leave" | "vacation" | "day_off";

interface Mark {
  status: Status;
  manual: boolean;
}

const BRUSHES: { status: Status; code: string; label: string; cls: string }[] = [
  { status: "present", code: "K", label: "Kelgan", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  { status: "late", code: "L", label: "Kechikkan", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { status: "absent", code: "N", label: "Kelmagan", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  { status: "sick_leave", code: "B", label: "Kasallik", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { status: "vacation", code: "T", label: "Ta'til", cls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  { status: "day_off", code: "D", label: "Dam", cls: "bg-muted text-muted-foreground" },
];
const BRUSH_BY_STATUS = new Map(BRUSHES.map((b) => [b.status, b]));

const WEEKDAYS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

function todayIso(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}

function normalizeStatus(s: string): Status | null {
  const v = s.toLowerCase();
  return (BRUSHES.some((b) => b.status === v) ? v : null) as Status | null;
}

export function TimesheetGrid() {
  const { addNotification } = useWorkspaceStore();
  const [period, setPeriod] = useState(() => todayIso().slice(0, 7));
  const [staff, setStaff] = useState<EmployeeRecord[]>([]);
  const [marks, setMarks] = useState<Map<string, Mark>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brush, setBrush] = useState<Status>("present");
  const [search, setSearch] = useState("");

  const days = useMemo(() => {
    const [y, m] = period.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: last }, (_, i) => {
      const d = i + 1;
      const iso = `${period}-${String(d).padStart(2, "0")}`;
      return { d, iso, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
    });
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.all([
        fetch("/api/v1/hr/employees").then((r) => r.json()),
        fetch(`/api/v1/hr/attendance?period=${period}`).then((r) => r.json()),
      ]);
      if (empRes.success) {
        setStaff((empRes.data as EmployeeRecord[]).filter((e) => e.status !== "terminated"));
      }
      const next = new Map<string, Mark>();
      if (attRes.success) {
        for (const a of attRes.data as AttendanceRecord[]) {
          const st = normalizeStatus(String(a.status));
          if (!st) continue;
          next.set(`${a.employeeId}|${a.workDate}`, { status: st, manual: a.sourceDevice === "manual" });
        }
      }
      setMarks(next);
    } catch {
      addNotification({ title: "Tabel yuklanmadi", description: "Server xatosi", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [period, addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return staff.filter(
      (e) => !s || e.fullName.toLowerCase().includes(s) || (e.badgeNumber || e.badgeNo || "").toLowerCase().includes(s)
    );
  }, [staff, search]);

  const save = useCallback(
    async (entries: { employeeId: string; workDate: string; status: Status | null }[]) => {
      if (entries.length === 0) return;
      setSaving(true);
      try {
        const res = await fetch("/api/v1/hr/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Saqlanmadi");
        if (json.skipped?.length) {
          addNotification({
            title: `${json.saved} ta saqlandi, ${json.skipped.length} ta o'tkazib yuborildi`,
            description: json.skipped[0].reason,
            severity: "warning",
          });
        }
        await load();
      } catch (e) {
        addNotification({ title: "Saqlanmadi", description: e instanceof Error ? e.message : "Xatolik", severity: "error" });
      } finally {
        setSaving(false);
      }
    },
    [load, addNotification]
  );

  const onCell = (e: EmployeeRecord, iso: string) => {
    const cur = marks.get(`${e.id}|${iso}`);
    // Same brush on a manual mark removes it; otherwise paint.
    const status = cur?.manual && cur.status === brush ? null : brush;
    save([{ employeeId: e.id, workDate: iso, status }]);
  };

  // Unmarked, employed, non-Sunday, not-future days of one employee.
  const emptyDaysOf = (e: EmployeeRecord) =>
    days.filter(
      (x) => x.dow !== 0 && x.iso <= todayIso() && x.iso >= e.hireDate && !marks.has(`${e.id}|${x.iso}`)
    );

  const fillRow = (e: EmployeeRecord) =>
    save(emptyDaysOf(e).map((x) => ({ employeeId: e.id, workDate: x.iso, status: "present" as Status })));

  const fillDay = (iso: string) =>
    save(
      rows
        .filter((e) => iso >= e.hireDate && !marks.has(`${e.id}|${iso}`))
        .map((e) => ({ employeeId: e.id, workDate: iso, status: "present" as Status }))
    );

  const fillAll = () =>
    save(rows.flatMap((e) => emptyDaysOf(e).map((x) => ({ employeeId: e.id, workDate: x.iso, status: "present" as Status }))));

  const countOf = (e: EmployeeRecord) => {
    let n = 0;
    for (const x of days) {
      const m = marks.get(`${e.id}|${x.iso}`);
      if (m && (m.status === "present" || m.status === "late" || m.status === "vacation" || m.status === "sick_leave")) n++;
    }
    return n;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="min-h-10 border-b border-border bg-card px-3 py-1 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 bg-muted/60 px-2 h-7 rounded border border-border/70 text-xs">
          <Calendar className="size-3 text-muted-foreground" />
          <input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="bg-transparent font-mono text-xs focus:outline-none"
          />
        </div>

        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-1">
          {BRUSHES.map((b) => (
            <button
              key={b.status}
              type="button"
              onClick={() => setBrush(b.status)}
              className={`h-7 px-2 rounded border text-xs font-medium cursor-pointer ${b.cls} ${
                brush === b.status ? "border-foreground" : "border-transparent"
              }`}
              title={b.label}
            >
              {b.code} {b.label}
            </button>
          ))}
        </div>

        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs shadow-none" disabled={saving} onClick={fillAll}>
          Hammasi kelgan
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-48">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Xodim yoki tabel №"
              className="pl-7 h-7 text-xs"
            />
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={load} disabled={loading} aria-label="Yangilash">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Badge variant="outline" className="h-6 px-1.5 font-normal text-[11px]">
            {rows.length} xodim
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-[11px] select-none">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <th className="sticky left-0 z-20 bg-card border border-border px-2 h-7 text-left font-medium min-w-[220px]">
                Xodim
              </th>
              {days.map((x) => (
                <th
                  key={x.iso}
                  onClick={() => fillDay(x.iso)}
                  title="Shu kun uchun belgilanmaganlarni kelgan qilish"
                  className={`border border-border w-7 min-w-7 font-normal cursor-pointer hover:bg-muted ${
                    x.dow === 0 ? "text-red-600" : ""
                  }`}
                >
                  <div className="leading-3 pt-0.5">{x.d}</div>
                  <div className="leading-3 pb-0.5 text-muted-foreground">{WEEKDAYS[x.dow]}</div>
                </th>
              ))}
              <th className="border border-border px-2 font-medium min-w-[48px]">Kun</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td
                  onClick={() => fillRow(e)}
                  title="Belgilanmagan ish kunlarini kelgan qilish"
                  className="sticky left-0 z-10 bg-card border border-border px-2 h-7 whitespace-nowrap cursor-pointer hover:bg-muted"
                >
                  <span className="font-mono text-muted-foreground mr-1.5">{e.badgeNumber || e.badgeNo}</span>
                  {e.fullName}
                </td>
                {days.map((x) => {
                  const m = marks.get(`${e.id}|${x.iso}`);
                  const b = m ? BRUSH_BY_STATUS.get(m.status) : null;
                  const before = x.iso < e.hireDate;
                  return (
                    <td
                      key={x.iso}
                      onClick={() => !before && !saving && onCell(e, x.iso)}
                      className={`border border-border w-7 min-w-7 h-7 text-center ${
                        before ? "bg-muted/40 cursor-not-allowed" : "cursor-pointer hover:outline hover:outline-1 hover:outline-foreground"
                      } ${b ? b.cls : x.dow === 0 ? "bg-muted/30" : ""} ${m && !m.manual ? "font-normal" : "font-semibold"}`}
                      title={m ? `${b?.label}${m.manual ? " (qo'lda)" : " (turniket)"}` : undefined}
                    >
                      {b?.code}
                    </td>
                  );
                })}
                <td className="border border-border px-2 text-center font-mono">{countOf(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
