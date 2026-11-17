"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Pause, Play, Plus, RefreshCw, SlidersHorizontal, Wrench, ExternalLink, LayoutGrid, Users, UserRound, LogOut, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_SHIFTS, plantClock, type ShiftInterval } from "@/lib/shiftSchedule";
import type { RouteStep, ShiftEvent } from "../types";
import { formatMinutes, type StepPhase } from "../utils/stepTimeline";
import { stepUnit } from "../utils/stepKpis";
import { PalletReportDialog } from "../dialogs/PalletReportDialog";
import { DowntimeLogDialog } from "../dialogs/DowntimeLogDialog";
import { useAskDialog } from "../dialogs/AskDialog";
import type { FloorMachine, TerminalJob, TerminalMachine } from "@/lib/server/operatorTerminalService";
import { OperatorIdentifyDialog, type KioskOperator } from "./OperatorIdentifyDialog";

/**
 * Operator terminal: one machine, its queue across all active orders, and the current job
 * driven with large buttons. Every action is a shift-journal entry, saved on the spot.
 */

const MACHINE_KEY = "pg.terminal.machine";
/** Shared kiosk on this device: every action asks who is at the machine. */
const KIOSK_KEY = "pg.terminal.kiosk";
/** The identified operator is let go after this long without an action. */
const OPERATOR_IDLE_MS = 60_000;

const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};
const writeLocal = (key: string, value: string) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* per-browser convenience only */
  }
};

const PHASE_LABEL: Record<StepPhase, string> = {
  queued: "Navbatda",
  setup: "Sozlash",
  run: "Ishlamoqda",
  paused: "To'xtalish",
  finished: "Yakunlandi",
};

const PHASE_CLASS: Record<StepPhase, string> = {
  queued: "bg-muted text-muted-foreground border-border",
  setup: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
  run: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  finished: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const hms = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** The dialogs work on route steps: a terminal job seen as one. */
function jobAsStep(job: TerminalJob, operator = ""): RouteStep {
  return {
    id: job.opId,
    stepNumber: job.stepNumber,
    name: job.opName,
    machine: "",
    operator,
    duration: job.plannedHours,
    // Same shape as a stored step: the plan is in order pieces, the dialog converts it to the step's unit.
    qtyCompleted: `${job.goodQty.toLocaleString()} / ${job.plannedPieces.toLocaleString()}`,
    status: job.phase === "paused" ? "Paused" : job.phase === "queued" ? "Queued" : "In Progress",
  };
}

export function OperatorTerminal() {
  const { currentUser, addNotification, openTab } = useWorkspaceStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      addNotification: s.addNotification,
      openTab: s.openTab,
    }))
  );
  const storeMachines = useWorkspaceStore((s) => s.machines);
  useEffect(() => {
    const st = useWorkspaceStore.getState();
    if (st.machines.length === 0 && st.loadMachines) st.loadMachines();
  }, []);
  const [machines, setMachines] = useState<TerminalMachine[]>([]);
  const [machineId, setMachineId] = useState<string>(() => readLocal(MACHINE_KEY));
  const [floor, setFloor] = useState<FloorMachine[]>([]);
  const [kiosk, setKiosk] = useState<boolean>(() => readLocal(KIOSK_KEY) === "1");
  const [operator, setOperatorState] = useState<KioskOperator | null>(null);
  const operatorRef = useRef<KioskOperator | null>(null);
  const lastActionRef = useRef(0);
  const [lastActionAt, setLastActionAt] = useState(0);
  const identifyResolver = useRef<((op: KioskOperator | null) => void) | null>(null);
  const [identifyLabel, setIdentifyLabel] = useState<string | null>(null);
  const [jobs, setJobs] = useState<TerminalJob[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [schedule, setSchedule] = useState<ShiftInterval[]>(DEFAULT_SHIFTS);
  const [isPalletOpen, setIsPalletOpen] = useState(false);
  const [downtimeMode, setDowntimeMode] = useState<"open" | "record" | null>(null);
  const askDialog = useAskDialog();

  const isOperator = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === "admin" || currentUser.role === "System Administrator") return false;
    const role = (currentUser.role || "").toLowerCase();
    if (role.includes("operator") || role.includes("pressman") || role.includes("stanokchi")) return true;
    return Boolean(currentUser.permissions?.production && !currentUser.permissions.production.edit);
  }, [currentUser]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/v1/production/terminal");
      const json = await res.json().catch(() => ({}));
      if (json.success) setMachines(json.machines || []);
    })();
  }, []);

  const loadQueue = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/production/terminal?machineId=${encodeURIComponent(machineId)}`);
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(json.error || "Navbat yuklanmadi");
        return;
      }
      setError("");
      const list: TerminalJob[] = json.jobs || [];
      setJobs(list);
      setSelectedKey((cur) =>
        list.some((j) => `${j.workOrderNo}:${j.opId}` === cur) ? cur : list[0] ? `${list[0].workOrderNo}:${list[0].opId}` : ""
      );
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  // The queue changes from other screens too: refresh it every half minute.
  useEffect(() => {
    void loadQueue();
    const id = setInterval(() => void loadQueue(), 30000);
    return () => clearInterval(id);
  }, [loadQueue]);

  // No machine picked: the whole shop as tiles, refreshed like the queue.
  const loadFloor = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/production/terminal?overview=1");
      const json = await res.json().catch(() => ({}));
      if (json.success) setFloor(json.floor || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (machineId) return;
    const first = setTimeout(() => void loadFloor(), 0);
    const id = setInterval(() => void loadFloor(), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [machineId, loadFloor]);

  const pickMachine = (id: string) => {
    setMachineId(id);
    writeLocal(MACHINE_KEY, id);
  };

  const setOperator = (op: KioskOperator | null) => {
    operatorRef.current = op;
    setOperatorState(op);
  };
  /** Every action by the identified operator restarts the idle window. */
  const touchOperator = () => {
    const at = Date.now();
    lastActionRef.current = at;
    setLastActionAt(at);
  };

  /**
   * Kiosk mode: resolves once someone has identified (or is still within the idle window).
   * Off kiosk, the signed-in account is the operator, as before.
   */
  const requireOperator = (label: string): Promise<boolean> => {
    if (!kiosk) return Promise.resolve(true);
    const cur = operatorRef.current;
    const fresh =
      cur &&
      Date.now() - lastActionRef.current < OPERATOR_IDLE_MS &&
      new Date(cur.expiresAt).getTime() - Date.now() > OPERATOR_IDLE_MS;
    if (fresh) {
      touchOperator();
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      identifyResolver.current = (op) => {
        identifyResolver.current = null;
        setIdentifyLabel(null);
        if (op) {
          setOperator(op);
          touchOperator();
        }
        resolve(Boolean(op));
      };
      setIdentifyLabel(label);
    });
  };

  const toggleKiosk = () => {
    const next = !kiosk;
    setKiosk(next);
    writeLocal(KIOSK_KEY, next ? "1" : "");
    setOperator(null);
  };

  const job = jobs.find((j) => `${j.workOrderNo}:${j.opId}` === selectedKey) || null;

  // The plant's shifts, for the report and downtime dialogs.
  useEffect(() => {
    if (!job) return;
    (async () => {
      const res = await useWorkspaceStore.getState().loadWorkOrderEventsAsync(job.workOrderNo);
      if (res.success && res.schedule?.length) setSchedule(res.schedule);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the schedule is per plant, one load is enough
  }, [job?.workOrderNo]);

  /** `asOperator: false` keeps an entry's own operator (closing a downtime someone else opened). */
  const save = async (event: ShiftEvent, okTitle?: string, asOperator = true) => {
    if (!job) return false;
    const op = kiosk && asOperator ? operatorRef.current : null;
    setBusy(true);
    try {
      const res = await useWorkspaceStore
        .getState()
        .saveWorkOrderEventAsync(job.workOrderNo, op ? { ...event, operator: op.fullName, operatorToken: op.token } : event);
      if (!res.success) {
        addNotification({ title: "Saqlanmadi", description: res.error, severity: "error" });
        return false;
      }
      if (okTitle) addNotification({ title: okTitle, description: `${job.workOrderNo} · #${job.stepNumber} ${job.opName}`, severity: "success" });
      if (op) touchOperator();
      await loadQueue();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const transition = (type: ShiftEvent["type"], note: string, extra: Partial<ShiftEvent> = {}) => {
    if (!job) return Promise.resolve(false);
    const at = new Date();
    return save(
      { id: `e_${type}_${at.getTime()}`, opId: job.opId, type, time: plantClock(at).time, occurredAt: at.toISOString(), note, operator: "", ...extra },
      undefined
    );
  };

  /** Same rule as the order screen: no start before the previous step has output (managers may override). */
  const startGate = async (): Promise<{ ok: boolean; note?: string }> => {
    if (!job || job.ready) return { ok: true };
    const prev = job.previousStep;
    const label = prev ? `#${prev.stepNumber} ${prev.name}` : "Oldingi bosqich";
    if (isOperator) {
      addNotification({ title: "Boshlab bo'lmaydi", description: `${label} hali chiqim bermagan.`, severity: "error" });
      return { ok: false };
    }
    const reason = await askDialog.ask({
      title: "Oldingi bosqich chiqim bermagan",
      message: `${label} hali chiqim bermagan. Bosqichni parallel boshlash uchun sababini yozing.`,
      reasonLabel: "Sabab",
      confirmLabel: "Boshlash",
    });
    if (!reason) return { ok: false };
    return { ok: true, note: `Oldingi bosqichsiz boshlandi: ${reason}` };
  };

  const startSetup = async () => {
    if (!(await requireOperator("Sozlash"))) return;
    const gate = await startGate();
    if (gate.ok) await transition("SetupStart", gate.note || "Sozlash boshlandi");
  };

  const startRun = async () => {
    if (!(await requireOperator("Ishga tushirish"))) return;
    let note = "Ish boshlandi";
    if (job?.phase === "queued") {
      const gate = await startGate();
      if (!gate.ok) return;
      if (gate.note) note = gate.note;
    }
    await transition("RunStart", note);
  };

  const closeDowntime = async () => {
    if (!job?.openDowntime) return 0;
    const open = job.recentEvents.find((ev) => ev.id === job.openDowntime!.id);
    if (!open) return 0;
    const minutes = Math.max(1, Math.round((Date.now() - new Date(job.openDowntime.since).getTime()) / 60000));
    await save({ ...open, downtimeDurationMinutes: minutes }, undefined, false);
    return minutes;
  };

  const resume = async () => {
    if (!(await requireOperator("Davom ettirish"))) return;
    const minutes = await closeDowntime();
    if (minutes === 0) await transition("RunStart", "Davom ettirildi");
  };

  const finish = async (goodOverride?: number) => {
    if (!job) return;
    if (!(await requireOperator("Yakunlash"))) return;
    const good = goodOverride ?? job.goodQty;
    if (good <= 0) {
      addNotification({ title: "Yakunlab bo'lmaydi", description: "Avval chiqim hisobotini (palet) kiriting.", severity: "error" });
      return;
    }
    let note = "Bosqich yakunlandi";
    if (job.plannedQty > 0 && good < job.plannedQty) {
      const ok = await askDialog.ask({
        title: "Qisman yakunlash",
        message: `Reja: ${job.plannedQty.toLocaleString()}, fakt: ${good.toLocaleString()}. Bosqich qisman yakunlansinmi?`,
        confirmLabel: "Yakunlash",
      });
      if (ok === null) return;
      note = `Qisman yakunlandi: ${good.toLocaleString()} / ${job.plannedQty.toLocaleString()}`;
    }
    await closeDowntime();
    if (await transition("Finish", note)) {
      addNotification({ title: "Bosqich yakunlandi", description: `${job.workOrderNo} · #${job.stepNumber} ${job.opName}`, severity: "success" });
    }
  };

  const openPallet = async () => {
    if (await requireOperator("Palet")) setIsPalletOpen(true);
  };
  const openDowntime = async (mode: "open" | "record") => {
    if (await requireOperator(mode === "open" ? "To'xtatish" : "To'xtalish qayd")) setDowntimeMode(mode);
  };

  // The operator is let go after a minute without actions (never while one of their forms is open);
  // the next action asks again (requireOperator applies the same window).
  const dialogOpen = isPalletOpen || Boolean(downtimeMode);
  const activeOperator = operator && (dialogOpen || nowMs - lastActionAt <= OPERATOR_IDLE_MS) ? operator : null;
  const operatorLeft = activeOperator ? Math.max(0, Math.ceil((OPERATOR_IDLE_MS - (nowMs - lastActionAt)) / 1000)) : 0;

  const openSeconds = job?.openDowntime ? (nowMs - new Date(job.openDowntime.since).getTime()) / 1000 : 0;
  const scrap = job && job.inputQty > 0 ? (job.makeReadyQty + job.defectQty) / job.inputQty : null;
  const BIG = "h-12 px-5 text-sm font-semibold gap-2";
  // Quantities on this machine are counted in its speed unit (varaq, metr...).
  const unit = job?.profile.unit || stepUnit(storeMachines.find((m) => m.id === machineId) || null);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Machine bar */}
      <div className="h-11 shrink-0 border-b border-border bg-card px-3 flex items-center gap-3">
        <Button
          type="button"
          variant={machineId ? "ghost" : "secondary"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => pickMachine("")}
        >
          <LayoutGrid className="size-3.5" />
          <span>Sex</span>
        </Button>
        <Select
          value={machineId}
          onValueChange={(val: string | null) => {
            if (val) pickMachine(val);
          }}
        >
          <SelectTrigger className="h-8 w-72 text-xs">
            <SelectValue>{machines.find((m) => m.id === machineId)?.name || "Uskunani tanlang"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {machines.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                {m.name} <span className="text-muted-foreground">· {m.department}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void (machineId ? loadQueue() : loadFloor())}
          disabled={loading}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          <span>Yangilash</span>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {kiosk &&
            (activeOperator ? (
              <div className="h-8 pl-2.5 pr-1 flex items-center gap-2 rounded-md border border-border bg-muted/40 text-xs whitespace-nowrap">
                <UserRound className="size-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground max-w-48 truncate">{activeOperator.fullName}</span>
                <span className="font-mono text-muted-foreground w-7 text-right">{operatorLeft}s</span>
                <Button type="button" variant="ghost" size="icon" className="size-6" title="Chiqish" onClick={() => setOperator(null)}>
                  <LogOut className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground whitespace-nowrap">
                <Lock className="size-3.5" />
                <span>Operator yo&apos;q</span>
              </div>
            ))}
          <Button
            type="button"
            variant={kiosk ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={toggleKiosk}
            title="Umumiy kompyuter: har bir amal oldidan PIN yoki beyj"
          >
            <Users className="size-3.5" />
            <span>Kiosk</span>
          </Button>
          <span className="font-mono text-sm text-foreground">{plantClock(new Date(nowMs)).time}</span>
        </div>
      </div>

      {!machineId ? (
        <FloorGrid floor={floor} loading={loading} onPick={pickMachine} />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr]">
          {/* Queue */}
          <div className="border-r border-border overflow-y-auto">
            <div className="h-8 px-3 flex items-center text-[11px] text-muted-foreground border-b border-border">
              Navbat · {jobs.length}
            </div>
            {error && <div className="p-3 text-xs text-destructive">{error}</div>}
            {jobs.length === 0 && !error && (
              <div className="p-6 text-center text-xs text-muted-foreground">Bu uskunada ish yo&apos;q</div>
            )}
            {jobs.map((j) => {
              const key = `${j.workOrderNo}:${j.opId}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={cn(
                    "w-full text-left px-3 py-2 border-b border-border/60 hover:bg-muted/40",
                    key === selectedKey && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{j.workOrderNo}</span>
                    <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", PHASE_CLASS[j.phase])}>
                      {PHASE_LABEL[j.phase]}
                    </Badge>
                  </div>
                  <div className="text-xs font-medium text-foreground truncate">{j.productName}</div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">#{j.stepNumber} {j.opName}</span>
                    <span className="font-mono shrink-0">
                      {j.goodQty.toLocaleString()} / {j.plannedQty.toLocaleString()}
                    </span>
                  </div>
                  {(!j.ready || j.deadline) && (
                    <div className="flex items-center gap-2 text-[10px] mt-0.5">
                      {!j.ready && <span className="text-amber-600 dark:text-amber-400">Oldingi bosqich kutilmoqda</span>}
                      {j.deadline && <span className="ml-auto font-mono text-muted-foreground">{j.deadline}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Current job */}
          <div className="overflow-y-auto p-4">
            {!job ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Ishni tanlang</div>
            ) : (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{job.workOrderNo}</span>
                      <span>·</span>
                      <span className="truncate">{job.customerName}</span>
                      <button
                        type="button"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                        onClick={() => {
                          // Open the order on its shift journal, with what the registry already loaded.
                          const item = useWorkspaceStore
                            .getState()
                            .productionQueue.find((q) => q.docNo === job.workOrderNo || q.id === job.workOrderNo);
                          openTab({
                            id: job.workOrderNo,
                            title: `${job.workOrderNo}: ${job.productName}`,
                            type: "work-order",
                            module: "production",
                            isUnsaved: false,
                            activeLevel3Tab: "timeline",
                            documentData: { ...(item || {}), docNo: job.workOrderNo },
                          });
                        }}
                      >
                        <span>Buyurtma</span>
                        <ExternalLink className="size-3" />
                      </button>
                    </div>
                    <div className="text-lg font-semibold text-foreground leading-tight mt-0.5">{job.productName}</div>
                    <div className="text-sm text-muted-foreground">
                      #{job.stepNumber} {job.opName}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("h-8 px-3 text-sm", PHASE_CLASS[job.phase])}>
                    {PHASE_LABEL[job.phase]}
                  </Badge>
                </div>

                {job.openDowntime && (
                  <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
                    <Pause className="size-4" />
                    <span className="text-sm">{job.openDowntime.reason}</span>
                    <span className="ml-auto font-mono text-lg">{hms(openSeconds)}</span>
                  </div>
                )}
                {!job.ready && job.phase === "queued" && job.previousStep && (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    #{job.previousStep.stepNumber} {job.previousStep.name} hali chiqim bermagan
                  </div>
                )}

                {/* Big actions */}
                <div className="flex flex-wrap gap-2">
                  {job.phase === "queued" && (
                    <Button type="button" variant="outline" className={BIG} disabled={busy} onClick={() => void startSetup()}>
                      <SlidersHorizontal className="size-4" />
                      Sozlash
                    </Button>
                  )}
                  {(job.phase === "queued" || job.phase === "setup") && (
                    <Button type="button" className={cn(BIG, "bg-blue-600 hover:bg-blue-700 text-white")} disabled={busy} onClick={() => void startRun()}>
                      <Play className="size-4 fill-current" />
                      Ishga tushirish
                    </Button>
                  )}
                  {(job.phase === "setup" || job.phase === "run") && (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(BIG, "border-amber-500/40 text-amber-700 dark:text-amber-400")}
                      disabled={busy}
                      onClick={() => void openDowntime("open")}
                    >
                      <Pause className="size-4" />
                      To&apos;xtatish
                    </Button>
                  )}
                  {job.phase === "paused" && (
                    <Button type="button" className={cn(BIG, "bg-blue-600 hover:bg-blue-700 text-white")} disabled={busy} onClick={() => void resume()}>
                      <Play className="size-4 fill-current" />
                      Davom ettirish
                    </Button>
                  )}
                  {(job.phase === "run" || job.phase === "paused") && (
                    <Button type="button" className={cn(BIG, "bg-emerald-600 hover:bg-emerald-700 text-white")} disabled={busy} onClick={() => void openPallet()}>
                      <Plus className="size-4" />
                      Palet
                    </Button>
                  )}
                  {(job.phase === "run" || job.phase === "paused") && (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(BIG, "border-emerald-500/40 text-emerald-700 dark:text-emerald-400")}
                      disabled={busy}
                      onClick={() => void finish()}
                    >
                      <CheckCircle2 className="size-4" />
                      Yakunlash
                    </Button>
                  )}
                  {job.phase !== "queued" && (
                    <Button type="button" variant="ghost" className="h-12 px-3 text-xs gap-1.5 text-muted-foreground" disabled={busy} onClick={() => void openDowntime("record")}>
                      <Wrench className="size-3.5" />
                      To&apos;xtalish qayd
                    </Button>
                  )}
                </div>

                {/* Figures */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border border-border rounded-lg divide-x divide-border bg-card">
                  <Figure
                    label="Bajarildi"
                    value={`${job.goodQty.toLocaleString()} / ${job.plannedQty.toLocaleString()}`}
                    sub={`${unit}${job.plannedQty > 0 ? ` · ${Math.round((job.goodQty / job.plannedQty) * 100)}%` : ""}${
                      job.profile.piecesPerUnit > 1 ? ` · ${Math.round(job.goodQty * job.profile.piecesPerUnit).toLocaleString()} dona` : ""
                    }`}
                  />
                  <Figure
                    label="Brak"
                    value={scrap === null ? "—" : `${(scrap * 100).toFixed(1)}%`}
                    sub={`priladka ${job.makeReadyQty.toLocaleString()} · brak ${job.defectQty.toLocaleString()}`}
                  />
                  <Figure
                    label="Vaqt"
                    value={formatMinutes(job.setupMinutes + job.runMinutes + job.downtimeMinutes)}
                    sub={`reja ${formatMinutes(job.plannedHours * 60)}`}
                  />
                  <Figure
                    label="To'xtalish"
                    value={formatMinutes(job.downtimeMinutes)}
                    sub={`sozlash ${formatMinutes(job.setupMinutes)} · ish ${formatMinutes(job.runMinutes)}`}
                  />
                </div>

                {/* Recent entries */}
                <div className="border border-border rounded-lg bg-card">
                  <div className="h-8 px-3 flex items-center text-[11px] text-muted-foreground border-b border-border">
                    Oxirgi yozuvlar
                  </div>
                  {job.recentEvents.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground">Yozuv yo&apos;q</div>
                  ) : (
                    job.recentEvents.map((ev) => (
                      <div key={ev.id} className="h-8 px-3 flex items-center gap-3 text-xs border-b border-border/60 last:border-0">
                        <span className="font-mono text-muted-foreground w-12">{ev.time}</span>
                        {ev.type === "Run" ? (
                          <>
                            <span className="text-foreground truncate">{ev.batchLabel || "Palet"}</span>
                            <span className="ml-auto font-mono text-emerald-600 dark:text-emerald-400">
                              {ev.qtySource === "estimated" ? "~" : "+"}
                              {(ev.goodQty || 0).toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-amber-700 dark:text-amber-400 truncate">{ev.downtimeReason || "To'xtalish"}</span>
                            <span className="ml-auto font-mono text-muted-foreground">
                              {ev.downtimeDurationMinutes === undefined ? "davom etmoqda" : `${ev.downtimeDurationMinutes} daq.`}
                            </span>
                          </>
                        )}
                        <span className="w-32 truncate text-muted-foreground text-right">{ev.operator}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {job && (
        <PalletReportDialog
          isOpen={isPalletOpen}
          onOpenChange={setIsPalletOpen}
          selectedOp={jobAsStep(job, activeOperator?.fullName)}
          allOperations={[jobAsStep(job)]}
          previousOpGoodOutput={job.previousStep?.goodQty || 0}
          existingOpEvents={job.reports}
          shiftSchedule={schedule}
          unit={unit}
          profile={job.profile}
          onSaveEvent={async (data) => {
            const waste = data.makeReadyQty + data.defectQty;
            const at = new Date();
            const ok = await save(
              {
                id: `e_${at.getTime()}`,
                opId: job.opId,
                type: "Run",
                time: data.time,
                occurredAt: at.toISOString(),
                shift: data.shift,
                batchLabel: data.batchLabel,
                note: data.note,
                operator: data.operator,
                inputQty: data.inputQty,
                qtySource: data.qtySource,
                makeReadyQty: data.makeReadyQty,
                defectQty: data.defectQty,
                goodQty: data.goodQty,
                outputPiecesQty: data.outputPiecesQty,
                wasteQty: waste > 0 ? waste : undefined,
                wasteReason: data.wasteReason,
                palletNumber: job.reports.length + 1,
              },
              "Palet qayd etildi"
            );
            if (ok && data.markStepFinished) await finish(job.goodQty + data.goodQty);
          }}
        />
      )}

      {askDialog.dialog}

      <OperatorIdentifyDialog
        open={identifyLabel !== null}
        machineId={machineId}
        actionLabel={identifyLabel || undefined}
        onIdentified={(op) => identifyResolver.current?.(op)}
        onCancel={() => identifyResolver.current?.(null)}
      />

      {job && downtimeMode && (
        <DowntimeLogDialog
          isOpen={Boolean(downtimeMode)}
          onOpenChange={(open) => !open && setDowntimeMode(null)}
          selectedOp={jobAsStep(job, activeOperator?.fullName)}
          mode={downtimeMode}
          shiftSchedule={schedule}
          onSaveDowntime={async (data) => {
            const at = new Date();
            await save(
              {
                id: `e_dt_${at.getTime()}`,
                opId: job.opId,
                type: "Delay",
                time: data.open ? plantClock(at).time : data.time,
                occurredAt: data.open ? at.toISOString() : undefined,
                shift: data.shift,
                downtimeReason: data.downtimeReason,
                downtimeDurationMinutes: data.open ? undefined : data.durationMinutes,
                note: data.note,
                operator: data.operator,
              },
              data.open ? "Bosqich to'xtatildi" : "To'xtalish qayd etildi"
            );
            setDowntimeMode(null);
          }}
        />
      )}
    </div>
  );
}

function FloorGrid({ floor, loading, onPick }: { floor: FloorMachine[]; loading: boolean; onPick: (id: string) => void }) {
  if (floor.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        {loading ? "Yuklanmoqda" : "Uskuna yo'q"}
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
        {floor.map((m) => {
          const phase: StepPhase = m.active?.openDowntime ? "paused" : m.active?.phase || "queued";
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.id)}
              className="text-left rounded-lg border border-border bg-card hover:bg-muted/40 p-3 min-h-28 flex flex-col gap-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.department}</div>
                </div>
                <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 shrink-0", PHASE_CLASS[phase])}>
                  {m.active ? PHASE_LABEL[phase] : "Bo'sh"}
                </Badge>
              </div>
              {m.active ? (
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-muted-foreground">{m.active.workOrderNo}</span>
                    <span className="font-mono text-foreground">
                      {m.active.goodQty.toLocaleString()} / {m.active.plannedQty.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-foreground truncate">{m.active.productName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {m.active.openDowntime ? m.active.openDowntime.reason : m.active.opName}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Faol ish yo&apos;q</div>
              )}
              <div className="mt-auto text-[11px] text-muted-foreground">
                Navbat {m.queued}
                {m.queued > 0 && ` · tayyor ${m.ready}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-3 py-2.5 min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold font-mono text-foreground leading-tight truncate">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground font-mono truncate">{sub}</div>}
    </div>
  );
}
