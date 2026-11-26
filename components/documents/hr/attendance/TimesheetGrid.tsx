"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, RefreshCw, Save, Search, Undo2 } from "lucide-react";
import type { AttendanceRecord, EmployeeRecord } from "../types";

type Status = "present" | "late" | "absent" | "sick_leave" | "vacation" | "day_off";

interface Mark {
  status: Status;
  manual: boolean;
  /** Saved facts of the day; absent on unsaved edits. */
  hours?: number;
  overtime?: number;
  /** Hours short of the shift norm; only known when in/out times were recorded. */
  short?: number;
  delay?: number;
  checkIn?: string | null;
  checkOut?: string | null;
}

interface ShiftWindow {
  start: string;
  end: string;
}

// Same fallback as the roll-call bot (lib/rollCallTime.ts).
const DEFAULT_WINDOWS: Record<"day" | "night", ShiftWindow> = {
  day: { start: "08:00", end: "20:00" },
  night: { start: "20:00", end: "08:00" },
};

const isClock = (v: unknown): v is string => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);

function windowHours(w: ShiftWindow): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let len = toMin(w.end) - toMin(w.start);
  if (len <= 0) len += 24 * 60;
  return len / 60;
}

const fmtH = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

const WORKED: Status[] = ["present", "late"];

interface Entry {
  employeeId: string;
  workDate: string;
  status: Status | null;
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
  // Unsaved edits keyed like `marks`; null status = remove the manual mark.
  const [pending, setPending] = useState<Map<string, Entry>>(new Map());
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
      const [empRes, attRes, shiftRes] = await Promise.all([
        fetch("/api/v1/hr/employees").then((r) => r.json()),
        fetch(`/api/v1/hr/attendance?period=${period}`).then((r) => r.json()),
        fetch("/api/v1/hr/shifts").then((r) => r.json()).catch(() => null),
      ]);
      if (empRes.success) {
        setStaff((empRes.data as EmployeeRecord[]).filter((e) => e.status !== "terminated"));
      }

      // Shift norm per type: first active shift by start time, as the bot picks it.
      const shiftRows = (shiftRes?.success ? shiftRes.data : []) as {
        shiftType: string;
        startTime: string;
        endTime: string;
        isActive: boolean;
      }[];
      const pick = (type: "day" | "night"): ShiftWindow => {
        const row = shiftRows
          .filter((r) => r.isActive && r.shiftType === type && isClock(r.startTime) && isClock(r.endTime))
          .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
        return row ? { start: row.startTime, end: row.endTime } : DEFAULT_WINDOWS[type];
      };
      const norm = { day: windowHours(pick("day")), night: windowHours(pick("night")) };

      const next = new Map<string, Mark>();
      if (attRes.success) {
        for (const a of attRes.data as AttendanceRecord[]) {
          const st = normalizeStatus(String(a.status));
          if (!st) continue;
          const worked = WORKED.includes(st);
          const hours = worked ? Number(a.workedHours) || 0 : 0;
          const timed = Boolean(a.checkIn || a.checkOut);
          const n = String(a.shiftType ?? "").toLowerCase().startsWith("night") ? norm.night : norm.day;
          next.set(`${a.employeeId}|${a.workDate}`, {
            status: st,
            manual: a.sourceDevice === "manual",
            hours,
            overtime: worked ? Number(a.overtimeHours) || 0 : 0,
            short: worked && timed ? Math.max(0, Math.round((n - hours) * 4) / 4) : 0,
            delay: a.delayMinutes || 0,
            checkIn: a.checkIn,
            checkOut: a.checkOut,
          });
        }
      }
      setMarks(next);
      setPending(new Map());
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

  const dirty = pending.size > 0;

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const confirmDiscard = () => !dirty || window.confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etilsinmi?");

  // Effective mark: an unsaved edit wins over the saved one.
  const markOf = (key: string): Mark | undefined => {
    const p = pending.get(key);
    if (!p) return marks.get(key);
    return p.status ? { status: p.status, manual: true } : undefined;
  };

  const stage = (entries: Entry[]) => {
    if (entries.length === 0) return;
    setPending((prev) => {
      const next = new Map(prev);
      for (const en of entries) {
        const key = `${en.employeeId}|${en.workDate}`;
        const orig = marks.get(key);
        // Edit back to the saved value drops it from the draft.
        const same = en.status === null ? !orig : orig?.manual && orig.status === en.status;
        if (same) next.delete(key);
        else next.set(key, en);
      }
      return next;
    });
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [...pending.values()] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Saqlanmadi");
      if (json.skipped?.length) {
        addNotification({
          title: `${json.saved} ta saqlandi, ${json.skipped.length} ta o'tkazib yuborildi`,
          description: json.skipped[0].reason,
          severity: "warning",
        });
      } else {
        addNotification({ title: "Tabel saqlandi", description: `${json.saved ?? pending.size} ta yozuv`, severity: "success" });
      }
      await load();
    } catch (e) {
      addNotification({ title: "Saqlanmadi", description: e instanceof Error ? e.message : "Xatolik", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const onCell = (e: EmployeeRecord, iso: string) => {
    const cur = markOf(`${e.id}|${iso}`);
    // Same brush on a manual mark removes it; otherwise paint.
    const status = cur?.manual && cur.status === brush ? null : brush;
    stage([{ employeeId: e.id, workDate: iso, status }]);
  };

  // Unmarked, employed, non-Sunday, not-future days of one employee.
  const emptyDaysOf = (e: EmployeeRecord) =>
    days.filter((x) => x.dow !== 0 && x.iso <= todayIso() && x.iso >= e.hireDate && !markOf(`${e.id}|${x.iso}`));

  const fillRow = (e: EmployeeRecord) =>
    stage(emptyDaysOf(e).map((x) => ({ employeeId: e.id, workDate: x.iso, status: "present" as Status })));

  const fillDay = (iso: string) =>
    stage(
      rows
        .filter((e) => iso >= e.hireDate && !markOf(`${e.id}|${iso}`))
        .map((e) => ({ employeeId: e.id, workDate: iso, status: "present" as Status }))
    );

  const fillAll = () =>
    stage(rows.flatMap((e) => emptyDaysOf(e).map((x) => ({ employeeId: e.id, workDate: x.iso, status: "present" as Status }))));

  // Unsaved edits carry no hours, so only saved facts are summed.
  const totalsOf = (e: EmployeeRecord) => {
    const t = { days: 0, hours: 0, overtime: 0, short: 0 };
    for (const x of days) {
      const m = markOf(`${e.id}|${x.iso}`);
      if (!m) continue;
      if (m.status === "present" || m.status === "late" || m.status === "vacation" || m.status === "sick_leave") t.days++;
      t.hours += m.hours ?? 0;
      t.overtime += m.overtime ?? 0;
      t.short += m.short ?? 0;
    }
    return t;
  };

  const cellTitle = (m: Mark | undefined, label: string | undefined, edited: boolean) => {
    if (edited) return `${label ?? "O'chiriladi"} (saqlanmagan)`;
    if (!m) return undefined;
    const lines = [`${label}${m.manual ? " (qo'lda)" : " (turniket)"}`];
    if (m.checkIn || m.checkOut) lines.push(`Keldi ${m.checkIn ?? "—"} · Ketdi ${m.checkOut ?? "—"}`);
    if (WORKED.includes(m.status)) {
      const parts = [`Ishladi ${fmtH(m.hours ?? 0)} s`];
      if (m.short) parts.push(`Kam ${fmtH(m.short)} s`);
      if (m.overtime) parts.push(`Ortiqcha ${fmtH(m.overtime)} s`);
      lines.push(parts.join(" · "));
    }
    if (m.delay) lines.push(`Kechikish ${m.delay} daq`);
    return lines.join("\n");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="min-h-10 border-b border-border bg-card px-3 py-1 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 bg-muted/60 px-2 h-7 rounded border border-border/70 text-xs">
          <Calendar className="size-3 text-muted-foreground" />
          <input
            type="month"
            value={period}
            onChange={(e) => e.target.value && confirmDiscard() && setPeriod(e.target.value)}
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => confirmDiscard() && load()}
            disabled={loading || saving}
            aria-label="Yangilash"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Badge variant="outline" className="h-6 px-1.5 font-normal text-[11px]">
            {rows.length} xodim
          </Badge>
          <Separator orientation="vertical" className="h-4" />
          {dirty && (
            <span className="text-[11px] text-amber-700 dark:text-amber-400 whitespace-nowrap">
              {pending.size} ta o&apos;zgarish
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs shadow-none"
            disabled={!dirty || saving}
            onClick={() => setPending(new Map())}
          >
            <Undo2 className="size-3.5 mr-1" />
            Bekor
          </Button>
          <Button size="sm" className="h-7 px-2.5 text-xs shadow-none" disabled={!dirty || saving} onClick={save}>
            <Save className="size-3.5 mr-1" />
            {saving ? "Saqlanmoqda" : "Saqlash"}
          </Button>
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
              <th className="border border-border px-2 font-medium min-w-[40px]">Kun</th>
              <th className="border border-border px-2 font-medium min-w-[48px]">Soat</th>
              <th className="border border-border px-2 font-medium min-w-[56px]">Ortiqcha</th>
              <th className="border border-border px-2 font-medium min-w-[40px]">Kam</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const t = totalsOf(e);
              return (
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
                    const key = `${e.id}|${x.iso}`;
                    const m = markOf(key);
                    const edited = pending.has(key);
                    const b = m ? BRUSH_BY_STATUS.get(m.status) : null;
                    const before = x.iso < e.hireDate;
                    const showHours = !edited && m && WORKED.includes(m.status) && m.hours !== undefined;
                    return (
                      <td
                        key={x.iso}
                        onClick={() => !before && !saving && onCell(e, x.iso)}
                        className={`border border-border w-7 min-w-7 h-7 text-center ${
                          before ? "bg-muted/40 cursor-not-allowed" : "cursor-pointer hover:outline hover:outline-1 hover:outline-foreground"
                        } ${b ? b.cls : x.dow === 0 ? "bg-muted/30" : ""} ${m && !m.manual ? "font-normal" : "font-semibold"} ${
                          edited ? "ring-1 ring-inset ring-amber-500" : ""
                        }`}
                        title={cellTitle(m, b?.label, edited)}
                      >
                        {showHours && m ? (
                          <div className="flex flex-col items-center leading-[11px]">
                            <span>{b?.code}</span>
                            <span className={`text-[9px] font-normal font-mono ${m.short ? "text-red-600 dark:text-red-400" : ""}`}>
                              {fmtH(m.hours ?? 0)}
                              {m.overtime ? <span className="text-sky-700 dark:text-sky-400">+{fmtH(m.overtime)}</span> : null}
                            </span>
                          </div>
                        ) : (
                          b?.code
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-border px-2 text-center font-mono">{t.days}</td>
                  <td className="border border-border px-2 text-center font-mono">{fmtH(t.hours)}</td>
                  <td className="border border-border px-2 text-center font-mono">{t.overtime ? fmtH(t.overtime) : ""}</td>
                  <td className={`border border-border px-2 text-center font-mono ${t.short ? "text-red-600 dark:text-red-400" : ""}`}>
                    {t.short ? fmtH(t.short) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
