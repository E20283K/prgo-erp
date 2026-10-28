"use client";

import React, { useState } from "react";
import { PlantRecord, generateNextPlantCode } from "../../plant/types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  ExternalLink,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyBranchesTabProps {
  company: PlantRecord;
  branches: PlantRecord[];
  onRefresh?: () => void;
}

const BRANCH_TYPES = [
  "Bosh Korxona (HQ / Asosiy korpus)",
  "Ishlab chiqarish sexi",
  "Bichuv va tikuv sexi",
  "Yorliq va qadoqlash sexi",
  "Logistika va ombor majmuasi",
  "Savdo va mijozlarga xizmat filiali",
] as const;

export function CompanyBranchesTab({
  company,
  branches,
  onRefresh,
}: CompanyBranchesTabProps) {
  const { openTab, addNotification, plants, fetchPlants } = useWorkspaceStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<PlantRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<string>(BRANCH_TYPES[1]);
  const [formAddress, setFormAddress] = useState("");
  const [formLandmark, setFormLandmark] = useState("");
  const [formDirector, setFormDirector] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formShift, setFormShift] = useState("1×8h Standart (08:00–17:00)");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  const openNewBranchDialog = () => {
    const existingCodes = (plants || []).map((p) => p.code);
    const nextCode = generateNextPlantCode(existingCodes);

    setEditingBranch(null);
    setFormCode(nextCode);
    setFormName("");
    setFormType(BRANCH_TYPES[1]);
    setFormAddress("");
    setFormLandmark("");
    setFormDirector("");
    setFormPhone("");
    setFormShift("1×8h Standart (08:00–17:00)");
    setFormStatus("Active");
    setIsDialogOpen(true);
  };

  const openEditBranchDialog = (branch: PlantRecord) => {
    setEditingBranch(branch);
    setFormCode(branch.code || "");
    setFormName(branch.name || "");
    setFormType(branch.branchType || BRANCH_TYPES[1]);
    setFormAddress(branch.address || "");
    setFormLandmark(branch.landmark || "");
    setFormDirector(branch.director || "");
    setFormPhone(branch.phone || "");
    setFormShift(branch.shiftRegime || "1×8h Standart (08:00–17:00)");
    setFormStatus(branch.status === "Inactive" ? "Inactive" : "Active");
    setIsDialogOpen(true);
  };

  const handleOpenBranchTab = (branch: PlantRecord) => {
    openTab({
      id: `plant-${branch.id}`,
      title: branch.name || branch.code,
      type: "plant-detail",
      module: "settings",
      documentData: branch,
      isUnsaved: false,
    });
  };

  const handleSaveBranch = async () => {
    if (!formName.trim()) {
      addNotification?.({
        title: "Nom kiritilmagan",
        description: "Iltimos, filial nomini kiriting.",
        severity: "warning",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: editingBranch ? editingBranch.id : undefined,
        companyId: company.id,
        companyCode: company.code || "PRINTGOO",
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        branchType: formType,
        address: formAddress.trim() || null,
        landmark: formLandmark.trim() || null,
        director: formDirector.trim() || null,
        phone: formPhone.trim() || null,
        shiftRegime: formShift,
        status: formStatus,
        isActive: formStatus === "Active",
      };

      const res = await fetch("/api/v1/production/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        addNotification?.({
          title: editingBranch ? "Filial yangilandi" : "Yangi filial qo'shildi",
          description: `${formName.trim()} muvaffaqiyatli saqlandi.`,
          severity: "success",
        });
        setIsDialogOpen(false);
        if (fetchPlants) await fetchPlants();
        if (onRefresh) onRefresh();
      } else {
        throw new Error(json.error || "Saqlashda xatolik");
      }
    } catch (err: any) {
      console.error("Save branch error:", err);
      addNotification?.({
        title: "Xatolik",
        description: err.message || "Filialni saqlashda xatolik yuz berdi.",
        severity: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          <span className="font-semibold text-xs text-foreground">
            Filiallar va Ishlab Chiqarish Maydonlari
          </span>
          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono">
            {branches.length}
          </Badge>
        </div>

        <Button
          size="sm"
          onClick={openNewBranchDialog}
          className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-3.5" />
          <span>Yangi Filial</span>
        </Button>
      </div>

      {/* Branches Table */}
      {branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg bg-card/50 text-center space-y-3">
          <Building2 className="size-8 text-muted-foreground/60" />
          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground block">
              Ushbu korxonaga biriktirilgan filiallar yo'q
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Korxona tarkibidagi sex, fabrika yoki sotuv filiallarini ro'yxatga oling.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={openNewBranchDialog}
            className="h-7 text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Birinchi Filialni Qo'shish</span>
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden bg-card">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border text-[11px]">
              <tr>
                <th className="py-2 px-3 font-semibold w-24">Kod</th>
                <th className="py-2 px-3 font-semibold">Filial Nomi</th>
                <th className="py-2 px-3 font-semibold">Filial Turi</th>
                <th className="py-2 px-3 font-semibold">Manzil</th>
                <th className="py-2 px-3 font-semibold">Rahbar & Aloqa</th>
                <th className="py-2 px-3 font-semibold w-20 text-center">Holat</th>
                <th className="py-2 px-3 font-semibold w-28 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {branches.map((branch) => {
                const isActive = branch.status !== "Inactive";
                return (
                  <tr
                    key={branch.id}
                    className="hover:bg-muted/30 transition-colors group h-9"
                  >
                    <td className="py-1.5 px-3 font-mono font-medium text-foreground">
                      {branch.code || "—"}
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {branch.name}
                        </span>
                        {branch.isMain && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 px-1 uppercase tracking-wider"
                          >
                            Asosiy
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-muted-foreground">
                      {branch.branchType || "Sex / Ishlab chiqarish"}
                    </td>
                    <td className="py-1.5 px-3 text-muted-foreground truncate max-w-[200px]">
                      {branch.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{branch.address}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-muted-foreground">
                      {branch.director || branch.phone ? (
                        <div className="space-y-0.5">
                          {branch.director && (
                            <span className="text-[11px] text-foreground block font-medium">
                              {branch.director}
                            </span>
                          )}
                          {branch.phone && (
                            <span className="text-[10px] text-muted-foreground font-mono block">
                              {branch.phone}
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-4.5 px-1.5 font-medium",
                          isActive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30"
                        )}
                      >
                        {isActive ? "Faol" : "Nofaol"}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditBranchDialog(branch)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Tahrirlash"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenBranchTab(branch)}
                          className="h-6 px-2 text-[11px] gap-1"
                          title="Hujjatni ochish"
                        >
                          <span>Ochish</span>
                          <ExternalLink className="size-2.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog for Adding / Editing Branch */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editingBranch ? "Filialni Tahrirlash" : "Yangi Filial Qo'shish"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1">
                <Label className="text-[11px] text-muted-foreground">Kod</Label>
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="h-7 text-xs font-mono uppercase"
                  placeholder="BRN-01"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Filial Nomi *
                </Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-7 text-xs font-medium"
                  placeholder="Masalan: Nigora Tex"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Filial Turi
              </Label>
              <Select
                value={formType}
                onValueChange={(val: string | null) => {
                  if (val) setFormType(val);
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANCH_TYPES.map((bt) => (
                    <SelectItem key={bt} value={bt} className="text-xs">
                      {bt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Manzil</Label>
              <Input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="h-7 text-xs"
                placeholder="Toshkent sh., Chilonzor tumani..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Filial Rahbari
                </Label>
                <Input
                  value={formDirector}
                  onChange={(e) => setFormDirector(e.target.value)}
                  className="h-7 text-xs"
                  placeholder="F.I.Sh."
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Telefon</Label>
                <Input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="h-7 text-xs font-mono"
                  placeholder="+998 90 123 45 67"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Smena Rejimi
                </Label>
                <Select
                  value={formShift}
                  onValueChange={(val: string | null) => {
                    if (val) setFormShift(val);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1×8h Standart (08:00–17:00)">1×8h (08:00–17:00)</SelectItem>
                    <SelectItem value="2×8h Ikki smena (08:00–00:00)">2×8h (08:00–00:00)</SelectItem>
                    <SelectItem value="24/7 (2×12h Shifts)">24/7 (2×12h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Holat</Label>
                <Select
                  value={formStatus}
                  onValueChange={(val: "Active" | "Inactive" | null) => {
                    if (val) setFormStatus(val);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Faol</SelectItem>
                    <SelectItem value="Inactive">Nofaol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleSaveBranch}
              disabled={isSubmitting}
              className="h-7 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CheckCircle2 className="size-3.5" />
              <span>{isSubmitting ? "Saqlanmoqda..." : "Saqlash"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
