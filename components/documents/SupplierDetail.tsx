"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  useWorkspaceStore,
  DocumentTab,
} from "@/store/workspaceStore";
import {
  DocumentHeader,
  DocumentSidebar,
  SidebarSummaryCard,
  DocumentNavItem,
  InfoRow,
} from "@/components/documents/common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Building2,
  ShoppingBag,
  Truck,
  CreditCard,
  FileText,
  Save,
  Check,
  Printer,
  Plus,
  Scale,
} from "lucide-react";
import type {
  SupplierRecord,
  SupplierCategory,
  SupplierLedgerEntry,
} from "@/lib/server/supplierService";
import { SUPPLIER_CATEGORY_LABELS } from "@/components/crm/SupplierDetailModal";
import { SupplierOverviewTab } from "./supplier/tabs/SupplierOverviewTab";
import { SupplierOrdersTab } from "./supplier/tabs/SupplierOrdersTab";
import { SupplierDeliveriesTab } from "./supplier/tabs/SupplierDeliveriesTab";
import { SupplierSettlementsTab } from "./supplier/tabs/SupplierSettlementsTab";
import { SupplierContractsTab } from "./supplier/tabs/SupplierContractsTab";
import { SupplierAktSverkaModal } from "./supplier/components/SupplierAktSverkaModal";

export function SupplierDetail({ tab }: { tab: DocumentTab }) {
  const {
    suppliers,
    loadSuppliers,
    upsertSupplierAsync,
    replaceTabId,
    setTabUnsaved,
    setLevel3Tab,
    closeTab,
    addNotification,
    warehouseReceipts,
  } = useWorkspaceStore();

  const activeTab = tab.activeLevel3Tab || "overview";

  // Find supplier in store by ID or code
  const storeSupplier = useMemo(() => {
    const d = tab.documentData || {};
    return (
      suppliers.find(
        (s) =>
          s.id === tab.id ||
          s.id === d.id ||
          (d.code && s.code === d.code) ||
          (d.name && s.name.toLowerCase() === String(d.name).toLowerCase())
      ) || null
    );
  }, [suppliers, tab.id, tab.documentData]);

  // Initial form record
  const initialRecord: SupplierRecord = useMemo(() => {
    if (storeSupplier) return storeSupplier;
    const d = tab.documentData || {};
    return {
      id: d.id || (tab.id.startsWith("draft-") ? tab.id : `draft-supp-${Date.now()}`),
      code: d.code || `SUPP-${Math.floor(100 + Math.random() * 900)}`,
      name: d.name || "",
      legalName: d.legalName || "",
      category: (d.category as SupplierCategory) || "raw_materials",
      tin: d.tin || "",
      contactPerson: d.contactPerson || "",
      phone: d.phone || "",
      email: d.email || "",
      bankName: d.bankName || "",
      bankAccount: d.bankAccount || "",
      mfo: d.mfo || "",
      openingBalance: Number(d.openingBalance) || 0,
      currentBalance: Number(d.currentBalance) || 0,
      currency: d.currency || "UZS",
      paymentTerms: d.paymentTerms || "",
      address: d.address || "",
      notes: d.notes || "",
      status: d.status === "Blocked" || d.status === "Archived" ? d.status : "Active",
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }, [storeSupplier, tab.documentData, tab.id]);

  const [form, setForm] = useState<SupplierRecord>(initialRecord);
  const [saving, setSaving] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // Financial reconciliation ledger state
  const [ledger, setLedger] = useState<SupplierLedgerEntry[]>([]);
  const [totalCredit, setTotalCredit] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [closingBalance, setClosingBalance] = useState(form.currentBalance || 0);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchLedger = useCallback(async () => {
    if (!form.id || form.id.startsWith("draft-")) return;
    try {
      setLoadingLedger(true);
      const res = await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(form.id)}/ledger`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setLedger(json.data.ledger || []);
          setTotalCredit(json.data.totalCredit || 0);
          setTotalDebit(json.data.totalDebit || 0);
          const bal = json.data.closingBalance || 0;
          setClosingBalance(bal);
          setForm((prev) => ({ ...prev, currentBalance: bal }));
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingLedger(false);
    }
  }, [form.id]);

  useEffect(() => {
    if (storeSupplier) {
      setForm(storeSupplier);
    }
  }, [storeSupplier]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleFieldChange = (updated: Partial<SupplierRecord>) => {
    setForm((prev) => ({ ...prev, ...updated }));
    setTabUnsaved(tab.id, true);
  };

  const isDraft = !form.id || form.id.startsWith("draft-") || form.id.startsWith("new-");

  // Save changes
  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("Iltimos, yetkazib beruvchi nomini kiriting!");
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertSupplierAsync(form);
      if (saved && saved.id) {
        setForm(saved);
        if (isDraft || tab.id !== saved.id) {
          replaceTabId(tab.id, saved.id, `${saved.code}: ${saved.name}`, saved);
        }
      }
      setTabUnsaved(tab.id, false);
      addNotification({
        title: "Ta'minotchi saqlandi",
        description: `${form.name} ma'lumotlari muvaffaqiyatli yangilandi.`,
        severity: "success",
        link: { module: "crm", subModule: "suppliers" },
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    closeTab(tab.id);
  };

  const catConfig =
    SUPPLIER_CATEGORY_LABELS[form.category as SupplierCategory] ||
    SUPPLIER_CATEGORY_LABELS.raw_materials;

  const fmtMoney = (val: number) => {
    return new Intl.NumberFormat("uz-UZ").format(val);
  };

  // Matched deliveries count for badge
  const matchedDeliveriesCount = useMemo(() => {
    return (warehouseReceipts || []).filter((r: any) => {
      const suppName = (r.supplierName || "").toLowerCase();
      const sName = (form.name || "").toLowerCase();
      const sLegal = (form.legalName || "").toLowerCase();
      return (
        suppName &&
        (suppName.includes(sName) ||
          (sLegal && suppName.includes(sLegal)) ||
          sName.includes(suppName))
      );
    }).length;
  }, [warehouseReceipts, form.name, form.legalName]);

  const navItems: DocumentNavItem[] = [
    {
      id: "overview",
      label: "Rekvizitlar va Holat",
      icon: Building2,
    },
    {
      id: "orders",
      label: "Buyurtmalar (PO)",
      icon: ShoppingBag,
    },
    {
      id: "deliveries",
      label: "Kirim Fakturalar",
      icon: Truck,
      badge: matchedDeliveriesCount > 0 ? matchedDeliveriesCount : undefined,
    },
    {
      id: "settlements",
      label: "Akt-sverka & To'lov",
      icon: CreditCard,
      badge:
        closingBalance !== 0
          ? `${fmtMoney(Math.abs(closingBalance))} ${form.currency}`
          : undefined,
      badgeClassName:
        closingBalance > 0
          ? "text-rose-600 font-bold dark:text-rose-400"
          : "text-emerald-600 font-bold dark:text-emerald-400",
    },
    {
      id: "contracts",
      label: "Shartnomalar & Fayllar",
      icon: FileText,
    },
  ];

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs select-text">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* 1. Standart 1C Document Header */}
        <DocumentHeader
          icon={Building2}
          title={form.name || "Yangi ta'minotchi"}
          docNo={form.code}
          status={form.status}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isDraft) {
                    alert("Buyurtma berish uchun avval ta'minotchi rekvizitlarini saqlang!");
                    return;
                  }
                  if (form.status === "Blocked") {
                    alert("Ushbu ta'minotchi bloklangan (Stop-list). Yangi buyurtma berish taqiqlangan!");
                    return;
                  }
                  setLevel3Tab(tab.id, "orders");
                  setIsOrderModalOpen(true);
                }}
                disabled={form.status === "Blocked"}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">+ Yangi buyurtma</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isDraft) {
                    alert("Akt-sverkani chop etish uchun avval ta'minotchini saqlang!");
                    return;
                  }
                  setIsPrintModalOpen(true);
                }}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
                title="Akt Sverka chop etish"
              >
                <Printer className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Akt-sverka</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Saqlanmoqda..." : "Saqlash"}</span>
              </Button>

              <Button
                size="sm"
                onClick={handleSaveAndClose}
                disabled={saving}
                className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Saqlash va yopish</span>
              </Button>
            </div>
          }
        />

        {/* 2. Asosiy Qism: DocumentSidebar + Main Viewport */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <DocumentSidebar
            sectionsLabel="Bo'limlar"
            items={navItems}
            activeId={activeTab}
            onSelect={(id: string) => setLevel3Tab(tab.id, id)}
            summary={
              <div className="space-y-3">
                <SidebarSummaryCard
                  icon={Building2}
                  title={form.name || "Ta'minotchi"}
                  subtitle={
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${catConfig.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 ${catConfig.dot}`} />
                        {catConfig.label}
                      </Badge>
                    </div>
                  }
                >
                  <InfoRow label="Kodi:">
                    <span className="font-mono text-[10px]">{form.code}</span>
                  </InfoRow>
                  <InfoRow label="STIR (TIN):">
                    <span className="font-mono text-[10px]">{form.tin || "—"}</span>
                  </InfoRow>
                  <InfoRow label="Aloqa:">
                    <span className="truncate">{form.contactPerson || "—"}</span>
                  </InfoRow>
                  <InfoRow label="Telefon:">
                    <span className="font-mono text-[10px]">{form.phone || "—"}</span>
                  </InfoRow>
                  <InfoRow label="Shartnoma:">
                    <span className="truncate">{form.paymentTerms || "—"}</span>
                  </InfoRow>
                </SidebarSummaryCard>

                <SidebarSummaryCard
                  icon={CreditCard}
                  title="Moliyaviy hisob-kitob"
                  subtitle={`Valyuta: ${form.currency || "UZS"}`}
                >
                  <InfoRow label="Joriy Saldo:">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span
                        className={`font-mono font-bold text-xs ${
                          closingBalance > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : closingBalance < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {fmtMoney(Math.abs(closingBalance))} {form.currency}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 h-3.5 ${
                          closingBalance > 0
                            ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950"
                            : closingBalance < 0
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950"
                            : "border-zinc-300 text-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                        }`}
                      >
                        {closingBalance > 0 ? "Qarzimiz" : closingBalance < 0 ? "Avansimiz" : "Nol"}
                      </Badge>
                    </div>
                  </InfoRow>
                </SidebarSummaryCard>
              </div>
            }
          />

          {/* O'ng taraf: Tab kontenti */}
          <main className="flex-1 overflow-hidden flex flex-col bg-muted/10">
            <TabsContent value="overview" className="m-0 h-full p-0 flex flex-col overflow-hidden">
              <SupplierOverviewTab
                supplier={form}
                onChange={handleFieldChange}
                financials={{
                  openingBalance: form.openingBalance || 0,
                  totalCredit,
                  totalDebit,
                  closingBalance,
                }}
                onNavigateTab={(tabId) => setLevel3Tab(tab.id, tabId)}
                onOpenPaymentModal={() => {
                  setLevel3Tab(tab.id, "settlements");
                  setIsPaymentOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="orders" className="m-0 h-full p-0 flex flex-col overflow-hidden">
              <SupplierOrdersTab
                supplier={form}
                onRefreshOrders={() => {
                  loadSuppliers();
                  fetchLedger();
                }}
                onOrderCreated={() => {
                  loadSuppliers();
                  fetchLedger();
                }}
                isCreateOpen={isOrderModalOpen}
                setIsCreateOpen={setIsOrderModalOpen}
              />
            </TabsContent>

            <TabsContent value="deliveries" className="m-0 h-full p-0 flex flex-col overflow-hidden">
              <SupplierDeliveriesTab supplier={form} />
            </TabsContent>

            <TabsContent value="settlements" className="m-0 h-full p-0 flex flex-col overflow-hidden">
              <SupplierSettlementsTab
                supplier={form}
                ledger={ledger}
                totalCredit={totalCredit}
                totalDebit={totalDebit}
                closingBalance={closingBalance}
                loading={loadingLedger}
                onRefreshLedger={fetchLedger}
                onBalanceUpdated={(newBal) => {
                  setClosingBalance(newBal);
                  setForm((prev) => ({ ...prev, currentBalance: newBal }));
                }}
                isPaymentOpen={isPaymentOpen}
                setIsPaymentOpen={setIsPaymentOpen}
              />
            </TabsContent>

            <TabsContent value="contracts" className="m-0 h-full p-0 flex flex-col overflow-hidden">
              <SupplierContractsTab supplier={form} onChange={handleFieldChange} />
            </TabsContent>
          </main>
        </div>
      </Tabs>

      {/* Standart Chop etish uchun modal */}
      <SupplierAktSverkaModal
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        supplier={form}
        ledger={ledger}
        totalCredit={totalCredit}
        totalDebit={totalDebit}
        closingBalance={closingBalance}
      />
    </div>
  );
}
