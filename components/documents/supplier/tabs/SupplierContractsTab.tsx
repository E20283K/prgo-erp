"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ExternalLink,
  Trash2,
  Edit2,
  ShieldCheck,
} from "lucide-react";
import type { SupplierRecord } from "@/lib/server/supplierService";

export interface SupplierContractItem {
  id: string;
  contractNo: string;
  title: string;
  startDate: string;
  endDate: string;
  paymentTerms: string;
  currency: string;
  status: "Active" | "Expired" | "Draft";
  attachmentName?: string;
  attachmentSize?: string;
}

interface SupplierContractsTabProps {
  supplier: SupplierRecord;
  onChange?: (updated: Partial<SupplierRecord>) => void;
}

export function SupplierContractsTab({ supplier, onChange }: SupplierContractsTabProps) {
  const currentYear = new Date().getFullYear();

  // Initial mock/saved contracts
  const [contracts, setContracts] = useState<SupplierContractItem[]>([
    {
      id: "cont-1",
      contractNo: `SH-${supplier.code || "SUPP"}-${currentYear}/01`,
      title: `${supplier.name} bilan bosh yetkazib berish shartnomasi`,
      startDate: `${currentYear}-01-05`,
      endDate: `${currentYear}-12-31`,
      paymentTerms: supplier.paymentTerms || "Yetkazib berilgandan so'ng 10 kun ichida",
      currency: supplier.currency || "UZS",
      status: "Active",
      attachmentName: `Shartnoma_${supplier.code || "SUPP"}_${currentYear}.pdf`,
      attachmentSize: "1.4 MB",
    },
  ]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Partial<SupplierContractItem> | null>(null);

  const handleOpenAdd = () => {
    setEditingContract({
      contractNo: `SH-${supplier.code || "SUPP"}-${currentYear}/02`,
      title: "Yillik xomashyo va xizmatlar spetsifikatsiyasi",
      startDate: new Date().toISOString().split("T")[0],
      endDate: `${currentYear}-12-31`,
      paymentTerms: supplier.paymentTerms || "100% to'lov yetkazib berilgandan so'ng",
      currency: supplier.currency || "UZS",
      status: "Active",
    });
    setIsAddModalOpen(true);
  };

  const handleSaveContract = () => {
    if (!editingContract?.contractNo || !editingContract?.title) {
      alert("Iltimos, shartnoma raqami va nomini kiriting!");
      return;
    }

    if (editingContract.id) {
      setContracts((prev) =>
        prev.map((c) => (c.id === editingContract.id ? ({ ...c, ...editingContract } as SupplierContractItem) : c))
      );
    } else {
      const created: SupplierContractItem = {
        id: `cont-${Date.now()}`,
        contractNo: editingContract.contractNo!,
        title: editingContract.title!,
        startDate: editingContract.startDate || new Date().toISOString().split("T")[0],
        endDate: editingContract.endDate || `${currentYear}-12-31`,
        paymentTerms: editingContract.paymentTerms || "Oddiy to'lov",
        currency: editingContract.currency || supplier.currency || "UZS",
        status: (editingContract.status as any) || "Active",
        attachmentName: "Ilova_hujjat.pdf",
        attachmentSize: "850 KB",
      };
      setContracts((prev) => [created, ...prev]);
    }

    setIsAddModalOpen(false);
    setEditingContract(null);
  };

  const handleDelete = (id: string) => {
    setContracts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              Shartnomalar va Huquqiy Bitimlar
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Yetkazib beruvchi bilan tuzilgan rasmiy bosh shartnomalar, Didox elektron hujjatlari va ilovalar
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleOpenAdd}
          className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 shadow-none cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Yangi shartnoma qo&apos;shish</span>
        </Button>
      </div>

      {/* 2. Contracts Grid */}
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
                  {c.status === "Active" ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-[10px] py-0"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Amalda
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">
                      Arxiv
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Amal qilish muddati: <strong className="font-mono text-foreground">{c.startDate}</strong> dan{" "}
                    <strong className="font-mono text-foreground">{c.endDate}</strong> gacha
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
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(c.id)}
                  className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground">To&apos;lov shartlari:</span>
                <p className="font-medium text-foreground mt-0.5">{c.paymentTerms}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Valyuta:</span>
                <p className="font-mono font-medium text-foreground mt-0.5">{c.currency}</p>
              </div>
            </div>

            {c.attachmentName && (
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
                  onClick={() => alert("Hujjat yuklab olinmoqda...")}
                >
                  <Download className="w-3 h-3 text-primary" />
                  <span>Yuklab olish</span>
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 3. Add/Edit Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>{editingContract?.id ? "Shartnomani tahrirlash" : "Yangi Shartnoma biriktirish"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Shartnoma raqami *</Label>
              <Input
                value={editingContract?.contractNo || ""}
                onChange={(e) => setEditingContract((prev) => ({ ...prev, contractNo: e.target.value }))}
                placeholder="SH-SUPP-2026/01"
                className="h-8 text-xs font-mono bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Shartnoma sarlavhasi / Nomi *</Label>
              <Input
                value={editingContract?.title || ""}
                onChange={(e) => setEditingContract((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Bosh yetkazib berish shartnomasi"
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Boshlanish sanasi</Label>
                <Input
                  type="date"
                  value={editingContract?.startDate || ""}
                  onChange={(e) => setEditingContract((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Tugash sanasi</Label>
                <Input
                  type="date"
                  value={editingContract?.endDate || ""}
                  onChange={(e) => setEditingContract((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">To&apos;lov shartlari</Label>
              <Input
                value={editingContract?.paymentTerms || ""}
                onChange={(e) => setEditingContract((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                placeholder="Yetkazilgach 10 bank kuni ichida"
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveContract}
              className="h-7 text-xs bg-primary text-primary-foreground"
            >
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
