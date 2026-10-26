"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Calendar,
  FileCheck,
  Download,
  Paperclip,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  UploadCloud,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { SupplierRecord, SupplierContractRecord } from "@/lib/server/supplierService";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface SupplierContractsTabProps {
  supplier: SupplierRecord;
  onChange?: (updated: Partial<SupplierRecord>) => void;
}

export function SupplierContractsTab({ supplier }: SupplierContractsTabProps) {
  const currentYear = new Date().getFullYear();
  const { addNotification } = useWorkspaceStore();
  const isDraft = !supplier.id || supplier.id.startsWith("draft-") || supplier.id.startsWith("new-");

  const [contracts, setContracts] = useState<SupplierContractRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Partial<SupplierContractRecord> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchContracts = useCallback(async () => {
    if (isDraft) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/contracts`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setContracts(json.data);
        }
      }
    } catch (e) {
      console.error("Failed to load supplier contracts:", e);
    } finally {
      setLoading(false);
    }
  }, [supplier.id, isDraft]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleOpenAdd = () => {
    setEditingContract({
      contractNo: `SH-${supplier.code || "SUPP"}-${currentYear}/${String(contracts.length + 1).padStart(2, "0")}`,
      title: `${supplier.name} bilan ta'minot shartnomasi`,
      type: "annual",
      startDate: new Date().toISOString().split("T")[0],
      endDate: `${currentYear}-12-31`,
      paymentTerms: supplier.paymentTerms || "100% to'lov yetkazib berilgandan so'ng",
      currency: supplier.currency || "UZS",
      status: "active",
      notes: "",
    });
    setIsAddModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isDraft) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/contracts/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json();
      if (json.success && json.data) {
        setEditingContract((prev) => ({
          ...prev,
          attachmentName: json.data.name,
          attachmentUrl: json.data.url,
          attachmentSize: json.data.size,
        }));
        addNotification({
          title: "Hujjat yuklandi",
          description: `${file.name} muvaffaqiyatli serverga yuklandi.`,
          severity: "success",
        });
      } else {
        alert(json.error || "Faylni yuklashda xatolik yuz berdi");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fayl yuklashda xatolik");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveContract = async () => {
    if (!editingContract?.contractNo?.trim() || !editingContract?.title?.trim()) {
      alert("Iltimos, shartnoma raqami va nomini kiriting!");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(
        `/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/contracts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingContract),
        }
      );

      const json = await res.json();
      if (json.success) {
        setIsAddModalOpen(false);
        setEditingContract(null);
        await fetchContracts();
        addNotification({
          title: "Shartnoma saqlandi",
          description: `${editingContract.contractNo} muvaffaqiyatli saqlandi.`,
          severity: "success",
        });
      } else {
        alert(json.error || "Shartnomani saqlashda xatolik yuz berdi");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Shartnomani saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contractId: string) => {
    if (!confirm("Haqiqatan ham ushbu shartnomani o'chirmoqchimisiz?")) return;

    try {
      const res = await fetch(
        `/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/contracts?contractId=${encodeURIComponent(contractId)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        await fetchContracts();
        addNotification({
          title: "Shartnoma o'chirildi",
          description: "Shartnoma bazadan muvaffaqiyatli olib tashlandi.",
          severity: "info",
        });
      } else {
        alert(json.error || "O'chirishda xatolik");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "O'chirishda xatolik");
    }
  };

  const handleDownload = (contract: SupplierContractRecord) => {
    if (!contract.attachmentUrl) {
      alert("Biriktirilgan fayl mavjud emas.");
      return;
    }
    const link = document.createElement("a");
    link.href = contract.attachmentUrl;
    link.download = contract.attachmentName || "Shartnoma.pdf";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isDraft) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card m-4 rounded border border-border">
        <AlertCircle className="w-10 h-10 text-muted-foreground/60 mb-2" />
        <h3 className="text-sm font-semibold text-foreground">Ta&apos;minotchi hali saqlanmagan</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          Huquqiy shartnomalar va elektron fayllarni biriktirish uchun avval ta&apos;minotchi rekvizitlarini saqlang.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="font-semibold text-xs text-foreground">
            Shartnomalar va Huquqiy Bitimlar
          </span>
          <Badge variant="outline" className="font-mono text-[10px] ml-1">
            {contracts.length} ta
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchContracts}
            disabled={loading}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
            title="Yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Yangilash</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 shadow-none cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yangi shartnoma</span>
          </Button>
        </div>
      </div>

      {/* 2. Contracts Grid */}
      {loading && contracts.length === 0 ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Shartnomalar yuklanmoqda...</span>
        </div>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-md text-center bg-card/40">
          <FileCheck className="w-8 h-8 text-muted-foreground/40 mb-2" />
          <p className="text-xs font-medium text-foreground">Hozircha shartnomalar mavjud emas</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
            Ushbu ta&apos;minotchi bilan rasmiy yetkazib berish shartnomasini qo&apos;shing.
          </p>
          <Button size="sm" variant="outline" onClick={handleOpenAdd} className="h-7 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>Shartnoma qo&apos;shish</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="bg-card border border-border rounded-md p-3.5 space-y-3 hover:border-primary/40 transition-colors shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-foreground truncate">{c.title}</span>
                    <Badge variant="outline" className="font-mono text-[10px] bg-muted py-0">
                      {c.contractNo}
                    </Badge>
                    {c.status === "active" ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-[10px] py-0"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Amalda
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        Arxiv
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Amal qilish muddati: <strong className="font-mono text-foreground">{c.startDate}</strong> dan{" "}
                      <strong className="font-mono text-foreground">{c.endDate || "Muddatsiz"}</strong> gacha
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingContract(c);
                      setIsAddModalOpen(true);
                    }}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Tahrirlash"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(c.id)}
                    className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 cursor-pointer"
                    title="O'chirish"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">To&apos;lov shartlari:</span>
                  <p className="font-medium text-foreground mt-0.5">{c.paymentTerms || "Belgilanmagan"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Valyuta:</span>
                  <p className="font-mono font-medium text-foreground mt-0.5">{c.currency}</p>
                </div>
              </div>

              {c.attachmentName ? (
                <div className="flex items-center justify-between p-2 rounded bg-muted/40 border border-border/60 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate text-[11px]">{c.attachmentName}</span>
                    {c.attachmentSize && (
                      <span className="text-[10px] text-muted-foreground font-mono">({c.attachmentSize})</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px] gap-1 cursor-pointer"
                    onClick={() => handleDownload(c)}
                  >
                    <Download className="w-3 h-3 text-primary" />
                    <span>Yuklab olish</span>
                  </Button>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground/70 italic flex items-center gap-1.5 pt-1">
                  <Paperclip className="w-3 h-3" />
                  <span>Fayl ilova qilinmagan</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Add/Edit Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>{editingContract?.id ? "Shartnomani tahrirlash" : "Yangi Shartnoma biriktirish"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Shartnoma raqami *</Label>
              <Input
                value={editingContract?.contractNo || ""}
                onChange={(e) => setEditingContract((prev) => ({ ...prev, contractNo: e.target.value }))}
                placeholder="SH-SUPP-2026/01"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Shartnoma mavzusi / Nomi *</Label>
              <Input
                value={editingContract?.title || ""}
                onChange={(e) => setEditingContract((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Yillik xomashyo yetkazib berish shartnomasi"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Boshlanish sanasi</Label>
                <Input
                  type="date"
                  value={editingContract?.startDate || ""}
                  onChange={(e) => setEditingContract((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Tugash sanasi</Label>
                <Input
                  type="date"
                  value={editingContract?.endDate || ""}
                  onChange={(e) => setEditingContract((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Holati</Label>
                <Select
                  value={editingContract?.status || "active"}
                  onValueChange={(val: any) => setEditingContract((prev) => ({ ...prev, status: val }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-xs">Amalda (Faol)</SelectItem>
                    <SelectItem value="expired" className="text-xs">Muddati tugagan</SelectItem>
                    <SelectItem value="suspended" className="text-xs">To&apos;xtatilgan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Valyuta</Label>
                <Select
                  value={editingContract?.currency || supplier.currency || "UZS"}
                  onValueChange={(val: string | null) => val && setEditingContract((prev) => ({ ...prev, currency: val }))}
                >
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS" className="text-xs font-mono">UZS (So&apos;m)</SelectItem>
                    <SelectItem value="USD" className="text-xs font-mono">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">To&apos;lov shartlari</Label>
              <Input
                value={editingContract?.paymentTerms || ""}
                onChange={(e) => setEditingContract((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                placeholder="Yetkazib berilgandan so'ng 10 bank kuni ichida"
                className="h-8 text-xs"
              />
            </div>

            {/* File attachment upload */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-[11px] text-muted-foreground font-medium">Shartnoma fayli (PDF / Scan)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-8 text-xs gap-1.5 cursor-pointer flex-1 justify-center"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5 text-primary" />
                  )}
                  <span>{uploading ? "Fayl yuklanmoqda..." : "Fayl tanlash (PDF/Scan)"}</span>
                </Button>
              </div>

              {editingContract?.attachmentName && (
                <div className="flex items-center justify-between p-2 rounded bg-muted text-[11px] border border-border mt-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{editingContract.attachmentName}</span>
                    {editingContract.attachmentSize && (
                      <span className="text-[10px] text-muted-foreground">({editingContract.attachmentSize})</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditingContract((prev) => ({
                        ...prev,
                        attachmentName: undefined,
                        attachmentUrl: undefined,
                        attachmentSize: undefined,
                      }))
                    }
                    className="h-6 w-6 p-0 text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveContract}
              disabled={saving}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
