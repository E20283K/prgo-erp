"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  useWorkspaceStore,
  DocumentTab,
  CrmCustomerRecord,
  CustomerContactPerson,
  CustomerContractRecord,
} from "@/store/workspaceStore";
import { getNextWorkOrderNo } from "@/components/documents/work-order/utils/workOrderNumbering";
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
  Scale,
  ClipboardList,
  Stamp,
  Printer,
  Save,
  Check,
  FilePlus2,
  CreditCard,
  Phone,
  Mail,
  UserCheck,
} from "lucide-react";
import { CustomerOverviewTab } from "./customer/tabs/CustomerOverviewTab";
import { CustomerSettlementsTab } from "./customer/tabs/CustomerSettlementsTab";
import { CustomerOrdersTab } from "./customer/tabs/CustomerOrdersTab";
import { CustomerToolingTab } from "./customer/tabs/CustomerToolingTab";
import { AktSverkaPrintModal } from "./customer/components/AktSverkaPrintModal";

function ensureCustomerContracts(customer: Partial<CrmCustomerRecord>): CustomerContractRecord[] {
  return customer.contracts || [];
}

function ensureCustomerContacts(customer: Partial<CrmCustomerRecord>): CustomerContactPerson[] {
  return customer.contacts || [];
}

function normalizeCompanyName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(llc|mchj|ooo|xk|qk|aj|chj|ltd|inc)\b/gi, "")
    .replace(/["'«».,]/g, "")
    .trim();
}

function isSameCustomer(
  customer: { id?: string; dbId?: string; name?: string; tin?: string },
  target: {
    clientId?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    customer?: string | null;
    customerTin?: string | null;
  }
): boolean {
  const custIds = [customer.id, customer.dbId].filter(
    (id): id is string =>
      Boolean(id && !id.startsWith("draft-") && !id.startsWith("new-") && !id.startsWith("CUST-NEW-"))
  );
  const targetIds = [target.clientId, target.customerId].filter((id): id is string => Boolean(id));
  if (custIds.length > 0 && targetIds.some((tid) => custIds.includes(tid))) {
    return true;
  }

  const custTin = (customer.tin || "").trim();
  const targetTin = (target.customerTin || "").trim();
  if (custTin.length >= 4 && targetTin.length >= 4 && custTin === targetTin) {
    return true;
  }

  const cleanCust = normalizeCompanyName(customer.name);
  const cleanTarget = normalizeCompanyName(target.customerName ?? target.customer);
  if (!cleanCust || !cleanTarget) return false;
  if (cleanCust === cleanTarget) return true;
  if (cleanCust.length >= 3 && cleanTarget.length >= 3) {
    return cleanCust.includes(cleanTarget) || cleanTarget.includes(cleanCust);
  }
  return false;
}

export function CustomerDetail({ tab }: { tab: DocumentTab }) {
  const {
    crmCustomers,
    loadCrmCustomers,
    clientSettlements,
    deliveryActs,
    loadFinanceData,
    productionQueue,
    loadProductionQueue,
    customerTooling,
    diesTooling,
    loadDiesToolingAsync,
    finishedGoods,
    loadFinishedGoods,
    loadWarehouseShipments,
    upsertCustomer,
    upsertCustomerAsync,
    replaceTabId,
    setTabUnsaved,
    setLevel3Tab,
    openTab,
    closeTab,
    addNotification,
  } = useWorkspaceStore();

  const activeTab = tab.activeLevel3Tab || "overview";

  // Load real data from server on mount so Orders, Stock, Settlements & Tooling are always live
  useEffect(() => {
    if (crmCustomers.length === 0 && loadCrmCustomers) {
      loadCrmCustomers();
    }
    if (loadProductionQueue) loadProductionQueue();
    if (loadFinishedGoods) loadFinishedGoods();
    if (loadFinanceData) loadFinanceData();
    if (loadWarehouseShipments) loadWarehouseShipments();
    if (loadDiesToolingAsync) loadDiesToolingAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Find customer from store by ID or Name
  const storeCustomer = useMemo(() => {
    const d = tab.documentData || {};
    return (
      crmCustomers.find(
        (c) =>
          c.id === tab.id ||
          c.id === d.id ||
          (d.customer &&
            (c.name.toLowerCase() === String(d.customer).toLowerCase() ||
              c.name.toLowerCase().includes(String(d.customer).toLowerCase()))) ||
          (d.name &&
            (c.name.toLowerCase() === String(d.name).toLowerCase() ||
              c.name.toLowerCase().includes(String(d.name).toLowerCase())))
      ) || null
    );
  }, [crmCustomers, tab.id, tab.documentData]);

  const initialRecord: CrmCustomerRecord = useMemo(() => {
    if (storeCustomer) {
      return {
        ...storeCustomer,
        contacts: ensureCustomerContacts(storeCustomer),
        contracts: ensureCustomerContracts(storeCustomer),
      };
    }
    const d = tab.documentData || {};
    const baseCust: CrmCustomerRecord = {
      id: d.id || (tab.id.startsWith("CUST-") ? tab.id : (tab.id.startsWith("draft-") ? tab.id : `draft-cust-${Date.now()}`)),
      name: d.name || d.customer || "",
      tin: d.tin || d.customerTin || "",
      industry: d.industry || "",
      industryId: d.industryId || (storeCustomer as any)?.industryId || undefined,
      contactPerson: d.contactPerson || "",
      phone: d.phone || "",
      email: d.email || "",
      contractNo: d.contractNo || "",
      paymentTerms: d.paymentTerms || "",
      manager: d.manager || "",
      status: d.status === "VIP" || d.status === "Active" || d.status === "New" || d.status === "Blocked" ? d.status : "New",
      currency: d.currency || "UZS",
      legalAddress: d.legalAddress || "",
      deliveryAddress: d.deliveryAddress || "",
      bankName: d.bankName || "",
      bankAccount: d.bankAccount || "",
      mfo: d.mfo || "",
      oked: d.oked || "",
      vatPayer: d.vatPayer ?? false,
      creditLimitUsd: d.creditLimitUsd ?? 0,
      contractDate: d.contractDate || "",
      contractExpiry: d.contractExpiry || "",
      receivingHours: d.receivingHours || "",
      requiresPowerOfAttorney: d.requiresPowerOfAttorney ?? false,
      deliveryTransportNote: d.deliveryTransportNote || "",
      specialRequirements: d.specialRequirements || "",
    };
    baseCust.contacts = ensureCustomerContacts(baseCust);
    baseCust.contracts = ensureCustomerContracts(baseCust);
    return baseCust;
  }, [storeCustomer, tab.documentData, tab.id]);

  const [form, setForm] = useState<CrmCustomerRecord>(initialRecord);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    if (storeCustomer) {
      setForm((prev) => ({
        ...prev,
        ...storeCustomer,
        contacts: ensureCustomerContacts(storeCustomer),
        contracts: ensureCustomerContracts(storeCustomer),
      }));
    }
  }, [storeCustomer]);

  const handleFieldChange = (field: keyof CrmCustomerRecord, val: any) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  // Match live Client Settlement (Akt Sverka)
  const settlement = useMemo(() => {
    return (
      clientSettlements.find((s) =>
        isSameCustomer(form, {
          customer: s.customer,
          customerTin: s.customerTin,
        })
      ) || null
    );
  }, [clientSettlements, form]);

  // Customer Orders count (Work Orders + Delivery Acts)
  const ordersCount = useMemo(() => {
    const acts = deliveryActs.filter((a) =>
      isSameCustomer(form, {
        customer: a.customer,
        customerTin: a.customerTin,
      })
    ).length;
    const queues = productionQueue.filter((q) =>
      isSameCustomer(form, {
        clientId: q.clientId,
        customer: q.customer,
      })
    ).length;
    return acts + queues;
  }, [deliveryActs, productionQueue, form]);

  // Customer Tooling count
  const toolingCount = useMemo(() => {
    const matchedLegacy = customerTooling.filter((t) =>
      isSameCustomer(form, {
        customerId: t.customerId,
        customerName: t.customerName,
      })
    );

    const matchedDies = (diesTooling || []).filter((t) =>
      isSameCustomer(form, {
        customerId: t.customerId,
        customerName: t.customerName,
      })
    );

    const uniqueIds = new Set([
      ...matchedDies.map((d) => d.code || d.id),
      ...matchedLegacy.map((l) => l.id),
    ]);
    return uniqueIds.size;
  }, [customerTooling, diesTooling, form]);

  // Customer Dedicated Finished Goods Stock (Zaxira)
  const customerStockQty = useMemo(() => {
    const matched = finishedGoods.filter((fg) =>
      isSameCustomer(form, {
        customerId: fg.customerId,
        clientId: (fg as any).clientId,
        customerName: fg.customerName,
        customerTin: fg.customerTin,
      })
    );
    return matched.reduce(
      (sum, item) => sum + (Number(item.stockQty ?? (item as any).quantity) || 0),
      0
    );
  }, [finishedGoods, form]);

  const closingBalance = settlement?.closingBalance ?? 0;

  const isDraft = !form.id || form.id.startsWith("draft-") || form.id.startsWith("new-") || form.id.startsWith("CUST-NEW-");

  // Actions
  const handleSave = async () => {
    let savedClient: any = null;
    if (upsertCustomerAsync) {
      savedClient = await upsertCustomerAsync(form);
    } else {
      upsertCustomer(form);
    }
    if (savedClient && savedClient.id) {
      setForm(savedClient);
      if (isDraft || tab.id !== savedClient.id) {
        replaceTabId(tab.id, savedClient.id, `${savedClient.id}: ${savedClient.name || "Mijoz"}`, savedClient);
      }
    }
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Mijoz kartochkasi saqlandi",
      description: `${form.name || "Mijoz"} rekvizitlari muvaffaqiyatli saqlandi.`,
      severity: "success",
      link: { module: "crm", subModule: "customers" },
    });
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    closeTab(tab.id);
  };

  const handleCreateClientOrder = () => {
    upsertCustomer(form);
    const newWoId = `draft-wo-${Date.now()}`;
    const newCoId = `CO-${String(Math.floor(10 + Math.random() * 89)).padStart(5, "0")}`;

    openTab({
      id: newWoId,
      title: `Yangi: ${form.name}`,
      type: "work-order",
      module: "production",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: "",
        clientOrderId: newCoId,
        customer: form.name,
        customerTin: form.tin,
        contractNo: form.contractNo,
        status: "Draft",
        quantity: 5000,
        unit: "pcs",
      },
    });
  };

  const handleOpenDeliveryAct = (docNo: string, debitAmount?: number) => {
    const act = deliveryActs.find((a) => a.id === docNo);
    openTab({
      id: docNo,
      title: `${docNo}: ${form.name}`,
      type: "delivery-act",
      module: "finance",
      activeLevel3Tab: "overview",
      documentData: act || {
        id: docNo,
        customer: form.name,
        customerTin: form.tin,
        contractNo: form.contractNo,
        totalAmount: debitAmount || 0,
      },
    });
  };

  const handleOpenWorkOrder = (order: any) => {
    const existingWo = productionQueue.find(
      (q) => q.id === order.docId || q.docNo === order.docId
    );
    openTab({
      id: order.docId,
      title: `${order.docId}: ${order.product}`,
      type: "work-order",
      module: "production",
      activeLevel3Tab: "overview",
      documentData: existingWo
        ? {
            ...existingWo,
            docNo: existingWo.docNo || existingWo.id,
          }
        : {
            docNo: order.docId,
            customer: form.name,
            product: order.product,
            quantity: order.orderedQty ?? order.quantity ?? 0,
            linkedWoId: order.workOrderRef,
            status: order.status,
          },
    });
  };

  const handleReorderWorkOrder = (order: any) => {
    const newWoId = `draft-wo-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];
    const deadlineDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const existingWo = productionQueue.find(
      (q) => q.id === order.docId || q.docNo === order.docId
    );

    openTab({
      id: newWoId,
      title: `Yangi: ${order.product}`,
      type: "work-order",
      module: "production",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        ...(existingWo || {}),
        id: newWoId,
        docNo: "",
        parentWorkOrderId: order.docId,
        isReorder: true,
        customer: form.name,
        customerTin: form.tin,
        product: order.product,
        quantity: order.orderedQty ?? order.quantity ?? existingWo?.quantity ?? 5000,
        unit: order.unit || existingWo?.unit || "pcs",
        status: "Draft",
        stage: "Queue",
        startDate: today,
        deadline: deadlineDate,
        sampleRequired: false,
        orderType: "Production",
      },
    });

    addNotification({
      title: "Qayta buyurtma yaratildi",
      description: `${order.docId} asosida yangi ${newWoId} buyurtmasi shakllantirildi.`,
      severity: "success",
    });
  };

  const navItems: DocumentNavItem[] = [
    {
      id: "overview",
      label: "Rekvizitlar va Shartnoma",
      icon: Building2,
    },
    {
      id: "settlements",
      label: "Akt Sverka",
      icon: Scale,
      badge: settlement?.ledger.length || 0,
      badgeClassName: closingBalance > 0 ? "text-rose-600 font-bold" : undefined,
    },
    {
      id: "orders",
      label: "Buyurtmalar va Zaxira",
      icon: ClipboardList,
      badge: customerStockQty > 0 ? `${customerStockQty.toLocaleString()} zaxira` : ordersCount,
      badgeClassName: customerStockQty > 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/70 border-emerald-400 font-semibold" : undefined,
    },
    {
      id: "tooling",
      label: "Shtansformalar",
      icon: Stamp,
      badge: toolingCount,
    },
  ];

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Standard 1C Document Header */}
        <DocumentHeader
          icon={Building2}
          title={form.name}
          docNo={isDraft ? "Yangi (Avtomatik)" : form.id}
          status={form.status}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateClientOrder}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">+ Yangi buyurtma</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPrintModalOpen(true)}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
                title="Akt Sverka chop etish"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Akt Sverka</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Saqlash</span>
              </Button>

              <Button
                size="sm"
                onClick={handleSaveAndClose}
                className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Saqlash va yopish</span>
              </Button>
            </>
          }
        />

        {/* Workspace Body: Standard Left DocumentSidebar + Right Main Viewport */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <DocumentSidebar
            sectionsLabel="Bo'limlar"
            items={navItems}
            activeId={activeTab}
            onSelect={(id) => setLevel3Tab(tab.id, id)}
            summary={
              <SidebarSummaryCard
                icon={Building2}
                title={form.name}
                subtitle={`INN: ${form.tin} • ${form.industry}`}
              >
                <InfoRow label="Shartnoma:" title={form.contractNo}>
                  <span className="font-mono text-[10px]">{form.contractNo}</span>
                </InfoRow>

                <InfoRow label="Valyuta:">
                  <Badge variant="secondary" className="text-[10px] h-4 font-mono font-bold">
                    {form.currency === "USD" ? "USD ($)" : "UZS (so'm)"}
                  </Badge>
                </InfoRow>

                <InfoRow label="Joriy Saldo:">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span
                      className={`font-mono font-bold text-xs ${
                        closingBalance > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : closingBalance < 0
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {form.currency === "USD" ? "$" : ""}
                      {Math.abs(closingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      {form.currency !== "USD" ? " so'm" : ""}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 h-3.5 ${
                        closingBalance > 0
                          ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950"
                          : closingBalance < 0
                          ? "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950"
                          : "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950"
                      }`}
                    >
                      {closingBalance > 0 ? "Qarz" : closingBalance < 0 ? "Avans" : "0.00"}
                    </Badge>
                  </div>
                </InfoRow>

                <InfoRow label="Tayyor Zaxira:">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span
                      className={`font-mono font-bold text-xs ${
                        customerStockQty > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {customerStockQty.toLocaleString()} dona
                    </span>
                    {customerStockQty > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 h-3.5 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 font-semibold"
                      >
                        Omborda
                      </Badge>
                    )}
                  </div>
                </InfoRow>

                <div className="pt-1.5 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLevel3Tab(tab.id, "settlements");
                      setIsPaymentOpen(true);
                    }}
                    className="h-6 w-full text-[10px] gap-1 bg-muted/60 hover:bg-muted text-foreground border-border shadow-xs cursor-pointer"
                  >
                    <CreditCard className="w-3 h-3 text-emerald-600" />
                    <span>+ To&apos;lov kiritish (Kirim)</span>
                  </Button>
                </div>
              </SidebarSummaryCard>
            }
            footer={
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Menejer:</span>
                  <span className="font-medium text-foreground truncate ml-1">{form.manager}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kontakt:</span>
                  <span className="font-medium text-foreground truncate ml-1">{form.contactPerson}</span>
                </div>
                {form.phone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground pt-0.5">
                    <Phone className="w-3 h-3 shrink-0 text-emerald-600" />
                    <span className="font-mono text-[10px] text-foreground">{form.phone}</span>
                  </div>
                )}
                {form.email && (
                  <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                    <Mail className="w-3 h-3 shrink-0 text-blue-600" />
                    <span className="font-mono text-[10px] text-foreground truncate">{form.email}</span>
                  </div>
                )}
              </div>
            }
          />

          {/* Right Main Viewport */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
            <TabsContent value="overview" className="flex-1 overflow-hidden m-0 flex flex-col">
              <CustomerOverviewTab
                form={form}
                onChange={handleFieldChange}
                settlement={settlement}
                onNavigateTab={(target) => setLevel3Tab(tab.id, target)}
                onOpenPaymentModal={() => {
                  setLevel3Tab(tab.id, "settlements");
                  setIsPaymentOpen(true);
                }}
                onCreateClientOrder={handleCreateClientOrder}
              />
            </TabsContent>

            <TabsContent value="settlements" className="flex-1 overflow-hidden m-0 flex flex-col">
              <CustomerSettlementsTab
                customer={form}
                settlement={settlement}
                isPaymentOpen={isPaymentOpen}
                setIsPaymentOpen={setIsPaymentOpen}
                onOpenDeliveryAct={handleOpenDeliveryAct}
              />
            </TabsContent>

            <TabsContent value="orders" className="flex-1 overflow-hidden m-0 flex flex-col">
              <CustomerOrdersTab
                customer={form}
                onCreateClientOrder={handleCreateClientOrder}
                onOpenWorkOrder={handleOpenWorkOrder}
                onReorderWorkOrder={handleReorderWorkOrder}
                onOpenDeliveryAct={handleOpenDeliveryAct}
              />
            </TabsContent>

            <TabsContent value="tooling" className="flex-1 overflow-hidden m-0 flex flex-col">
              <CustomerToolingTab customer={form} />
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* Official Printable Akt Sverka Dialog */}
      <AktSverkaPrintModal
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        customer={form}
        settlement={settlement}
      />
    </div>
  );
}
