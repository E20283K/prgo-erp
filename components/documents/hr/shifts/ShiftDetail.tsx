"use client";

import React, { useState, useMemo } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { ShiftRecord } from "../types";
import {
  DocumentHeader,
  DocumentSidebar,
  DocumentNavItem,
  SidebarSummaryCard,
  InfoRow,
} from "../../common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Users, Save, Printer, CheckCircle2 } from "lucide-react";

interface ShiftDetailProps {
  tab: DocumentTab;
}

export function ShiftDetail({ tab }: ShiftDetailProps) {
  const { shiftsList, upsertShift, employees, openTab, setTabUnsaved, updateTabData, closeTab, addNotification } =
    useWorkspaceStore();

  const shiftId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("shift-")) return tab.id.replace("shift-", "");
    return tab.id;
  }, [tab]);

  const initialShift: ShiftRecord = useMemo(() => {
    if (tab.documentData && tab.documentData.name) {
      return tab.documentData;
    }
    const found = shiftsList.find((s) => s.id === shiftId || s.code === shiftId);
    return (
      found || {
        id: shiftId,
        code: "SHIFT-NEW",
        name: tab.title || "Yangi smena",
        startTime: "08:00",
        endTime: "20:00",
        durationHours: 12,
        shiftType: "day",
        activeWorkers: 0,
        isActive: true,
      }
    );
  }, [tab.documentData, shiftsList, shiftId]);

  const [formData, setFormData] = useState<ShiftRecord>(initialShift);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isSaved, setIsSaved] = useState(false);

  // Filter employees working in this shift
  const shiftEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        (e.currentShift || "").toLowerCase().includes((formData.name || "").toLowerCase()) ||
        (e.currentShift || "").toLowerCase().includes(formData.code.toLowerCase())
    );
  }, [employees, formData]);

  const handleUpdate = (updated: Partial<ShiftRecord>) => {
    setFormData((prev) => ({ ...prev, ...updated }));
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    try {
      if (formData.id && formData.id.length > 20) {
        await fetch("/api/v1/hr/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }
    } catch {}

    upsertShift(formData);
    updateTabData(tab.id, formData);
    setTabUnsaved(tab.id, false);
    setIsSaved(true);
    addNotification({
      title: "Smena ma'lumotlari saqlandi",
      description: `${formData.name} yangilandi.`,
      severity: "success",
    });
    setTimeout(() => setIsSaved(false), 2500);
  };

  const navItems: DocumentNavItem[] = [
    { id: "overview", label: "Smena grafigi", icon: Clock },
    {
      id: "staff",
      label: "Smenadagi xodimlar",
      icon: Users,
      badge: String(shiftEmployees.length),
    },
  ];

  return (
    <div className="flex h-full flex-col bg-background text-foreground text-xs select-none">
      <DocumentHeader
        icon={Clock}
        title={formData.name}
        docNo={formData.code}
        status={formData.isActive ? "active" : "terminated"}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Chop etish
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleSave}>
              <Save className="size-3.5" />
              {isSaved ? "Saqlandi" : "Saqlash"}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-primary text-primary-foreground gap-1"
              onClick={() => {
                handleSave();
                closeTab(tab.id);
              }}
            >
              <CheckCircle2 className="size-3.5" />
              O'tkazish va yopish
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <DocumentSidebar
          summary={
            <SidebarSummaryCard icon={Clock} title={formData.name} subtitle={formData.code}>
              <InfoRow label="Oraliq">
                {formData.startTime} — {formData.endTime}
              </InfoRow>
              <InfoRow label="Davomiylik">{formData.durationHours} soat</InfoRow>
              <InfoRow label="Rejim">{formData.shiftType}</InfoRow>
              <InfoRow label="Faol ishchilar">
                <span className="font-mono font-medium">{shiftEmployees.length} xodim</span>
              </InfoRow>
            </SidebarSummaryCard>
          }
          sectionsLabel="Smena bo'limlari"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
        />

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-4 max-w-3xl">
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    Smena Ish Grafigi Sozlamalari
                  </CardTitle>
                  <CardDescription className="text-xs">
                    T-13 tabel hisobi va biometrik turniket kechikishlarini hisoblash bazasi
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Smena kodi *</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => handleUpdate({ code: e.target.value })}
                      className="h-8 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Smena nomi *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleUpdate({ name: e.target.value })}
                      className="h-8 font-medium"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Boshlanish vaqti (Turniket check-in)</Label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleUpdate({ startTime: e.target.value })}
                      className="h-8 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Tugash vaqti (Turniket check-out)</Label>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleUpdate({ endTime: e.target.value })}
                      className="h-8 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Davomiyligi (Soat)</Label>
                    <Input
                      type="number"
                      value={formData.durationHours}
                      onChange={(e) => handleUpdate({ durationHours: Number(e.target.value) || 12 })}
                      className="h-8 font-mono"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "staff" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    Ushbu smenaga biriktirilgan xodimlar ({shiftEmployees.length} ta)
                  </h3>
                </div>
              </div>

              <div className="rounded border bg-card overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-medium h-7 text-[11px]">
                      <th className="px-3 py-1">Tabel №</th>
                      <th className="px-3 py-1">Xodim F.I.O.</th>
                      <th className="px-3 py-1">Sex</th>
                      <th className="px-3 py-1">Lavozim</th>
                      <th className="px-3 py-1">Telefon</th>
                      <th className="px-3 py-1">Holati</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          Ushbu smenaga hozircha xodimlar biriktirilmagan.
                        </td>
                      </tr>
                    ) : (
                      shiftEmployees.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b hover:bg-muted/30 h-7 cursor-pointer"
                          onClick={() =>
                            openTab({
                              id: `emp-${e.id}`,
                              title: `${e.fullName} (${e.badgeNumber || e.badgeNo})`,
                              type: "employee-detail",
                              module: "hr",
                              documentData: e,
                            })
                          }
                        >
                          <td className="px-3 py-1 font-mono font-semibold text-primary">
                            {e.badgeNumber || e.badgeNo}
                          </td>
                          <td className="px-3 py-1 font-medium">{e.fullName}</td>
                          <td className="px-3 py-1 text-muted-foreground">{e.departmentName || e.department}</td>
                          <td className="px-3 py-1">{e.positionTitle || e.position}</td>
                          <td className="px-3 py-1 font-mono">{e.phone}</td>
                          <td className="px-3 py-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4.5 px-1.5 ${
                                e.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-300"
                              }`}
                            >
                              {e.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
