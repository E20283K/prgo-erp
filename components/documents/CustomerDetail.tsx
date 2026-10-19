"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  useWorkspaceStore,
  DocumentTab,
  CrmCustomerRecord,
  CustomerContactPerson,
  CustomerContractRecord,
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
  if (customer.contracts && customer.contracts.length > 0) {
    return customer.contracts;
  }
  const defaultNo = customer.contractNo || "CON-2026-101";
  const numMatch = defaultNo.match(/\d+$/);
  const numPart = numMatch ? numMatch[0] : "101";
  return [
    {
      id: `${customer.id || "cust"}-cnt-2026`,
      contractNo: defaultNo,
      title: "Bosh yetkazib berish va poligrafiya shartnomasi",
      type: "annual",
      startDate: customer.contractDate || "2026-01-01",
      endDate: customer.contractExpiry || "2026-12-31",
      status: "active",
      isDefault: true,
      paymentTerms: customer.paymentTerms || "50% Advance / 50% Net 15",
      notes: "2026-moliyaviy yili uchun Didox va Soliq orqali tasdiqlangan bosh ramkali shartnoma.",
    },
    {
      id: `${customer.id || "cust"}-cnt-2025`,
      contractNo: `CON-2025-${numPart}`,
      title: "2025-yilgi mahsulot yetkazib berish shartnomasi",
      type: "annual",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      status: "expired",
      isDefault: false,
      paymentTerms: "100% Oldindan to'lov",
      notes: "Arxiv shartnoma. Barcha majburiyatlar va to'lovlar to'liq bajarilgan.",
    },
  ];
}

function ensureCustomerContacts(customer: Partial<CrmCustomerRecord>): CustomerContactPerson[] {
  if (customer.contacts && customer.contacts.length > 0) {
    return customer.contacts;
  }
  return [
    {
      id: `${customer.id || "cust"}-cont-1`,
      role: "director",
      roleLabel: "Bosh direktor",
      name: "Sherzod Toshmatov",
      phone: "+998 90 333-44-55",
      email: "director@client.uz",
      telegram: "sherzod_director",
      isPrimary: false,
      notes: "Shartnoma va strategik masalalar",
    },
    {
      id: `${customer.id || "cust"}-cont-2`,
      role: "accountant",
      roleLabel: "Bosh buxgalter",
      name: "Dilnoza Rahimova",
      phone: "+998 91 777-66-55",
      email: "finance@client.uz",
      telegram: "dilnoza_finance",
      isPrimary: false,
      notes: "To'lovlar, schyot-faktura va akt sverka",
    },
    {
      id: `${customer.id || "cust"}-cont-3`,
      role: "procurement",
      roleLabel: "Ta'minot / Buyurtmachi",
      name: customer.contactPerson || "Kamola Rustamova",
      phone: customer.phone || "+998 93 551-20-10",
      email: customer.email || "supply@client.uz",
      telegram: "kamola_procurement",
      isPrimary: true,
      notes: "Poligrafiya buyurtmalari, maketlar va tiraj",
    },
    {
      id: `${customer.id || "cust"}-cont-4`,
      role: "warehouse",
      roleLabel: "Ombor mudiri",
      name: "Jasur Aliyev",
      phone: "+998 99 770-88-99",
      email: "warehouse@client.uz",
      telegram: "jasur_ombor",
      isPrimary: false,
      notes: "Tayyor mahsulotni qabul qilish va ishonchnoma",
    },
  ];
}

export function CustomerDetail({ tab }: { tab: DocumentTab }) {
  const {
    crmCustomers,
    clientSettlements,
    deliveryActs,
    productionQueue,
    customerTooling,
    finishedGoods,
    upsertCustomer,
    upsertProductionQueueItem,
    setTabUnsaved,
    setLevel3Tab,
    openTab,
    closeTab,
    addNotification,
  } = useWorkspaceStore();

  const activeTab = tab.activeLevel3Tab || "overview";

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
      id: d.id || (tab.id.startsWith("CUST-") ? tab.id : `CUST-${Math.floor(100 + Math.random() * 899)}`),
      name: d.name || d.customer || "Alpha Media Group LLC",
      tin: d.tin || d.customerTin || "305841920",
      industry: d.industry || "Publishing & Packaging",
      contactPerson: d.contactPerson || "Azizbek Rahimov",
      phone: d.phone || "+998 90 123-45-67",
      email: d.email || "info@client.uz",
      contractNo: d.contractNo || `CON-2026-${Math.floor(100 + Math.random() * 899)}`,
      paymentTerms: d.paymentTerms || "50% Prepay / 50% Ship",
      manager: d.manager || "Elena Voronina",
      status: d.status === "VIP" || d.status === "Active" || d.status === "New" || d.status === "Blocked" ? d.status : "Active",
      legalAddress: d.legalAddress || "Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi 42",
      deliveryAddress: d.deliveryAddress || "Toshkent vil., Zangiota tumani, Ombor №3",
      bankName: d.bankName || "ATB Ipoteka Bank Bosh amaliyot filiali",
      bankAccount: d.bankAccount || "20208000900501234001",
      mfo: d.mfo || "00450",
      oked: d.oked || "18120",
      vatPayer: d.vatPayer ?? true,
      creditLimitUsd: d.creditLimitUsd ?? 10000,
      contractDate: d.contractDate || "2026-01-10",
      contractExpiry: d.contractExpiry || "2026-12-31",
      receivingHours: d.receivingHours || "Dush-Juma: 09:00 - 18:00 (Tushlik 13:00 - 14:00)",
      requiresPowerOfAttorney: d.requiresPowerOfAttorney ?? true,
      deliveryTransportNote: d.deliveryTransportNote || "Fura va Gazel bemalol kiradi, rampa bor",
      specialRequirements: d.specialRequirements || "Mijoz talablari bo'yicha sifat nazorati va qadoqlash",
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
    const cleanName = form.name.replace(" LLC", "").replace(" MCHJ", "").trim().toLowerCase();
    return (
      clientSettlements.find(
        (s) =>
          s.customer.toLowerCase() === form.name.toLowerCase() ||
          s.customer.toLowerCase().includes(cleanName) ||
          form.name.toLowerCase().includes(s.customer.toLowerCase()) ||
          (form.tin && s.customerTin === form.tin)
      ) || null
    );
  }, [clientSettlements, form.name, form.tin]);

  // Customer Orders count (Work Orders + Delivery Acts)
  const ordersCount = useMemo(() => {
    const cleanName = form.name.replace(" LLC", "").replace(" MCHJ", "").trim().toLowerCase();
    const acts = deliveryActs.filter(
      (a) =>
        a.customer.toLowerCase().includes(cleanName) ||
        form.name.toLowerCase().includes(a.customer.toLowerCase())
    ).length;
    const queues = productionQueue.filter(
      (q) =>
        q.customer.toLowerCase().includes(cleanName) ||
        form.name.toLowerCase().includes(q.customer.toLowerCase())
    ).length;
    return acts + (queues > 0 ? queues : 1);
  }, [deliveryActs, productionQueue, form.name]);

  // Customer Tooling count
  const toolingCount = useMemo(() => {
    const cleanName = form.name.replace(" LLC", "").replace(" MCHJ", "").trim().toLowerCase();
    const matched = customerTooling.filter((t) => {
      if (t.customerId && t.customerId === form.id) return true;
      if (!t.customerName) return false;
      const tName = t.customerName.toLowerCase();
      return (
        tName === cleanName ||
        tName.includes(cleanName) ||
        cleanName.includes(tName)
      );
    });
    return matched.length > 0 ? matched.length : 1;
  }, [customerTooling, form.id, form.name]);

  // Customer Dedicated Finished Goods Stock (Zaxira)
  const customerStockQty = useMemo(() => {
    const cleanName = form.name.replace(" LLC", "").replace(" MCHJ", "").trim().toLowerCase();
    const matched = finishedGoods.filter((fg) => {
      if (fg.customerId && fg.customerId === form.id) return true;
      if (form.tin && fg.customerTin === form.tin) return true;
      const fgName = fg.customerName.toLowerCase();
      return (
        fgName === cleanName ||
        fgName.includes(cleanName) ||
        cleanName.includes(fgName)
      );
    });
    return matched.reduce((sum, item) => sum + (item.stockQty || 0), 0);
  }, [finishedGoods, form.id, form.name, form.tin]);

  const closingBalance = settlement?.closingBalance ?? 0;

  // Actions
  const handleSave = () => {
    upsertCustomer(form);
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Mijoz kartochkasi saqlandi",
      description: `${form.name} (STIR: ${form.tin}) rekvizitlari muvaffaqiyatli yangilandi.`,
      severity: "success",
      link: { module: "crm", subModule: "customers" },
    });
  };

  const handleSaveAndClose = () => {
    upsertCustomer(form);
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Mijoz kartochkasi saqlandi",
      description: `${form.name} ma'lumotlari bazaga yozildi.`,
      severity: "success",
      link: { module: "crm", subModule: "customers" },
    });
    closeTab(tab.id);
  };

  const handleCreateClientOrder = () => {
    upsertCustomer(form);
    const newWoId = `WO-${String(Math.floor(100 + Math.random() * 899)).padStart(5, "0")}`;
    const newCoId = `CO-${String(Math.floor(10 + Math.random() * 89)).padStart(5, "0")}`;

    // Add directly to production queue so it reflects instantly across the ERP
    upsertProductionQueueItem({
      id: newWoId,
      clientOrderId: newCoId,
      customer: form.name,
      product: `${form.name} — Yangi buyurtma`,
      quantity: 5000,
      unit: "pcs",
      pressMachine: "Heidelberg Speedmaster XL 106",
      department: "Offset Printing",
      priority: "Normal",
      stage: "Queue",
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    });

    openTab({
      id: newWoId,
      title: `${newWoId}: ${form.name}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newWoId,
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
    openTab({
      id: order.docId,
      title: `${order.docId}: ${order.product}`,
      type: "work-order",
      module: "production",
      activeLevel3Tab: "overview",
      documentData: {
        docNo: order.docId,
        customer: form.name,
        product: order.product,
        quantity: order.quantity,
        linkedWoId: order.workOrderRef,
        status: order.status,
      },
    });
  };

  const handleReorderWorkOrder = (order: any) => {
    const newWoId = `WO-00${Math.floor(300 + Math.random() * 699)}`;
    const today = new Date().toISOString().split("T")[0];
    const deadlineDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    openTab({
      id: newWoId,
      title: `${newWoId}: ${order.product}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newWoId,
        parentWorkOrderId: order.docId,
        isReorder: true,
        customer: form.name,
        customerTin: form.tin,
        product: order.product,
        quantity: order.quantity || 5000,
        unit: order.unit || "pcs",
        status: "Draft",
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
          docNo={form.id}
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
                      ${Math.abs(closingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
