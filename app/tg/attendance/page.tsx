"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Lock, Minus, Moon, Plus, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { telegramApp, useTelegramBackButton, useTgSession } from "../TgSession";
import type { RollCallRow, RollCallSheet, RollCallShift, RollCallStatus } from "@/lib/server/tgAttendanceService";

// ─── Labels & helpers ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<RollCallStatus, string> = {
  present: "Keldi",
  late: "Kechikdi",
  absent: "Kelmadi",
  sick_leave: "Kasal",
  vacation: "Ta'til",
  day_off: "Dam olish",
};
const STATUS_ORDER: RollCallStatus[] = ["present", "late", "absent", "sick_leave", "vacation", "day_off"];
const WORKING = new Set<RollCallStatus>(["present", "late"]);

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}
function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

interface Mark {
  status: RollCallStatus | null;
  shiftType: RollCallShift;
  overtimeHours: number;
}

function markOf(row: RollCallRow): Mark {
  return { status: row.status, shiftType: row.shiftType ?? row.defaultShift, overtimeHours: row.overtimeHours };
}
function sameMark(a: Mark, b: Mark): boolean {
  return a.status === b.status && a.overtimeHours === b.overtimeHours && (a.status === null || a.shiftType === b.shiftType);
}

function confirmDiscard(message: string): Promise<boolean> {
  const app = telegramApp();
  if (app?.initData && app.showConfirm) return new Promise((resolve) => app.showConfirm!(message, resolve));
  return Promise.resolve(window.confirm(message));
}

// ─── Row ─────────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<RollCallStatus, string> = {
  present: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  late: "border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  absent: "border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-400",
  sick_leave: "border-border bg-muted text-foreground",
  vacation: "border-border bg-muted text-foreground",
  day_off: "border-border bg-muted text-muted-foreground",
};

function RollCallItem({
  row,
  mark,
  dirty,
  shift,
  onChange,
}: {
  row: RollCallRow;
  mark: Mark;
  dirty: boolean;
  shift: RollCallShift;
  onChange: (next: Mark) => void;
}) {
  const working = mark.status !== null && WORKING.has(mark.status);
  const otherShift: RollCallShift = shift === "day" ? "night" : "day";

  const toggle = () => {
    if (row.locked) return;
    onChange(mark.status === "present" ? { ...mark, status: null, overtimeHours: 0 } : { ...mark, status: "present", shiftType: shift });
  };

  const onSelect = (value: string) => {
    if (value === "move") onChange({ ...mark, status: mark.status ?? "present", shiftType: otherShift });
    else if (value === "clear") onChange({ ...mark, status: null, overtimeHours: 0 });
    else {
      const status = value as RollCallStatus;
      onChange({ ...mark, status, shiftType: shift, overtimeHours: WORKING.has(status) ? mark.overtimeHours : 0 });
    }
  };

  const stepOvertime = (delta: number) =>
    onChange({ ...mark, overtimeHours: Math.min(16, Math.max(0, mark.overtimeHours + delta)) });

  return (
    <div className={cn("flex h-12 items-center gap-2 border-b border-border px-3", dirty && "bg-muted/60")}>
      <button type="button" onClick={toggle} disabled={row.locked} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
            mark.status === "present" ? "border-emerald-600 bg-emerald-600 text-white" : "border-border bg-muted text-muted-foreground"
          )}
        >
          {mark.status === "present" ? <Check className="size-3.5" /> : initials(row.fullName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm leading-tight">{row.fullName}</span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {row.position || row.badgeNumber}
          </span>
        </span>
      </button>

      {working && !row.locked && (
        <div className="flex h-7 shrink-0 items-center rounded-md border border-border">
          <button type="button" aria-label="Kamaytirish" onClick={() => stepOvertime(-0.5)} className="flex h-full w-6 items-center justify-center text-muted-foreground active:bg-muted">
            <Minus className="size-3" />
          </button>
          <span className={cn("w-8 text-center text-xs tabular-nums", mark.overtimeHours > 0 ? "font-medium" : "text-muted-foreground")}>
            {mark.overtimeHours > 0 ? `+${mark.overtimeHours}` : "0"}
          </span>
          <button type="button" aria-label="Ko'paytirish" onClick={() => stepOvertime(0.5)} className="flex h-full w-6 items-center justify-center text-muted-foreground active:bg-muted">
            <Plus className="size-3" />
          </button>
        </div>
      )}

      {row.locked ? (
        <span className="flex h-7 w-[84px] shrink-0 items-center justify-center gap-1 rounded-md border border-border text-[11px] text-muted-foreground">
          <Lock className="size-3" />
          {mark.status ? STATUS_LABEL[mark.status] : "Yopiq"}
        </span>
      ) : (
        <label
          className={cn(
            "relative flex h-7 w-[84px] shrink-0 items-center justify-center rounded-md border text-[11px] font-medium",
            mark.status ? STATUS_TONE[mark.status] : "border-dashed border-border text-muted-foreground"
          )}
        >
          {mark.status ? STATUS_LABEL[mark.status] : "Belgilash"}
          <select
            aria-label={`${row.fullName} holati`}
            value=""
            onChange={(e) => onSelect(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="" disabled>
              Holat
            </option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
            {mark.status !== null && <option value="clear">Belgini olib tashlash</option>}
            <option value="move">{otherShift === "night" ? "Tungi smenaga" : "Kunduzgi smenaga"}</option>
          </select>
        </label>
      )}
    </div>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const router = useRouter();
  const { api } = useTgSession();
  const today = React.useMemo(() => isoDate(new Date()), []);

  const [date, setDate] = React.useState(today);
  const [shift, setShift] = React.useState<RollCallShift>("day");
  const [query, setQuery] = React.useState("");
  const [sheet, setSheet] = React.useState<RollCallSheet | null>(null);
  const [draft, setDraft] = React.useState<Map<string, Mark>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  /** Fetches the day's sheet; returns an error message instead of throwing. */
  const fetchSheet = React.useCallback(
    async (d: string): Promise<RollCallSheet | string> => {
      try {
        const res = await api(`/api/v1/tg/attendance?date=${d}`);
        const json = await res.json();
        return res.ok && json.success ? (json.data as RollCallSheet) : json.error || "Yuklab bo'lmadi";
      } catch {
        return "Server bilan aloqa yo'q";
      }
    },
    [api]
  );

  const applySheet = React.useCallback((result: RollCallSheet | string) => {
    if (typeof result === "string") {
      setSheet(null);
      setMessage({ tone: "error", text: result });
    } else {
      setSheet(result);
    }
    setDraft(new Map());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchSheet(date).then((result) => {
      if (!cancelled) applySheet(result);
    });
    return () => {
      cancelled = true;
    };
  }, [date, fetchSheet, applySheet]);

  const dirtyCount = draft.size;

  const goBack = React.useCallback(async () => {
    if (dirtyCount > 0 && !(await confirmDiscard("Saqlanmagan belgilar bor. Chiqasizmi?"))) return;
    router.push("/tg");
  }, [dirtyCount, router]);
  useTelegramBackButton(goBack);

  const changeDate = async (next: string) => {
    if (next > today) return;
    if (dirtyCount > 0 && !(await confirmDiscard("Saqlanmagan belgilar bor. Boshqa kunga o'tasizmi?"))) return;
    setLoading(true);
    setMessage(null);
    setDate(next);
  };

  const rows = sheet?.rows ?? [];
  const current = (row: RollCallRow): Mark => draft.get(row.employeeId) ?? markOf(row);

  const setMark = (row: RollCallRow, next: Mark) => {
    setDraft((prev) => {
      const map = new Map(prev);
      if (sameMark(next, markOf(row))) map.delete(row.employeeId);
      else map.set(row.employeeId, next);
      return map;
    });
  };

  const q = query.trim().toLowerCase();
  const inShift = rows.filter((r) => current(r).shiftType === shift);
  const visible = inShift.filter((r) => !q || r.fullName.toLowerCase().includes(q) || r.badgeNumber.toLowerCase().includes(q));
  const countIn = (s: RollCallShift) => rows.filter((r) => current(r).shiftType === s).length;

  const groups = React.useMemo(() => {
    const map = new Map<string, RollCallRow[]>();
    for (const r of visible) {
      const key = r.department || "Bo'limsiz";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [visible]);

  const summary = React.useMemo(() => {
    let came = 0, absent = 0, unmarked = 0, overtime = 0;
    for (const r of inShift) {
      const m = current(r);
      if (m.status === null) unmarked++;
      else if (WORKING.has(m.status)) { came++; overtime += m.overtimeHours; }
      else absent++;
    }
    return { came, absent, unmarked, overtime };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inShift, draft]);

  const markAllPresent = () => {
    for (const r of visible) {
      if (r.locked || current(r).status !== null) continue;
      setMark(r, { ...current(r), status: "present", shiftType: shift });
    }
  };

  const save = async () => {
    if (!sheet || dirtyCount === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const entries = [...draft.entries()].map(([employeeId, m]) => ({ employeeId, ...m }));
      const res = await api("/api/v1/tg/attendance", { method: "POST", body: JSON.stringify({ date: sheet.date, entries }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Saqlab bo'lmadi");
      const skipped = (json.skipped ?? []) as { reason: string }[];
      telegramApp()?.HapticFeedback?.notificationOccurred(skipped.length ? "warning" : "success");
      applySheet(await fetchSheet(sheet.date));
      setMessage(
        skipped.length
          ? { tone: "error", text: `${json.saved} ta saqlandi, ${skipped.length} ta o'tkazildi: ${skipped[0].reason}` }
          : { tone: "ok", text: `${json.saved} ta belgi saqlandi` }
      );
    } catch (e) {
      telegramApp()?.HapticFeedback?.notificationOccurred("error");
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Saqlab bo'lmadi" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-10 space-y-2 border-b border-border bg-background px-3 pb-2 pt-2">
        <div className="flex h-8 items-center gap-1">
          <button type="button" aria-label="Oldingi kun" onClick={() => changeDate(shiftDate(date, -1))} className="flex size-8 items-center justify-center rounded-md active:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-sm font-medium leading-tight">{formatDate(date)}</div>
            {sheet?.company.name && <div className="truncate text-[11px] leading-tight text-muted-foreground">{sheet.company.name}</div>}
          </div>
          <button
            type="button"
            aria-label="Keyingi kun"
            disabled={date >= today}
            onClick={() => changeDate(shiftDate(date, 1))}
            className="flex size-8 items-center justify-center rounded-md active:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid h-8 grid-cols-2 rounded-md border border-border bg-muted p-0.5">
          {(["day", "night"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShift(s)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-[5px] text-xs",
                shift === s ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
              )}
            >
              {s === "day" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              {s === "day" ? "Kunduzgi" : "Tungi"}
              <span className="tabular-nums text-muted-foreground">{countIn(s)}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qidirish"
              className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none focus:border-foreground/30"
            />
          </div>
          <button
            type="button"
            onClick={markAllPresent}
            disabled={!visible.some((r) => !r.locked && current(r).status === null)}
            className="h-8 shrink-0 rounded-md border border-border px-2.5 text-xs active:bg-muted disabled:opacity-40"
          >
            Hammasi keldi
          </button>
        </div>
      </header>

      <section className="flex-1 pb-28">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">{q ? "Topilmadi" : "Bu smenada hodim yo'q"}</div>
        ) : (
          groups.map(([dept, list]) => (
            <div key={dept}>
              <div className="sticky top-[129px] z-[5] flex h-6 items-center justify-between border-b border-border bg-muted px-3 text-[11px] font-medium text-muted-foreground">
                <span className="truncate">{dept}</span>
                <span className="tabular-nums">{list.length}</span>
              </div>
              {list.map((r) => (
                <RollCallItem
                  key={r.employeeId}
                  row={r}
                  mark={current(r)}
                  dirty={draft.has(r.employeeId)}
                  shift={shift}
                  onChange={(m) => setMark(r, m)}
                />
              ))}
            </div>
          ))
        )}
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background">
        <div className="mx-auto max-w-lg space-y-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {message && (
            <div className={cn("text-xs", message.tone === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
              {message.text}
            </div>
          )}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>Keldi <b className="font-medium tabular-nums text-foreground">{summary.came}</b></span>
            <span>Kelmadi <b className="font-medium tabular-nums text-foreground">{summary.absent}</b></span>
            <span>Belgisiz <b className="font-medium tabular-nums text-foreground">{summary.unmarked}</b></span>
            {summary.overtime > 0 && (
              <span className="ml-auto">Ortiqcha <b className="font-medium tabular-nums text-foreground">{summary.overtime} s</b></span>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={dirtyCount === 0 || saving}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dirtyCount > 0 ? `Saqlash · ${dirtyCount}` : "Saqlash"}
          </button>
        </div>
      </footer>
    </main>
  );
}
