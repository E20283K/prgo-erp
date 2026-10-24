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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DeviceDetailModal } from "./DeviceDetailModal";
import {
  Server,
  Plus,
  Search,
  RefreshCw,
  Printer,
  Activity,
  UploadCloud,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";

export function DevicesGrid() {
  const { theme, biometricDevices, setBiometricDevices, removeBiometricDevice, addNotification } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<BiometricDeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<BiometricDeviceRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/hr/devices");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setData(json.data);
        setBiometricDevices(json.data);
      } else {
        setData(biometricDevices);
      }
    } catch {
      setData(biometricDevices);
    } finally {
      setLoading(false);
    }
  }, [biometricDevices, setBiometricDevices]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Keep local data in sync with store
  useEffect(() => {
    if (biometricDevices && biometricDevices.length > 0) {
      setData((prev) => {
        const map = new Map<string, BiometricDeviceRecord>();
        prev.forEach((d) => map.set(d.id, d));
        biometricDevices.forEach((d) => map.set(d.id, d));
        return Array.from(map.values());
      });
    }
  }, [biometricDevices]);

  // Filtered rows
  const filtered = useMemo(() => {
    return data.filter((d) => {
      const s = searchFilter.toLowerCase();
      const matchSearch =
        d.name.toLowerCase().includes(s) ||
        d.deviceCode.toLowerCase().includes(s) ||
        d.ipAddress.toLowerCase().includes(s) ||
        (d.location || "").toLowerCase().includes(s);

      const matchStatus = statusFilter === "ALL" || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, searchFilter, statusFilter]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "status", title: "Holati", width: 95, icon: GridColumnIcon.HeaderLookup },
      { id: "deviceCode", title: "Qurilma kodi", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "name", title: "Nomi", width: 220, icon: GridColumnIcon.HeaderString },
      { id: "ipAddress", title: "IP Manzili", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "port", title: "Port", width: 75, icon: GridColumnIcon.HeaderNumber },
      { id: "direction", title: "Yo'nalishi", width: 120, icon: GridColumnIcon.HeaderString },
      { id: "location", title: "Joylashuvi", width: 170, icon: GridColumnIcon.HeaderString },
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

      if (col.id === "deviceCode") {
        return {
          kind: GridCellKind.Text,
          data: row.deviceCode,
          displayData: row.deviceCode,
          allowOverlay: true,
          themeOverride: {
            textDark: "#2563eb",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "ipAddress") {
        return {
          kind: GridCellKind.Text,
          data: row.ipAddress,
          displayData: row.ipAddress,
          allowOverlay: true,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      if (col.id === "direction") {
        const map: Record<string, string> = {
          in: "Kirish",
          out: "Chiqish",
          both: "Ikki tomonlama",
        };
        const text = map[row.direction] || row.direction;
        return { kind: GridCellKind.Text, data: row.direction, displayData: text, allowOverlay: false };
      }

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
    [columns, filtered]
  );

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
        fetchDevices();
      } else {
        addNotification({
          title: "Aloqa yo'q",
          description: `${device.name}: ${json.message}`,
          severity: "error",
        });
        fetchDevices();
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "Tekshirishda xatolik",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncAllEmployees = async (device: BiometricDeviceRecord) => {
    if (!confirm(`${device.name} qurilmasiga barcha faol xodimlarni yuklashni tasdiqlaysizmi?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/hr/devices/${device.id}/sync-all`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Xodimlar yuklandi",
          description: `Jami ${json.totalSynced} ta xodim ${device.name} ga muvaffaqiyatli yuborildi.`,
          severity: "success",
        });
      } else {
        addNotification({
          title: "Qisman xatolik",
          description: `${json.totalSynced} ta xodim yuklandi. Ba'zilarida xatolik yuz berdi.`,
          severity: "warning",
        });
      }
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

  const handleDeleteDevice = async (device: BiometricDeviceRecord) => {
    if (!confirm(`${device.name} qurilmasini ro'yxatdan o'chirishni tasdiqlaysizmi?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/hr/devices/${device.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        removeBiometricDevice(device.id);
        setData((prev) => prev.filter((d) => d.id !== device.id));
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

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* ── 1C Enterprise Industrial Toolbar ── */}
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        {/* Left Actions */}
        <div className="flex items-center gap-1.5">
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

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Status Segment Filter Pills */}
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

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Qurilma nomi yoki IP..."
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
            <span className="hidden sm:inline">Chop etish</span>
          </Button>

          <Badge variant="outline" className="font-mono text-[11px] h-6 px-1.5 font-normal">
            {filtered.length} ta qurilma
          </Badge>
        </div>
      </div>

      {/* ── High-Performance Canvas Data Grid ── */}
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
              if (d) handleSyncAllEmployees(d);
            }}
          >
            <UploadCloud className="size-3.5 mr-2 text-emerald-600" />
            Barcha xodimlarni yuklash (ISAPI)
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
