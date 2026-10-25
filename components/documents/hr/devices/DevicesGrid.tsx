"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { BiometricDeviceRecord } from "../types";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DeviceDetailModal } from "./DeviceDetailModal";
import {
  Plus,
  Search,
  RefreshCw,
  Printer,
  Activity,
  UploadCloud,
  Edit,
  Trash2,
  DoorOpen,
} from "lucide-react";

interface BranchItem {
  id: string;
  code: string;
  name: string;
}

export function DevicesGrid() {
  const { theme, biometricDevices, setBiometricDevices, removeBiometricDevice, addNotification } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [branchesList, setBranchesList] = useState<BranchItem[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<BiometricDeviceRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Filiallarni yuklash (Faqat bir marta mount bo'lganda)
  useEffect(() => {
    let active = true;
    async function loadBranches() {
      try {
        const res = await fetch("/api/v1/branches");
        const json = await res.json();
        if (active && json.success && Array.isArray(json.data)) {
          setBranchesList(json.data);
        }
      } catch {
        // filiallar xatosi
      }
    }
    loadBranches();
    return () => {
      active = false;
    };
  }, []);

  // Qurilmalarni yuklash (Dependencyda biometricDevices bo'lmasligi kerak - cheksiz loop oldini oladi)
  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/hr/devices");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBiometricDevices(json.data);
      }
    } catch {
      // tarmoq xatosi
    } finally {
      setLoading(false);
    }
  }, [setBiometricDevices]);

  // Faqat mount bo'lganda bir marta chaqirish
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Filtrlash (Qidiruv, Holat, Filial)
  const filtered = useMemo(() => {
    return biometricDevices.filter((d) => {
      const s = searchFilter.toLowerCase();
      const meta = d.metadata || {};
      const matchSearch =
        d.name.toLowerCase().includes(s) ||
        d.deviceCode.toLowerCase().includes(s) ||
        d.ipAddress.toLowerCase().includes(s) ||
        (d.branchName || "").toLowerCase().includes(s) ||
        (meta.isupDeviceId || "").toLowerCase().includes(s) ||
        (d.location || "").toLowerCase().includes(s);

      const matchStatus = statusFilter === "ALL" || d.status === statusFilter;
      const matchBranch = branchFilter === "ALL" || d.branchId === branchFilter;

      return matchSearch && matchStatus && matchBranch;
    });
  }, [biometricDevices, searchFilter, statusFilter, branchFilter]);

  // Glide Data Grid ustunlari
  const columns: GridColumn[] = useMemo(
    () => [
      { id: "status", title: "Holati", width: 95, icon: GridColumnIcon.HeaderLookup },
      { id: "name", title: "Qurilma nomi", width: 220, icon: GridColumnIcon.HeaderString },
      { id: "branchName", title: "Filial / Sex", width: 170, icon: GridColumnIcon.HeaderLookup },
      { id: "connectionMode", title: "Ulanish usuli", width: 120, icon: GridColumnIcon.HeaderLookup },
      { id: "address", title: "Manzil / Terminal ID", width: 170, icon: GridColumnIcon.HeaderString },
      { id: "direction", title: "Yo'nalishi (T-13)", width: 120, icon: GridColumnIcon.HeaderString },
      { id: "enrolledUsersCount", title: "Xodimlar", width: 90, icon: GridColumnIcon.HeaderNumber },
      { id: "location", title: "O'rnatilgan joyi", width: 160, icon: GridColumnIcon.HeaderString },
      { id: "lastSeenAt", title: "Oxirgi aloqa", width: 140, icon: GridColumnIcon.HeaderDate },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const col = columns[colIndex];
      const row = filtered[rowIndex];

      if (!col || !col.id || !row) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      // Holat ustuni
      if (col.id === "status") {
        const isOnline = row.status === "online";
        const isOffline = row.status === "offline";
        const label = isOnline ? "Online" : isOffline ? "Offline" : "Noma'lum";
        const color = isOnline ? "#059669" : isOffline ? "#dc2626" : "#64748b";

        return {
          kind: GridCellKind.Text,
          data: row.status,
          displayData: label,
          allowOverlay: false,
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      // Qurilma nomi
      if (col.id === "name") {
        return {
          kind: GridCellKind.Text,
          data: row.name,
          displayData: row.name,
          allowOverlay: true,
          themeOverride: {
            textDark: isDark ? "#ffffff" : "#0f172a",
            baseFontStyle: "600 11px sans-serif",
          },
        };
      }

      // Filial nomi
      if (col.id === "branchName") {
        const val = row.branchName || "Barcha filiallar";
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: false,
          themeOverride: {
            textDark: "#2563eb",
            baseFontStyle: "500 11px sans-serif",
          },
        };
      }

      // Ulanish usuli
      if (col.id === "connectionMode") {
        const meta = row.metadata || {};
        const isIsup = meta.connectionMode === "isup" || row.port === 7660;
        const val = isIsup ? "ISUP 5.0 (Bulut)" : "Lokal / ISAPI";
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: false,
          themeOverride: {
            textDark: isIsup ? "#0284c7" : "#475569",
            baseFontStyle: "11px sans-serif",
          },
        };
      }

      // Manzil / Terminal ID
      if (col.id === "address") {
        const meta = row.metadata || {};
        const isIsup = meta.connectionMode === "isup" || row.port === 7660;
        const val = isIsup
          ? meta.isupDeviceId || row.deviceCode || "ISUP-ID"
          : `${row.ipAddress}:${row.port}`;

        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: true,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      // Yo'nalish
      if (col.id === "direction") {
        const map: Record<string, string> = {
          in: "Kirish",
          out: "Chiqish",
          both: "Ikki tomonlama",
        };
        const text = map[row.direction] || row.direction;
        return { kind: GridCellKind.Text, data: row.direction, displayData: text, allowOverlay: false };
      }

      // Xodimlar / Yuzlar soni
      if (col.id === "enrolledUsersCount") {
        const count = row.metadata?.enrolledUsersCount ?? 0;
        return {
          kind: GridCellKind.Text,
          data: String(count),
          displayData: count > 0 ? `${count} nafar` : "—",
          allowOverlay: false,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      // Oxirgi aloqa
      if (col.id === "lastSeenAt") {
        if (!row.lastSeenAt) {
          return { kind: GridCellKind.Text, data: "", displayData: "—", allowOverlay: false };
        }
        const d = new Date(row.lastSeenAt);
        const timeStr = `${d.toLocaleDateString("uz-UZ")} ${d.toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
        return { kind: GridCellKind.Text, data: row.lastSeenAt, displayData: timeStr, allowOverlay: false };
      }

      const val = (row as any)[col.id] ?? "";
      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: true,
      };
    },
    [columns, filtered, isDark]
  );

  // Aloqani tekshirish
  const handleTestConnection = async (device: BiometricDeviceRecord) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/hr/devices/${device.id}/test`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Ulanish muvaffaqiyatli",
          description: `${device.name} bilan aloqa o'rnatildi (Online).`,
          severity: "success",
        });
      } else {
        addNotification({
          title: "Aloqa yo'q",
          description: `${device.name}: ${json.message}`,
          severity: "error",
        });
      }
      fetchDevices();
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "Tekshirishda xatolik yuz berdi",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Turniket relayini sinash (Eshikni ochish)
  const handleTriggerRelay = async (device: BiometricDeviceRecord) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/hr/devices/${device.id}/open-relay`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Turniket ochildi",
          description: `${device.name} relay signali muvaffaqiyatli uzatildi.`,
          severity: "success",
        });
      } else {
        addNotification({
          title: "Buyruq yetib bormadi",
          description: `${device.name}: ${json.message}`,
          severity: "error",
        });
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "Turniketga buyruq yuborishda xatolik",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filial xodimlarini sinxronlash
  const handleSyncEmployees = async (device: BiometricDeviceRecord) => {
    const branchText = device.branchName || "korxona";
    if (!confirm(`${device.name} qurilmasiga ${branchText} xodimlarini yuklashni tasdiqlaysizmi?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/hr/devices/${device.id}/sync`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Sinxronlash yakunlandi",
          description: `Jami ${json.totalSynced} nafar xodim ${device.name} ga muvaffaqiyatli yuborildi.`,
          severity: "success",
        });
      } else {
        addNotification({
          title: "Qisman yuklandi",
          description: `${json.totalSynced} ta xodim yuklandi. Xatolar: ${json.errors?.slice(0, 2)?.join("; ")}`,
          severity: "warning",
        });
      }
      fetchDevices();
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "Xodimlarni yuklashda xatolik yuz berdi.",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Qurilmani o'chirish
  const handleDeleteDevice = async (device: BiometricDeviceRecord) => {
    if (!confirm(`${device.name} qurilmasini ro'yxatdan o'chirishni tasdiqlaysizmi?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/hr/devices/${device.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        removeBiometricDevice(device.id);
        addNotification({
          title: "Qurilma o'chirildi",
          description: `${device.name} tizimdan olib tashlandi.`,
          severity: "success",
        });
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "O'chirishda xatolik",
        severity: "error",
      });
    }
  };

  // Hozir tanlangan qurilma
  const currentSelectedDevice = useMemo(() => {
    const selectedRows = selection.rows.toArray();
    if (selectedRows.length > 0 && filtered[selectedRows[0]]) {
      return filtered[selectedRows[0]];
    }
    return filtered[0] || null;
  }, [selection, filtered]);

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* ── 1C Industrial Toolbar & Filters ── */}
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0 gap-2">
        {/* Chap panel: Yangi qurilma, Tezkor amallar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
            onClick={() => {
              setEditingDevice(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yangi qurilma</span>
          </Button>

          {currentSelectedDevice && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                disabled={actionLoading}
                onClick={() => handleSyncEmployees(currentSelectedDevice)}
                title="Tanlangan qurilmaga filial xodimlarini sinxronlash"
              >
                <UploadCloud className="size-3.5 text-blue-600" />
                <span>Sinxronlash</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                disabled={actionLoading}
                onClick={() => handleTriggerRelay(currentSelectedDevice)}
                title="Turniket relayini 3 soniyaga ochish"
              >
                <DoorOpen className="size-3.5 text-emerald-600" />
                <span>Eshikni ochish</span>
              </Button>
            </>
          )}

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Filial bo'yicha filtr */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">Filial:</span>
            <Select
              value={branchFilter}
              onValueChange={(val: string | null) => setBranchFilter(val || "ALL")}
            >
              <SelectTrigger className="h-7 w-36 text-xs bg-background">
                <SelectValue placeholder="Barcha filiallar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Barcha filiallar</SelectItem>
                {branchesList.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Status Segment Filter */}
          <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
            {[
              { key: "ALL", label: "Hammasi" },
              { key: "online", label: "Online" },
              { key: "offline", label: "Offline" },
              { key: "unknown", label: "Noma'lum" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  statusFilter === key
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* O'ng panel: Qidiruv, Yangilash, Hisob */}
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Qurilma, filial, IP..."
              className="pl-7 h-7 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={fetchDevices}
            disabled={loading || actionLoading}
            title="Ro'yxatni yangilash"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Yangilash</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => window.print()}
            title="Chop etish"
          >
            <Printer className="size-3.5" />
          </Button>

          <Badge variant="outline" className="font-mono text-[11px] h-6 px-1.5 font-normal">
            {filtered.length} ta qurilma
          </Badge>
        </div>
      </div>

      {/* ── Glide Data Grid (Canvas) ── */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 w-full h-full relative overflow-hidden">
          <div className="absolute inset-0">
            <DataEditor
              width="100%"
              height="100%"
              columns={columns}
              rows={filtered.length}
              getCellContent={getCellContent}
              rowMarkers="both"
              freezeColumns={2}
              headerHeight={28}
              rowHeight={30}
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onCellActivated={(cell) => {
                const [, row] = cell;
                const d = filtered[row];
                if (d) {
                  setEditingDevice(d);
                  setIsModalOpen(true);
                }
              }}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              smoothScrollX
              smoothScrollY
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-60 text-xs">
          <ContextMenuItem
            onClick={() => {
              const selectedRow = selection.rows.toArray()[0] ?? 0;
              const d = filtered[selectedRow];
              if (d) handleTestConnection(d);
            }}
          >
            <Activity className="size-3.5 mr-2 text-blue-600" />
            Ulanishni tekshirish (Ping)
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => {
              const selectedRow = selection.rows.toArray()[0] ?? 0;
              const d = filtered[selectedRow];
              if (d) handleSyncEmployees(d);
            }}
          >
            <UploadCloud className="size-3.5 mr-2 text-blue-600" />
            Filial xodimlarini yuklash
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => {
              const selectedRow = selection.rows.toArray()[0] ?? 0;
              const d = filtered[selectedRow];
              if (d) handleTriggerRelay(d);
            }}
          >
            <DoorOpen className="size-3.5 mr-2 text-emerald-600" />
            Turniket relayini ochish
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => {
              const selectedRow = selection.rows.toArray()[0] ?? 0;
              const d = filtered[selectedRow];
              if (d) {
                setEditingDevice(d);
                setIsModalOpen(true);
              }
            }}
          >
            <Edit className="size-3.5 mr-2" />
            Tahrirlash
          </ContextMenuItem>

          <ContextMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() => {
              const selectedRow = selection.rows.toArray()[0] ?? 0;
              const d = filtered[selectedRow];
              if (d) handleDeleteDevice(d);
            }}
          >
            <Trash2 className="size-3.5 mr-2" />
            O'chirish
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Detail / Add Modal */}
      <DeviceDetailModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        device={editingDevice}
        onSaved={fetchDevices}
      />
    </div>
  );
}
