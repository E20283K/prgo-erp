"use client";

import React, { useState } from "react";
import {
  Building2,
  UserCheck,
  FileText,
  CreditCard,
  Phone,
  Mail,
  Scale,
  FilePlus2,
  AlertTriangle,
  MapPin,
  Landmark,
  ShieldAlert,
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Star,
  Send,
  Truck,
  Clock,
  ShieldCheck,
  ClipboardCheck,
  Check,
  Copy,
  ExternalLink,
  FileSignature,
  ScrollText,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CrmCustomerRecord,
  ClientSettlementRecord,
  CustomerContactPerson,
  CustomerContractRecord,
} from "@/store/workspaceStore";

interface CustomerOverviewTabProps {
  form: CrmCustomerRecord;
  onChange: (field: keyof CrmCustomerRecord, val: any) => void;
  settlement: ClientSettlementRecord | null;
  onNavigateTab: (tabId: string) => void;
  onOpenPaymentModal: () => void;
  onCreateClientOrder: () => void;
}

const CONTRACT_TYPE_CONFIG: Record<
  CustomerContractRecord["type"],
  { label: string; badgeClass: string }
> = {
  annual: {
    label: "Yillik bosh shartnoma",
    badgeClass: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  },
  frame: {
    label: "Ramkali shartnoma",
    badgeClass: "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800",
  },
  order_spec: {
    label: "Buyurtma spetsifikatsiyasi",
    badgeClass: "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  tender: {
    label: "Tender bitimi",
    badgeClass: "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  },
};

const CONTRACT_STATUS_CONFIG: Record<
  CustomerContractRecord["status"],
  { label: string; dotClass: string; badgeClass: string }
> = {
  active: {
    label: "Faol",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  expired: {
    label: "Arxiv / Tugagan",
    dotClass: "bg-slate-400",
    badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  },
  terminated: {
    label: "Bekor qilingan",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800",
  },
};

const ROLE_CONFIG: Record<
  CustomerContactPerson["role"],
  { label: string; icon: string; badgeClass: string }
> = {
  director: {
    label: "Bosh direktor",
    icon: "👑",
    badgeClass: "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  },
  accountant: {
    label: "Bosh buxgalter",
    icon: "💼",
    badgeClass: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  },
  procurement: {
    label: "Ta'minot / Buyurtmachi",
    icon: "📦",
    badgeClass: "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  warehouse: {
    label: "Ombor mudiri",
    icon: "🏭",
    badgeClass: "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800",
  },
  manager: {
    label: "Loyiha menejeri",
    icon: "👤",
    badgeClass: "bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800",
  },
  other: {
    label: "Boshqa mas'ul",
    icon: "🔹",
    badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700",
  },
};

export function CustomerOverviewTab({
  form,
  onChange,
  settlement,
  onNavigateTab,
  onOpenPaymentModal,
  onCreateClientOrder,
}: CustomerOverviewTabProps) {
  const closingBalance = settlement?.closingBalance ?? 0;
  const creditLimit = form.creditLimitUsd || 10000;
  const isOverCreditLimit = closingBalance > creditLimit;

  // Contact management state
  const contacts: CustomerContactPerson[] = form.contacts || [];
  const [editingContact, setEditingContact] = useState<CustomerContactPerson | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Contracts registry state
  const contracts: CustomerContractRecord[] = form.contracts || [];
  const [editingContract, setEditingContract] = useState<CustomerContractRecord | null>(null);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);

  const handleOpenAddContact = () => {
    setEditingContact({
      id: `CONT-${Date.now()}`,
      role: "procurement",
      roleLabel: "Ta'minot / Buyurtmachi",
      name: "",
      phone: "",
      email: "",
      telegram: "",
      isPrimary: false,
      notes: "",
    });
    setIsContactDialogOpen(true);
  };

  const handleOpenEditContact = (c: CustomerContactPerson) => {
    setEditingContact({ ...c });
    setIsContactDialogOpen(true);
  };

  const handleSaveContact = () => {
    if (!editingContact || !editingContact.name.trim()) return;

    let updatedList: CustomerContactPerson[];
    const exists = contacts.some((c) => c.id === editingContact.id);

    if (exists) {
      updatedList = contacts.map((c) => (c.id === editingContact.id ? editingContact : c));
    } else {
      updatedList = [...contacts, editingContact];
    }

    if (editingContact.isPrimary) {
      updatedList = updatedList.map((c) => ({
        ...c,
        isPrimary: c.id === editingContact.id,
      }));
      onChange("contactPerson", editingContact.name);
      onChange("phone", editingContact.phone);
      if (editingContact.email) onChange("email", editingContact.email);
    }

    onChange("contacts", updatedList);
    setIsContactDialogOpen(false);
    setEditingContact(null);
  };

  const handleDeleteContact = (id: string) => {
    const updatedList = contacts.filter((c) => c.id !== id);
    onChange("contacts", updatedList);
  };

  const handleSetPrimaryContact = (target: CustomerContactPerson) => {
    const updatedList = contacts.map((c) => ({
      ...c,
      isPrimary: c.id === target.id,
    }));
    onChange("contacts", updatedList);
    onChange("contactPerson", target.name);
    onChange("phone", target.phone);
    if (target.email) onChange("email", target.email);
  };

  // Contracts handlers
  const handleOpenAddContract = () => {
    const currentYear = new Date().getFullYear();
    const custNum = form.id?.replace("CUST-", "") || "101";
    setEditingContract({
      id: `CNT-${Date.now()}`,
      contractNo: `CON-${currentYear}-${custNum}`,
      title: `${currentYear}-yilgi bosh yetkazib berish shartnomasi`,
      type: "annual",
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      status: "active",
      isDefault: contracts.length === 0,
      paymentTerms: form.paymentTerms || "50% Advance / 50% Net 15",
      notes: "Didox va Soliq orqali tasdiqlangan elektron bosh shartnoma.",
    });
    setIsContractDialogOpen(true);
  };

  const handleOpenEditContract = (c: CustomerContractRecord) => {
    setEditingContract({ ...c });
    setIsContractDialogOpen(true);
  };

  const handleSaveContract = () => {
    if (!editingContract || !editingContract.contractNo.trim()) return;

    let updatedList: CustomerContractRecord[];
    const exists = contracts.some((c) => c.id === editingContract.id);

    if (exists) {
      updatedList = contracts.map((c) => (c.id === editingContract.id ? editingContract : c));
    } else {
      updatedList = [editingContract, ...contracts];
    }

    if (editingContract.isDefault) {
      updatedList = updatedList.map((c) => ({
        ...c,
        isDefault: c.id === editingContract.id,
      }));
      onChange("contractNo", editingContract.contractNo);
      onChange("contractDate", editingContract.startDate);
      onChange("contractExpiry", editingContract.endDate);
      if (editingContract.paymentTerms) {
        onChange("paymentTerms", editingContract.paymentTerms);
      }
    }

    onChange("contracts", updatedList);
    setIsContractDialogOpen(false);
    setEditingContract(null);
  };

  const handleDeleteContract = (id: string) => {
    const target = contracts.find((c) => c.id === id);
    if (target?.isDefault && contracts.length > 1) {
      alert("Asosiy (Default) shartnomani o'chirib bo'lmaydi. Avval boshqa shartnomani asosiy qilib belgilang.");
      return;
    }
    const updatedList = contracts.filter((c) => c.id !== id);
    onChange("contracts", updatedList);
  };

  const handleSetDefaultContract = (target: CustomerContractRecord) => {
    const updatedList = contracts.map((c) => ({
      ...c,
      isDefault: c.id === target.id,
      status: c.id === target.id ? ("active" as const) : c.status,
    }));
    onChange("contracts", updatedList);
    onChange("contractNo", target.contractNo);
    onChange("contractDate", target.startDate);
    onChange("contractExpiry", target.endDate);
    if (target.paymentTerms) {
      onChange("paymentTerms", target.paymentTerms);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Over-Limit / Blocked Alert Banner */}
      {(isOverCreditLimit || form.status === "Blocked") && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-bold">
              {form.status === "Blocked"
                ? "DIQQAT: Ushbu kontragent STOP-LISTga kiritilgan!"
                : "MOLIYAVIY CHEKLOV: Kredit limiti oshib ketgan!"}
            </span>{" "}
            <span>
              Joriy qarzdorlik:{" "}
              <strong className="font-mono">${closingBalance.toLocaleString()}</strong>, belgilangan limit:{" "}
              <strong className="font-mono">${creditLimit.toLocaleString()}</strong>. Buxgalteriya to&apos;lov
              qabul qilmaguncha yangi buyurtmalarni yuklash to&apos;xtatiladi.
            </span>
          </div>
          <Button
            size="sm"
            onClick={onOpenPaymentModal}
            className="h-7 px-2.5 text-xs bg-rose-600 hover:bg-rose-700 text-white shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1" />
            To&apos;lov kiritish
          </Button>
        </div>
      )}

      {/* Live Financial KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Boshlang&apos;ich qoldiq (Opening)
            </div>
            <div className="font-mono text-base font-bold mt-0.5">
              ${(settlement?.openingBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            USD
          </Badge>
        </div>

        <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Jami Realizatsiya (+Dt / SF)
            </div>
            <div className="font-mono text-base font-bold text-primary mt-0.5">
              +${(settlement?.totalDebit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Yuklangan
          </Badge>
        </div>

        <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Jami Kirim (-Kt / Bank)
            </div>
            <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              -${(settlement?.totalCredit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            To&apos;langan
          </Badge>
        </div>

        <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Yakuniy Saldo (Balance)
            </div>
            <div
              className={`font-mono text-base font-bold mt-0.5 ${
                closingBalance > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : closingBalance < 0
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              ${closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateTab("settlements")}
            className="h-7 px-2 text-[11px] gap-1 cursor-pointer"
          >
            <Scale className="w-3 h-3 text-primary" />
            <span>Akt Sverka</span>
          </Button>
        </div>
      </div>

      {/* High-Density 3-Column Enterprise Form Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Yuridik va Soliq Rekvizitlari */}
        <div className="bg-card border border-border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              1. Yuridik va Soliq Rekvizitlari
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Korxona / Kontragent to&apos;liq nomi *
            </Label>
            <Input
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Masalan: Alpha Media Group MCHJ"
              className="h-8 text-xs font-medium bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                STIR (INN) *
              </Label>
              <Input
                value={form.tin}
                onChange={(e) => onChange("tin", e.target.value)}
                placeholder="305841920"
                maxLength={9}
                className="h-8 text-xs font-mono bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                OKED kodi
              </Label>
              <Input
                value={form.oked || ""}
                onChange={(e) => onChange("oked", e.target.value)}
                placeholder="18120"
                maxLength={5}
                className="h-8 text-xs font-mono bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                Mijoz Segmenti / Status
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => onChange("status", v as CrmCustomerRecord["status"])}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIP">VIP Mijoz</SelectItem>
                  <SelectItem value="Active">Faol (Active)</SelectItem>
                  <SelectItem value="New">Yangi (New)</SelectItem>
                  <SelectItem value="Blocked">Bloklangan (Stop-list)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                QQS To&apos;lovchisi
              </Label>
              <Select
                value={form.vatPayer ? "yes" : "no"}
                onValueChange={(v) => onChange("vatPayer", v === "yes")}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">QQS to&apos;lovchi (12%)</SelectItem>
                  <SelectItem value="no">QQS to&apos;lovchi emas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Faoliyat sohasi (Industry)
            </Label>
            <Input
              value={form.industry}
              onChange={(e) => onChange("industry", e.target.value)}
              placeholder="Masalan: Qadoqlash va nashriyot"
              className="h-8 text-xs bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 text-muted-foreground" /> Yuridik Manzil
            </Label>
            <Input
              value={form.legalAddress || ""}
              onChange={(e) => onChange("legalAddress", e.target.value)}
              placeholder="Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi 42-uy"
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Column 2: Bank va Moliyaviy rekvizitlar */}
        <div className="bg-card border border-border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Landmark className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              2. Bank va Moliyaviy Rekvizitlar
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1 font-semibold text-foreground">
                <span>Hisob-kitob Valyutasi</span>
              </Label>
              <Select
                value={form.currency || "UZS"}
                onValueChange={(v) => onChange("currency", v as "UZS" | "USD")}
              >
                <SelectTrigger className="h-8 text-xs bg-background font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">🇺🇿 So&apos;m (UZS) — Milliy valyuta</SelectItem>
                  <SelectItem value="USD">🇺🇸 AQSH Dollari (USD) — Valyuta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                Kredit Limiti ({form.currency === "USD" ? "$ USD" : "so'm UZS"})
              </Label>
              <Input
                value={form.creditLimitUsd !== undefined ? String(form.creditLimitUsd) : "0"}
                onChange={(e) => onChange("creditLimitUsd", Number(e.target.value) || 0)}
                placeholder="0"
                className="h-8 text-xs font-mono bg-background"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Xizmat ko&apos;rsatuvchi Bank nomi
            </Label>
            <Input
              value={form.bankName || ""}
              onChange={(e) => onChange("bankName", e.target.value)}
              placeholder="ATB Ipoteka Bank Bosh amaliyot filiali"
              className="h-8 text-xs bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                MFO Kodi (5 xona)
              </Label>
              <Input
                value={form.mfo || ""}
                onChange={(e) => onChange("mfo", e.target.value)}
                placeholder="00450"
                maxLength={5}
                className="h-8 text-xs font-mono bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                OKED kodi (5 xona)
              </Label>
              <Input
                value={form.oked || ""}
                onChange={(e) => onChange("oked", e.target.value)}
                placeholder="18120"
                maxLength={5}
                className="h-8 text-xs font-mono bg-background"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Hisob-raqam / R/s (20 xonali)
            </Label>
            <Input
              value={form.bankAccount || ""}
              onChange={(e) => onChange("bankAccount", e.target.value)}
              placeholder="20208000900123456001"
              maxLength={20}
              className="h-8 text-xs font-mono bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              To&apos;lov shartlari (Payment Terms)
            </Label>
            <Select
              value={form.paymentTerms}
              onValueChange={(v) => v && onChange("paymentTerms", v)}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100% Prepayment">100% Oldindan to&apos;lov</SelectItem>
                <SelectItem value="50% Prepay / 50% Ship">50% Avans / 50% Yuklashda</SelectItem>
                <SelectItem value="30% Prepay / 70% Net 15">30% Avans / 70% 15 kun</SelectItem>
                <SelectItem value="15 Days Net">15 kunlik nasiya (Net 15)</SelectItem>
                <SelectItem value="30 Days Net">30 kunlik nasiya (Net 30)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-600" /> Mahsulot yetkazish manzili (Ombor)
            </Label>
            <Input
              value={form.deliveryAddress || ""}
              onChange={(e) => onChange("deliveryAddress", e.target.value)}
              placeholder="Toshkent vil., Zangiota tumani, Markaziy ombor №3"
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Column 3: Amaldagi Shartnoma va Mas'ul Menejer */}
        <div className="bg-card border border-border rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-primary" />
              <span className="font-semibold text-xs text-foreground">
                3. Amaldagi Shartnoma va Mas&apos;ul
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium">
              ● Faol shartnoma
            </Badge>
          </div>

          {/* Active Contract Quick Card */}
          <div className="rounded-md border border-border/80 bg-muted/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                <ScrollText className="w-3 h-3 text-blue-500" />
                Bosh ramkali shartnoma
              </span>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("customer-contracts-section");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <span>Tarix ({contracts.length})</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-sm text-foreground">
                  {form.contractNo || "Mavjud emas"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (form.contractNo) navigator.clipboard.writeText(form.contractNo);
                    setCopiedText("contractNo");
                    setTimeout(() => setCopiedText(null), 2000);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  title="Nusxalash"
                >
                  {copiedText === "contractNo" ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] h-5">
                ⭐ Asosiy (Default)
              </Badge>
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
              <span>Amal qilish davri:</span>
              <span className="font-mono text-foreground font-medium">
                {form.contractDate ? `${form.contractDate} — ${form.contractExpiry || "Muddatsiz"}` : "Shartnoma tuzilmagan"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-primary" /> Biriktirilgan Buyurtma Menejeri
            </Label>
            <Input
              value={form.manager}
              onChange={(e) => onChange("manager", e.target.value)}
              placeholder="Elena Voronina"
              className="h-8 text-xs bg-background"
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <Button
              size="sm"
              onClick={onOpenPaymentModal}
              className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>+ To&apos;lov kiritish (Kirim)</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCreateClientOrder}
              className="h-8 flex-1 text-xs gap-1.5 cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-primary" />
              <span>+ Yangi buyurtma</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Tashkilot Mas'ul Shaxslari va Aloqa Bo'limi (Direktor, Buxgalter, Ta'minotchi, Omborchi) */}
      <div className="bg-card border border-border rounded-md p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              4. Tashkilot Mas&apos;ul Shaxslari va Aloqa Tarmog&apos;i
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 font-mono">
              {contacts.length} ta kontakt
            </Badge>
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              (Direktor, Bosh buxgalter, Ta&apos;minotchi / Buyurtmachi, Ombor mudiri)
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenAddContact}
            className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5 text-primary" />
            <span>+ Yangi kontakt qo&apos;shish</span>
          </Button>
        </div>

        {contacts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p>Hozircha biriktirilgan kontakt shaxslar mavjud emas.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenAddContact}
              className="h-7 text-xs"
            >
              Birinchi kontaktni kiritish
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden bg-background">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="h-8 border-b border-border">
                  <TableHead className="w-[170px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Lavozim / Rol
                  </TableHead>
                  <TableHead className="w-[200px] text-[11px] font-semibold text-foreground py-1 px-3">
                    F.I.Sh (Mas&apos;ul)
                  </TableHead>
                  <TableHead className="w-[170px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Telefon raqami
                  </TableHead>
                  <TableHead className="w-[150px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Telegram
                  </TableHead>
                  <TableHead className="w-[180px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Email
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-foreground py-1 px-3">
                    Mas&apos;uliyat sohasi / Eslatma
                  </TableHead>
                  <TableHead className="w-[90px] text-[11px] font-semibold text-foreground text-right py-1 px-3">
                    Amallar
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => {
                  const roleMeta = ROLE_CONFIG[c.role] || ROLE_CONFIG.other;
                  return (
                    <TableRow key={c.id} className="h-9 hover:bg-muted/30 border-b border-border">
                      <TableCell className="py-1.5 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.5 font-medium border gap-1 ${roleMeta.badgeClass}`}
                        >
                          <span>{roleMeta.icon}</span>
                          <span>{c.roleLabel || roleMeta.label}</span>
                        </Badge>
                      </TableCell>

                      <TableCell className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-xs text-foreground">{c.name}</span>
                          {c.isPrimary && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border border-primary/30"
                              title="Asosiy aloqa shaxsi"
                            >
                              Asosiy
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5 group">
                          <a
                            href={`tel:${c.phone}`}
                            className="font-mono text-xs text-foreground hover:text-primary transition-colors flex items-center gap-1"
                            title="Qo'ng'iroq qilish"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{c.phone}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(c.phone)}
                            className="opacity-0 group-hover:opacity-100 hover:text-foreground text-muted-foreground p-0.5 rounded transition-opacity cursor-pointer"
                            title="Nusxalash"
                          >
                            {copiedText === c.phone ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </TableCell>

                      <TableCell className="py-1.5 px-3">
                        {c.telegram ? (
                          <a
                            href={
                              c.telegram.startsWith("http")
                                ? c.telegram
                                : `https://t.me/${c.telegram.replace("@", "")}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-600 hover:underline"
                            title="Telegramda ochish"
                          >
                            <Send className="w-3 h-3 text-blue-500" />
                            <span>@{c.telegram.replace("@", "")}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-1.5 px-3">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-foreground hover:text-primary truncate max-w-[170px]"
                            title={c.email}
                          >
                            <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-1.5 px-3">
                        <span className="text-[11px] text-muted-foreground truncate block max-w-[320px]" title={c.notes}>
                          {c.notes || "—"}
                        </span>
                      </TableCell>

                      <TableCell className="py-1.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSetPrimaryContact(c)}
                            className={`h-6 w-6 cursor-pointer ${
                              c.isPrimary
                                ? "text-amber-500 hover:text-amber-600"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title={c.isPrimary ? "Asosiy kontakt" : "Asosiy kontakt qilib belgilash"}
                          >
                            <Star className={`w-3.5 h-3.5 ${c.isPrimary ? "fill-amber-500" : ""}`} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEditContact(c)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Tahrirlash"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteContact(c.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-rose-600 cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 5. Shartnomalar va Qo'shimcha Kelishuvlar (Tarix va Holati) */}
      <div id="customer-contracts-section" className="bg-card border border-border rounded-md p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              5. Shartnomalar va Qo&apos;shimcha Kelishuvlar (Tarix va Holati)
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 font-mono">
              {contracts.length} ta shartnoma
            </Badge>
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              (Yillik bosh ramkali shartnoma, buyurtma ilovalari, tender bitimlari va arxiv)
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenAddContract}
            className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>+ Yangi shartnoma qo&apos;shish</span>
          </Button>
        </div>

        {contracts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs space-y-2">
            <ScrollText className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p>Ushbu mijoz uchun kiritilgan shartnomalar mavjud emas.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenAddContract}
              className="h-7 text-xs"
            >
              Bosh shartnomani kiritish
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden bg-background">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="h-8 border-b border-border">
                  <TableHead className="w-[170px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Shartnoma Raqami
                  </TableHead>
                  <TableHead className="w-[240px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Shartnoma Nomi / Predmeti
                  </TableHead>
                  <TableHead className="w-[160px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Turi
                  </TableHead>
                  <TableHead className="w-[180px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Amal Qilish Davri
                  </TableHead>
                  <TableHead className="w-[160px] text-[11px] font-semibold text-foreground py-1 px-3">
                    To&apos;lov Sharti
                  </TableHead>
                  <TableHead className="w-[130px] text-[11px] font-semibold text-foreground py-1 px-3">
                    Holati
                  </TableHead>
                  <TableHead className="w-[130px] text-[11px] font-semibold text-foreground text-right py-1 px-3">
                    Amallar
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((cnt) => {
                  const typeMeta = CONTRACT_TYPE_CONFIG[cnt.type] || CONTRACT_TYPE_CONFIG.annual;
                  const statusMeta = CONTRACT_STATUS_CONFIG[cnt.status] || CONTRACT_STATUS_CONFIG.active;
                  return (
                    <TableRow key={cnt.id} className="h-9 hover:bg-muted/30 border-b border-border">
                      <TableCell className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-foreground">
                            {cnt.contractNo}
                          </span>
                          {cnt.isDefault && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] px-1 py-0 h-4">
                              ⭐ Asosiy
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-1.5 px-3">
                        <span className="font-medium text-xs text-foreground truncate block max-w-[230px]" title={cnt.title}>
                          {cnt.title}
                        </span>
                        {cnt.notes && (
                          <span className="text-[10px] text-muted-foreground truncate block max-w-[230px]" title={cnt.notes}>
                            {cnt.notes}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-1.5 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.5 font-medium border ${typeMeta.badgeClass}`}
                        >
                          {typeMeta.label}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-1.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {cnt.startDate} — {cnt.endDate}
                      </TableCell>

                      <TableCell className="py-1.5 px-3 text-[11px] text-muted-foreground">
                        {cnt.paymentTerms || "Standart"}
                      </TableCell>

                      <TableCell className="py-1.5 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.5 font-medium border gap-1 items-center ${statusMeta.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                          <span>{statusMeta.label}</span>
                        </Badge>
                      </TableCell>

                      <TableCell className="py-1.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!cnt.isDefault && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSetDefaultContract(cnt)}
                              className="h-6 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                              title="Asosiy shartnoma qilib belgilash"
                            >
                              <Star className="w-3 h-3 mr-0.5" />
                              <span>Asosiy qilish</span>
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEditContract(cnt)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Tahrirlash"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteContract(cnt.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-rose-600 cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 6. Logistika, Ombor va Yetkazib Berish Shartlari + 7. Maxsus Poligrafik Talablar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 6: Logistika va Ombor tartibi */}
        <div className="bg-card border border-border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-xs text-foreground">
              6. Logistika, Ombor va Qabul Qilish Shartlari
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-600" /> Mahsulot yetkazib berish manzili (Ombor)
            </Label>
            <Input
              value={form.deliveryAddress || ""}
              onChange={(e) => onChange("deliveryAddress", e.target.value)}
              placeholder="Toshkent vil., Zangiota tumani, Markaziy ombor №3"
              className="h-8 text-xs bg-background"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" /> Yuk qabul qilish grafigi
              </Label>
              <Input
                value={form.receivingHours || "Dush-Shanba: 08:30 - 17:30 (Tushlik 12:30 - 13:30)"}
                onChange={(e) => onChange("receivingHours", e.target.value)}
                placeholder="Dush-Juma: 09:00 - 18:00"
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-600" /> Ishonchnoma (Doverennost)
              </Label>
              <Select
                value={form.requiresPowerOfAttorney ? "yes" : "no"}
                onValueChange={(v) => onChange("requiresPowerOfAttorney", v === "yes")}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Majburiy (Qat&apos;iy ishonchnoma bilan)</SelectItem>
                  <SelectItem value="no">Talab qilinmaydi (Erkin topshirish)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Truck className="w-3 h-3 text-muted-foreground" /> Transport turi & Rampa sharoiti
            </Label>
            <Input
              value={form.deliveryTransportNote || ""}
              onChange={(e) => onChange("deliveryTransportNote", e.target.value)}
              placeholder="Masalan: Faqat Gazel yoki Isuzu, darvoza balandligi 3.2m, rampa mavjud emas"
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Card 7: Maxsus Poligrafik Talablar va CRM Eslatmalari */}
        <div className="bg-card border border-border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              7. Maxsus Poligrafik Talablar va CRM Izohlari
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Poligrafik va Qadoqlash talablari (Rang, qadoq, palletlash)
            </Label>
            <Textarea
              value={form.specialRequirements || ""}
              onChange={(e) => onChange("specialRequirements", e.target.value)}
              placeholder="Masalan: Trikotaj yorliqlari 100 tadan rezinka bilan bog'lansin, namlikka chidamli polietilenga o'ralgan bo'lsin. Pantone rangiga qat'iy rioya etilsin."
              className="text-xs bg-background min-h-[64px] resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Umumiy ichki sharhlar va mijoz xususiyatlari (CRM Notes)
            </Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => onChange("notes", e.target.value)}
              placeholder="Masalan: VIP mijoz. Buyurtmalar odatda har oyning 10-sanasida beriladi. Shartnomani har yili dekabr oyida qayta tuzish lozim."
              className="text-xs bg-background min-h-[64px] resize-none"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Add / Edit Contact Modal Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-md p-5 bg-card border-border">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>
                {editingContact && contacts.some((c) => c.id === editingContact.id)
                  ? "Kontakt ma'lumotlarini tahrirlash"
                  : "Yangi kontakt shaxs qo'shish"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {editingContact && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Rol / Mas&apos;uliyat toifasi *
                  </Label>
                  <Select
                    value={editingContact.role}
                    onValueChange={(val: any) => {
                      const cfg = ROLE_CONFIG[val as CustomerContactPerson["role"]];
                      setEditingContact({
                        ...editingContact,
                        role: val,
                        roleLabel: cfg?.label || editingContact.roleLabel,
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="director">👑 Bosh direktor</SelectItem>
                      <SelectItem value="accountant">💼 Bosh buxgalter</SelectItem>
                      <SelectItem value="procurement">📦 Ta&apos;minotchi / Buyurtmachi</SelectItem>
                      <SelectItem value="warehouse">🏭 Ombor mudiri</SelectItem>
                      <SelectItem value="manager">👤 Loyiha menejeri</SelectItem>
                      <SelectItem value="other">🔹 Boshqa mas&apos;ul</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Lavozim nomi (ixtiyoriy)
                  </Label>
                  <Input
                    value={editingContact.roleLabel || ""}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, roleLabel: e.target.value })
                    }
                    placeholder="Masalan: Ta'minot boshlig'i"
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  F.I.Sh (Mas&apos;ul to&apos;liq ismi) *
                </Label>
                <Input
                  value={editingContact.name}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, name: e.target.value })
                  }
                  placeholder="Masalan: Kamola Rustamova"
                  className="h-8 text-xs font-medium bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" /> Telefon raqami *
                  </Label>
                  <PhoneInput
                    value={editingContact.phone}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, phone: e.target.value })
                    }
                    placeholder="+998 90 123-45-67"
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Send className="w-3 h-3 text-blue-500" /> Telegram (@username)
                  </Label>
                  <Input
                    value={editingContact.telegram || ""}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, telegram: e.target.value })
                    }
                    placeholder="kamola_rustamova"
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3 text-muted-foreground" /> Email manzili
                </Label>
                <Input
                  value={editingContact.email || ""}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, email: e.target.value })
                  }
                  placeholder="supply@vanguardfashion.uz"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Mas&apos;uliyat sohasi / Ichki eslatma
                </Label>
                <Input
                  value={editingContact.notes || ""}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, notes: e.target.value })
                  }
                  placeholder="Masalan: Tiraj tasdiqlash, qadoq yorliqlari buyurtmasi"
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="pt-1 flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground block">
                    Asosiy kontakt sifatida belgilash
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Mijoz kartochkasining asosiy telefoni va emailiga ko&apos;chiriladi
                  </span>
                </div>
                <input
                  type="checkbox"
                  id="primaryContactCheckbox"
                  checked={Boolean(editingContact.isPrimary)}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, isPrimary: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsContactDialogOpen(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleSaveContact}
              disabled={!editingContact?.name.trim()}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Saqlash</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Contract Modal Dialog */}
      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="max-w-md p-5 bg-card border-border">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-primary" />
              <span>
                {editingContract && contracts.some((c) => c.id === editingContract.id)
                  ? "Shartnomani tahrirlash"
                  : "Yangi shartnoma qo'shish"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {editingContract && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Shartnoma Raqami *
                  </Label>
                  <Input
                    value={editingContract.contractNo}
                    onChange={(e) =>
                      setEditingContract({ ...editingContract, contractNo: e.target.value })
                    }
                    placeholder="Masalan: CON-2027-101"
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Shartnoma Turi
                  </Label>
                  <Select
                    value={editingContract.type}
                    onValueChange={(val: any) =>
                      setEditingContract({ ...editingContract, type: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Yillik bosh shartnoma</SelectItem>
                      <SelectItem value="frame">Ramkali shartnoma</SelectItem>
                      <SelectItem value="order_spec">Buyurtma spetsifikatsiyasi</SelectItem>
                      <SelectItem value="tender">Tender bitimi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Shartnoma Nomi / Predmeti *
                </Label>
                <Input
                  value={editingContract.title}
                  onChange={(e) =>
                    setEditingContract({ ...editingContract, title: e.target.value })
                  }
                  placeholder="Masalan: 2027-yilgi mahsulot yetkazib berish shartnomasi"
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" /> Boshlanish sanasi *
                  </Label>
                  <Input
                    type="date"
                    value={editingContract.startDate}
                    onChange={(e) =>
                      setEditingContract({ ...editingContract, startDate: e.target.value })
                    }
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" /> Tugash sanasi *
                  </Label>
                  <Input
                    type="date"
                    value={editingContract.endDate}
                    onChange={(e) =>
                      setEditingContract({ ...editingContract, endDate: e.target.value })
                    }
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    To&apos;lov sharti
                  </Label>
                  <Input
                    value={editingContract.paymentTerms || ""}
                    onChange={(e) =>
                      setEditingContract({ ...editingContract, paymentTerms: e.target.value })
                    }
                    placeholder="50% Advance / 50% Net 15"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Shartnoma Holati
                  </Label>
                  <Select
                    value={editingContract.status}
                    onValueChange={(val: any) =>
                      setEditingContract({ ...editingContract, status: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">● Faol</SelectItem>
                      <SelectItem value="expired">○ Arxiv / Tugagan</SelectItem>
                      <SelectItem value="terminated">✕ Bekor qilingan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Izoh va qo&apos;shimcha shartlar
                </Label>
                <Input
                  value={editingContract.notes || ""}
                  onChange={(e) =>
                    setEditingContract({ ...editingContract, notes: e.target.value })
                  }
                  placeholder="Didox va Soliq orqali tasdiqlangan"
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="pt-1 flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground block">
                    ⭐ Hozirgi Asosiy (Default) shartnoma deb belgilash
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Yangi ochiladigan buyurtma va hisob-fakturalarga avtomatik ushbu shartnoma biriktiriladi
                  </span>
                </div>
                <input
                  type="checkbox"
                  id="primaryContractCheckbox"
                  checked={Boolean(editingContract.isDefault)}
                  onChange={(e) =>
                    setEditingContract({ ...editingContract, isDefault: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsContractDialogOpen(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleSaveContract}
              disabled={!editingContract?.contractNo.trim()}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Saqlash</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
