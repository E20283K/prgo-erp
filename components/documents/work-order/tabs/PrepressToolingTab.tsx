"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Stamp,
  Layers,
  Printer,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Trash2,
  Edit2,
  Edit3,
  Wrench,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Copy,
  MousePointerClick,
  Warehouse,
  Search,
  Check,
  Building2,
  MapPin,
  Image as ImageIcon,
  FileText,
  Upload,
  Download,
  Eye,
  X,
} from "lucide-react";
import {
  WorkOrderToolingItem,
  ToolingCategory,
  ToolingStatus,
  WorkOrderFormData,
  OrderAttachment,
} from "../types";
import { ComboboxSelect, type ComboboxOption } from "@/components/ui/combobox";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useShallow } from "zustand/react/shallow";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface PrepressToolingTabProps {
  formData: WorkOrderFormData;
  docNo: string;
  isOperator?: boolean;
  onUpdateTooling: (items: WorkOrderToolingItem[]) => void;
  onMarkUnsaved: () => void;
  orderAttachments?: OrderAttachment[];
  setOrderAttachments?: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
}

const CATEGORY_CONFIG: Record<
  ToolingCategory,
  { label: string; orderType: string }
> = {
  ctp_plates: {
    label: "CTP Metall Forma",
    orderType: "ctp_plates",
  },
  die_cutting: {
    label: "Kesish Shtansformasi",
    orderType: "die_tooling",
  },
  foil_cliche: {
    label: "Folga Klishesi (Jez)",
    orderType: "cliche",
  },
  emboss_cliche: {
    label: "Kongrev Klishesi (Magniy)",
    orderType: "cliche",
  },
  varnish_plate: {
    label: "Lak Trafareti / Polimer",
    orderType: "outsourcing",
  },
  flexo_polymer: {
    label: "Flexo Polimer Forma",
    orderType: "ctp_plates",
  },
};

const STATUS_CONFIG: Record<
  ToolingStatus,
  { label: string }
> = {
  Draft: { label: "Qoralama" },
  Ordered: { label: "Buyurtma berildi" },
  In_Production: { label: "Tayyorlanmoqda" },
  Ready: { label: "Tayyor" },
  Delivered: { label: "Yetkazib berildi" },
  Mounted: { label: "Stanokda" },
};

const FAULT_PARTY_CONFIG: Record<string, string> = {
  prepress: "Prepress xatosi (Dizayn/Spusk)",
  production: "Ishlab chiqarish (Sexdagi brak)",
  client: "Mijoz o'zgartirishi",
  supplier: "Ta'minotchi / Pudratchi defekti",
};

const FALLBACK_CATALOG_DIES = [
  { id: "die-01", code: "DIE-BX-180x240", name: "Standart quti shtampi (FEFCO 0427)", dieType: "flatbed", widthMm: 180, heightMm: 240, location: "SHELF-A1", status: "available" },
  { id: "die-02", code: "DIE-RECT-50x90", name: "Vizitka / Birka shtampi (To'g'ri to'rtburchak)", dieType: "flatbed", widthMm: 50, heightMm: 90, location: "SHELF-B3", status: "available" },
  { id: "die-03", code: "DIE-ROTR-75x120", name: "Aylanma yorliq pichog'i (Z=96)", dieType: "rotary_magnetic", widthMm: 75, heightMm: 120, location: "RACK-CYL-04", status: "available" },
  { id: "die-04", code: "KL-FOIL-LOGO-01", name: "Zarhal (Hot Foil) Logo Jez Klishesi", dieType: "hot_stamp", widthMm: 60, heightMm: 40, location: "BOX-FOIL-02", status: "available" },
  { id: "die-05", code: "KL-EMB-MEDAL-02", name: "Kongrev Bo'rtma Magniy Klishesi", dieType: "embossing", widthMm: 50, heightMm: 50, location: "BOX-EMB-01", status: "available" },
];

export function PrepressToolingTab({
  formData,
  docNo,
  isOperator,
  onUpdateTooling,
  onMarkUnsaved,
  orderAttachments,
  setOrderAttachments,
}: PrepressToolingTabProps) {
  const {
    suppliers,
    diesTooling,
    theme,
    addNotification,
    openTab,
  } = useWorkspaceStore(
    useShallow((s) => ({
      suppliers: s.suppliers,
      diesTooling: s.diesTooling,
      theme: s.theme,
      addNotification: s.addNotification,
      openTab: s.openTab,
    }))
  );
  const {
    loadSuppliers,
    loadDiesToolingAsync,
  } = useWorkspaceStore.getState();
  const isDark = theme === "dark";

  const handleOpenSupplierOrders = useCallback(
    (supplierId?: string, supplierName?: string) => {
      if (!supplierId || supplierId === "in_house") return;
      openTab({
        id: supplierId,
        title: supplierName || "Ta'minotchi",
        type: "supplier",
        module: "crm",
        activeLevel3Tab: "orders",
      });
    },
    [openTab]
  );

  const handleOpenToolingRegistry = useCallback(() => {
    openTab({
      id: "tooling-orders",
      title: "Qolip va CTP buyurtmalari",
      type: "registry",
      module: "production",
      documentData: {
        workOrderNo: docNo,
        viewMode: "deficits",
      },
    });
  }, [openTab, docNo]);

  useEffect(() => {
    const s = useWorkspaceStore.getState();
    if (s.suppliers.length === 0 && s.loadSuppliers) s.loadSuppliers();
    if (s.diesTooling.length === 0 && s.loadDiesToolingAsync) s.loadDiesToolingAsync();
  }, []);

  const items = useMemo(() => formData.toolingItems || [], [formData.toolingItems]);
  const filteredItems = items;

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<WorkOrderToolingItem> | null>(null);
  const [fileError, setFileError] = useState(false);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const imageFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cadFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Catalog Picker state
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>("ALL");

  const catalogDies = useMemo(() => {
    return diesTooling && diesTooling.length > 0 ? diesTooling : FALLBACK_CATALOG_DIES;
  }, [diesTooling]);

  const filteredCatalogDies = useMemo(() => {
    const list = catalogDies;
    const search = catalogSearch.toLowerCase().trim();
    return list.filter((tool: any) => {
      const matchCat =
        catalogCategoryFilter === "ALL" ||
        (catalogCategoryFilter === "die_cutting" &&
          (tool.dieType === "flatbed" ||
            tool.dieType === "rotary_magnetic" ||
            tool.dieType === "solid_rotary")) ||
        (catalogCategoryFilter === "foil_cliche" && tool.dieType === "hot_stamp") ||
        (catalogCategoryFilter === "emboss_cliche" && tool.dieType === "embossing");

      const matchSearch =
        !search ||
        (tool.code && tool.code.toLowerCase().includes(search)) ||
        (tool.name && tool.name.toLowerCase().includes(search)) ||
        (tool.location && tool.location.toLowerCase().includes(search)) ||
        (tool.customerName && tool.customerName.toLowerCase().includes(search));

      return matchCat && matchSearch;
    });
  }, [catalogDies, catalogSearch, catalogCategoryFilter]);

  const handleAttachCatalogDie = (tool: any) => {
    const category: ToolingCategory =
      tool.dieType === "hot_stamp"
        ? "foil_cliche"
        : tool.dieType === "embossing"
        ? "emboss_cliche"
        : "die_cutting";

    const newItem: WorkOrderToolingItem = {
      id: `TL-EXIST-${tool.id || Date.now()}`,
      category,
      name: `${tool.code} — ${tool.name}`,
      specDetails: `Razmer: ${tool.widthMm || 0}×${tool.heightMm || 0} mm, Joyi: ${tool.location || "Ombor stellaji"}`,
      quantity: 1,
      unit: "dona",
      estimatedCost: 0,
      actualCost: 0,
      currency: formData.currency || "UZS",
      status: "Ready",
      supplierName: tool.customerName ? `Mijoz (${tool.customerName})` : "Mavjud inventar (Ombor)",
      location: tool.location || "",
      notes: `Katalogdan biriktirildi. Kodi: ${tool.code}, Shakli: ${tool.shape || "standart"}`,
      createdAt: new Date().toISOString(),
    };

    onUpdateTooling([...items, newItem]);
    onMarkUnsaved();
    setIsCatalogPickerOpen(false);

    addNotification({
      title: "Mavjud jihoz biriktirildi",
      description: `${tool.code}: ${tool.name} buyurtmaga 0 so'm bilan 'Tayyor' holatida biriktirildi.`,
      severity: "success",
    });
  };



  // Statistics
  const stats = useMemo(() => {
    const totalCount = items.length;
    const ctpCount = items
      .filter((i) => i.category === "ctp_plates")
      .reduce((sum, i) => sum + i.quantity, 0);
    const dieCount = items.filter((i) => i.category === "die_cutting").length;
    const clicheCount = items.filter(
      (i) => i.category === "foil_cliche" || i.category === "emboss_cliche"
    ).length;
    const readyCount = items.filter(
      (i) => i.status === "Ready" || i.status === "Delivered" || i.status === "Mounted"
    ).length;
    const totalCost = items.reduce(
      (sum, i) => sum + (i.actualCost !== undefined ? i.actualCost : i.estimatedCost || 0),
      0
    );

    return { totalCount, ctpCount, dieCount, clicheCount, readyCount, totalCost };
  }, [items]);

  // Hover Magnified Artwork / Image Preview
  const [hoveredPreview, setHoveredPreview] = useState<{
    url: string;
    x: number;
    y: number;
    title?: string;
    subtitle?: string;
  } | null>(null);
  const mouseCoordsRef = React.useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const getCursorCardPosition = useCallback(
    (clientX: number, clientY: number, cardWidth = 340, cardHeight = 340) => {
      const margin = 16;
      const vpW = typeof window !== "undefined" ? window.innerWidth : 1920;
      const vpH = typeof window !== "undefined" ? window.innerHeight : 1080;

      let x = clientX + margin;
      let y = clientY + margin;

      if (x + cardWidth > vpW - margin) {
        x = clientX - cardWidth - margin;
      }
      if (y + cardHeight > vpH - margin) {
        y = clientY - cardHeight - margin;
      }
      if (x < margin) x = margin;
      if (y < margin) y = margin;

      return { x, y };
    },
    []
  );

  // Columns definition
  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "image", title: "Rasm", width: 68, icon: GridColumnIcon.HeaderImage },
    { id: "category", title: "Toifasi", width: 165, icon: GridColumnIcon.HeaderSingleValue },
    { id: "name", title: "Jihoz / Qolip Nomi", width: 260, icon: GridColumnIcon.HeaderString },
    { id: "specDetails", title: "Spetsifikatsiya / Format", width: 240, icon: GridColumnIcon.HeaderString },
    { id: "location", title: "Stellaj / Joyi", width: 105, icon: GridColumnIcon.HeaderString },
    { id: "quantity", title: "Miqdori", width: 85, icon: GridColumnIcon.HeaderNumber },
    { id: "supplierName", title: "Pudratchi / Ta'minotchi", width: 165, icon: GridColumnIcon.HeaderReference },
    { id: "attachments", title: "Chizma & Fayl", width: 110, icon: GridColumnIcon.HeaderReference },
    { id: "purchaseOrderNo", title: "Xarid PO №", width: 120, icon: GridColumnIcon.HeaderReference },
    { id: "cost", title: `Summasi (${formData.currency || "UZS"})`, width: 135, icon: GridColumnIcon.HeaderNumber },
    { id: "status", title: "Holati", width: 130, icon: GridColumnIcon.HeaderSingleValue },
  ]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === column.id ? { ...c, width: newSize } : c))
    );
  }, []);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = filteredItems[row];
      const column = columns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "image") {
        const directImg =
          item.imageUrl ||
          formData.photoUrl ||
          (Array.isArray(formData.photoUrls) && formData.photoUrls.length > 0
            ? formData.photoUrls[0]
            : "");
        const data = directImg ? [directImg] : [];
        return {
          kind: GridCellKind.Image,
          data,
          displayData: data,
          allowOverlay: false,
          rounding: 4,
          contentAlign: "center",
        };
      }

      if (column.id === "category") {
        const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.ctp_plates;
        return {
          kind: GridCellKind.Text,
          data: cat.label,
          displayData: cat.label,
          allowOverlay: false,
          themeOverride: {
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      if (column.id === "name") {
        const nameDisplay = `${item.isRemake ? "[Remake] " : ""}${item.phase === "sample" ? "[Namuna] " : ""}${item.name}`;
        return {
          kind: GridCellKind.Text,
          data: nameDisplay,
          displayData: nameDisplay,
          allowOverlay: false,
          themeOverride: {
            textDark: item.isRemake
              ? isDark ? "#f87171" : "#b91c1c"
              : isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 12px sans-serif",
          },
        };
      }

      if (column.id === "quantity") {
        const qtyDisplay = `${item.quantity} ${item.unit || "dona"}`;
        return {
          kind: GridCellKind.Text,
          data: qtyDisplay,
          displayData: qtyDisplay,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            baseFontStyle: "600 11px monospace",
          },
        };
      }

      if (column.id === "supplierName") {
        const sName = item.supplierName || "—";
        return {
          kind: GridCellKind.Text,
          data: sName,
          displayData: sName,
          allowOverlay: false,
        };
      }

      if (column.id === "location") {
        const loc = item.location || "—";
        return {
          kind: GridCellKind.Text,
          data: loc,
          displayData: loc,
          allowOverlay: false,
          themeOverride: loc !== "—"
            ? { textDark: isDark ? "#38bdf8" : "#0284c7", baseFontStyle: "500 11px monospace" }
            : undefined,
        };
      }

      if (column.id === "attachments") {
        const hasImg = Boolean(item.imageUrl);
        const hasFile = Boolean(item.fileUrl || item.fileName);
        let label = "—";
        if (hasImg && hasFile) label = "Rasm + CAD";
        else if (hasImg) label = "Fotosurat";
        else if (hasFile) label = item.fileName ? (item.fileName.length > 14 ? item.fileName.slice(0, 11) + "..." : item.fileName) : "CAD fayl";

        return {
          kind: GridCellKind.Text,
          data: label,
          displayData: label,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: (hasImg || hasFile)
            ? { textDark: isDark ? "#a78bfa" : "#7c3aed", baseFontStyle: "bold 11px sans-serif" }
            : undefined,
        };
      }

      if (column.id === "purchaseOrderNo") {
        const hasPo = Boolean(item.purchaseOrderNo);
        const po = item.purchaseOrderNo || "— (Kutilmoqda)";
        return {
          kind: GridCellKind.Text,
          data: po,
          displayData: po,
          allowOverlay: false,
          themeOverride: hasPo
            ? { textDark: isDark ? "#4ade80" : "#15803d", baseFontStyle: "bold 11px monospace" }
            : { textDark: isDark ? "#71717a" : "#a1a1aa", baseFontStyle: "italic 11px sans-serif" },
        };
      }

      if (column.id === "cost") {
        const val = item.actualCost !== undefined ? item.actualCost : item.estimatedCost || 0;
        const display = `${val.toLocaleString("uz-UZ")} ${item.currency || formData.currency || "UZS"}`;
        return {
          kind: GridCellKind.Text,
          data: display,
          displayData: display,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "600 12px monospace",
          },
        };
      }

      if (column.id === "status") {
        const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.Draft;
        let color = isDark ? "#a1a1aa" : "#71717a";
        if (item.status === "Ready" || item.status === "Delivered" || item.status === "Mounted") {
          color = isDark ? "#4ade80" : "#15803d";
        } else if (item.status === "Ordered" || item.status === "In_Production") {
          color = isDark ? "#60a5fa" : "#2563eb";
        }

        return {
          kind: GridCellKind.Text,
          data: st.label,
          displayData: st.label,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      const strVal = String((item as any)[String(column.id)] ?? "");
      return {
        kind: GridCellKind.Text,
        data: strVal,
        displayData: strVal,
        allowOverlay: false,
      };
    },
    [filteredItems, columns, isDark, formData.currency, formData.photoUrl, formData.photoUrls]
  );

  // Hover item callback for magnified proof artwork
  const onItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      if (args.kind === "cell") {
        const [col, row] = args.location;
        const column = columns[col];
        if (column?.id === "image") {
          const item = filteredItems[row];
          if (item) {
            const img =
              item.imageUrl ||
              formData.photoUrl ||
              (Array.isArray(formData.photoUrls) && formData.photoUrls.length > 0
                ? formData.photoUrls[0]
                : null);
            if (img) {
              const { x, y } = getCursorCardPosition(
                mouseCoordsRef.current.x,
                mouseCoordsRef.current.y
              );
              setHoveredPreview({
                url: img,
                x,
                y,
                title: item.name,
                subtitle: `${docNo || "Buyurtma"} • ${CATEGORY_CONFIG[item.category]?.label || item.category}`,
              });
              return;
            }
          }
        }
      }
      setHoveredPreview(null);
    },
    [columns, filteredItems, formData.photoUrl, formData.photoUrls, docNo, getCursorCardPosition]
  );

  const selectedItem = useMemo(() => {
    const selectedRows = selection.rows.toArray();
    if (selectedRows.length === 0) return null;
    return filteredItems[selectedRows[0]] || null;
  }, [selection, filteredItems]);



  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addNotification({
        title: "Xatolik",
        description: "Faqat rasm fayllari (JPG, PNG, WEBP) qabul qilinadi.",
        severity: "error",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setEditingItem((prev) => ({ ...prev, imageUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCadFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setEditingItem((prev) => ({
          ...prev,
          fileUrl: dataUrl,
          fileName: file.name,
        }));
        setFileError(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Add / Edit tooling save
  const handleSaveToolingItem = async () => {
    if (!editingItem?.name?.trim()) {
      addNotification({
        title: "Xatolik",
        description: "Iltimos, jihoz nomini kiriting!",
        severity: "error",
      });
      return;
    }

    // Validation: tooling items must have an attached file if not in Draft status
    const isDraft = !editingItem.status || editingItem.status === "Draft";
    const hasFile = Boolean(editingItem.fileUrl || editingItem.fileName);
    if (!isDraft && !hasFile) {
      setFileError(true);
      addNotification({
        title: "Fayl biriktirilmagan",
        description: "Buyurtma berish uchun jihoz chizma faylini (PDF/DXF/AI) biriktirish shart",
        severity: "error",
      });
      return;
    }

    const targetId = editingItem.id || `TL-${Date.now()}`;
    const targetItem: WorkOrderToolingItem = {
      id: targetId,
      category: editingItem.category || "ctp_plates",
      name: editingItem.name,
      specDetails: editingItem.specDetails || "",
      quantity: Number(editingItem.quantity) || 1,
      unit: editingItem.unit || "dona",
      estimatedCost: Number(editingItem.estimatedCost) || 0,
      actualCost: editingItem.actualCost,
      currency: editingItem.currency || formData.currency || "UZS",
      status: (editingItem.status as ToolingStatus) || "Draft",
      supplierId: editingItem.supplierId,
      supplierName: editingItem.supplierName,
      purchaseOrderId: editingItem.purchaseOrderId,
      purchaseOrderNo: editingItem.purchaseOrderNo,
      location: editingItem.location,
      imageUrl: editingItem.imageUrl,
      fileUrl: editingItem.fileUrl,
      fileName: editingItem.fileName,
      notes: editingItem.notes,
      isRemake: editingItem.isRemake || false,
      remakeReason: editingItem.remakeReason,
      faultParty: editingItem.faultParty || "none",
      phase: editingItem.phase || "production",
      createdAt: editingItem.createdAt || new Date().toISOString(),
    };

    let updatedList: WorkOrderToolingItem[];
    if (editingItem.id) {
      updatedList = items.map((it) => (it.id === editingItem.id ? targetItem : it));
    } else {
      updatedList = [...items, targetItem];
    }

    onUpdateTooling(updatedList);

    // Live Sync with "Files & Documents" tab
    if (setOrderAttachments) {
      setOrderAttachments((prev) => {
        const imgAttId = `att-tool-img-${targetId}`;
        const fileAttId = `att-tool-file-${targetId}`;
        const remaining = prev.filter((att) => att.id !== imgAttId && att.id !== fileAttId);
        const newAtts: OrderAttachment[] = [];

        if (targetItem.imageUrl) {
          newAtts.push({
            id: imgAttId,
            name: `[Jihoz: ${targetItem.name}] Foto`,
            size: "Jihoz rasmi",
            type: "image/jpeg",
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            isImage: true,
            category: "proofs",
            url: targetItem.imageUrl,
          });
        }

        if (targetItem.fileUrl) {
          const ext = targetItem.fileName ? targetItem.fileName.split(".").pop()?.toLowerCase() : "cad";
          let cat: "dieline" | "artwork" | "proofs" | "docs" = "dieline";
          if (["ai", "eps", "cdr"].includes(ext || "")) cat = "artwork";
          else if (["jpg", "jpeg", "png", "webp"].includes(ext || "")) cat = "proofs";
          else if (["pdf", "dxf", "cf2", "ard"].includes(ext || "")) cat = "dieline";

          newAtts.push({
            id: fileAttId,
            name: `[Chizma: ${targetItem.name}] ${targetItem.fileName || "dieline.pdf"}`,
            size: "Texnik chizma",
            type: ext ? ext.toUpperCase() : "CAD",
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            isImage: Boolean(targetItem.fileUrl.startsWith("data:image/") || targetItem.fileName?.match(/\.(png|jpe?g|webp|svg)$/i)),
            category: cat,
            url: targetItem.fileUrl,
          });
        }

        return [...newAtts, ...remaining];
      });
    }

    onMarkUnsaved();
    setIsAddEditOpen(false);
    setEditingItem(null);
  };

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<WorkOrderToolingItem | null>(null);

  const handleDeleteItem = (id: string) => {
    const target = items.find((it) => it.id === id) || null;
    if (target) {
      setDeleteConfirmItem(target);
    }
  };

  const confirmDeleteItem = () => {
    if (!deleteConfirmItem) return;
    const id = deleteConfirmItem.id;
    const updated = items.filter((it) => it.id !== id);
    onUpdateTooling(updated);
    if (setOrderAttachments) {
      const imgAttId = `att-tool-img-${id}`;
      const fileAttId = `att-tool-file-${id}`;
      setOrderAttachments((prev) => prev.filter((att) => att.id !== imgAttId && att.id !== fileAttId));
    }
    onMarkUnsaved();
    setDeleteConfirmItem(null);
  };

  const handleUpdateItemStatus = (item: WorkOrderToolingItem, newStatus: ToolingStatus) => {
    const updated = items.map((it) => (it.id === item.id ? { ...it, status: newStatus } : it));
    onUpdateTooling(updated);
    onMarkUnsaved();

    // If linked to supplier order, sync status with backend
    if (item.supplierId && item.purchaseOrderId && item.supplierId !== "in_house") {
      fetch(`/api/v1/crm/suppliers/${encodeURIComponent(item.supplierId)}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.purchaseOrderId,
          status: newStatus,
        }),
      }).catch((err) => console.error("Supplier order sync error:", err));
    }
  };

  // Cell activated (double-click) opens editor or jumps to supplier
  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      const target = filteredItems[row];
      const column = columns[col];
      if (!target) return;

      if (column?.id === "image") {
        const img =
          target.imageUrl ||
          formData.photoUrl ||
          (Array.isArray(formData.photoUrls) && formData.photoUrls.length > 0
            ? formData.photoUrls[0]
            : null);
        if (img) {
          setActivePreviewImage(img);
          return;
        }
      }

      if (
        (column?.id === "supplierName" || column?.id === "purchaseOrderNo") &&
        target.supplierId &&
        target.supplierId !== "in_house"
      ) {
        handleOpenSupplierOrders(target.supplierId, target.supplierName);
        return;
      }

      if (column?.id === "purchaseOrderNo" && !target.purchaseOrderNo) {
        handleOpenToolingRegistry();
        return;
      }

      setEditingItem(target);
      setIsAddEditOpen(true);
    },
    [filteredItems, columns, handleOpenSupplierOrders, handleOpenToolingRegistry]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-background select-text">
      {/* 1. Header Toolbar (Matches BomMaterialsGrid style) */}
      <div className="h-9 px-3 py-1 bg-card border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Add Tooling Primary Action */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  className="h-6.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Jihoz qo&apos;shish</span>
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-56 text-xs">
              <DropdownMenuItem
                onClick={() => {
                  const isDraftDocNo = !docNo || docNo.startsWith("draft-") || docNo.startsWith("temp-");
                  const displayDocNo = !isDraftDocNo ? docNo : (formData.product ? formData.product : "");
                  setEditingItem({
                    category: "ctp_plates",
                    name: displayDocNo ? `${displayDocNo} CTP Metall Forma Komplekti` : "CTP Metall Forma Komplekti",
                    specDetails: `Format: ${formData.pressSheetW || 700}×${formData.pressSheetH || 1000} mm, CMYK 4 rang`,
                    quantity: 4,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 25 : 300000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>CTP metall forma</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "die_cutting",
                    name: `${formData.product || "Mahsulot"} Kesish Shtampi`,
                    specDetails: `Format: ${formData.width || 700}×${formData.height || 1000} mm (Tekis shtansforma, pichoq 23.8 mm)`,
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 65 : 800000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-amber-600" />
                <span>Kesish shtampi (Die)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "foil_cliche",
                    name: `${formData.product || "Mahsulot"} Zarhal Klishesi`,
                    specDetails: "Material: Latun (Jez 3mm), Termo-folga",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 30 : 350000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
                <span>Folga klishesi (Jez)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "emboss_cliche",
                    name: `${formData.product || "Mahsulot"} Kongrev Klishesi`,
                    specDetails: "Material: Magniy 4mm (Kongrev/Bo'rtma)",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 25 : 300000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-purple-600" />
                <span>Kongrev klishesi (Magniy)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  const isDraftDocNo = !docNo || docNo.startsWith("draft-") || docNo.startsWith("temp-");
                  const displayDocNo = !isDraftDocNo ? docNo : (formData.product ? formData.product : "");
                  setEditingItem({
                    category: "flexo_polymer",
                    name: displayDocNo ? `${displayDocNo} Flexo Polimer Klishe Komplekti` : "Flexo Polimer Klishe Komplekti",
                    specDetails: `Format: ${formData.width || 330} mm, qalinligi 1.14 mm / 1.70 mm, CMYK`,
                    quantity: 4,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 40 : 450000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-600" />
                <span>Flexo polimer klishe</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setIsCatalogPickerOpen(true)}
                className="gap-2 cursor-pointer font-medium text-blue-600 dark:text-blue-400"
              >
                <Warehouse className="w-3.5 h-3.5" />
                <span>Mavjud katalogdan tanlash...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quick Catalog Picker Button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={() => setIsCatalogPickerOpen(true)}
                  variant="outline"
                  size="sm"
                  className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0 text-blue-600 dark:text-blue-400 border-blue-500/30"
                >
                  <Warehouse className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">Katalogdan biriktirish</span>
                </Button>
              }
            />
            <TooltipContent side="bottom" sideOffset={4} className="text-xs">
              Mavjud shtamp &amp; klishelar bazasidan biriktirish (0 so&apos;m)
            </TooltipContent>
          </Tooltip>

          {/* Centralized Tooling & CTP Orders Registry Navigation */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={handleOpenToolingRegistry}
                  variant="outline"
                  size="sm"
                  className="h-6.5 px-2 text-xs font-medium gap-1.5 rounded cursor-pointer shrink-0 text-primary border-primary/30 hover:bg-primary/5"
                >
                  <Stamp className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Qolip &amp; CTP buyurtmalari</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </Button>
              }
            />
            <TooltipContent side="bottom" sideOffset={4} className="text-xs">
              Qoliplar va CTP buyurtmalari markaziy reestrini ochish
            </TooltipContent>
          </Tooltip>

          {/* Row Actions when selected */}
          {selectedItem && (
            <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={() => {
                        setEditingItem(selectedItem);
                        setIsAddEditOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span className="hidden sm:inline">Tahrirlash</span>
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                  Jihozni tahrirlash
                </TooltipContent>
              </Tooltip>

              {/* Order in Central Registry Shortcut */}
              {!selectedItem.purchaseOrderNo && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        onClick={handleOpenToolingRegistry}
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0 text-primary border-primary/30 hover:bg-primary/5"
                      >
                        <Stamp className="w-3 h-3 text-primary" />
                        <span className="hidden sm:inline">Reestrda buyurtma berish</span>
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                    Qoliplar va CTP buyurtmalari modulida rasmiy PO ochish
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Supplier / PO Navigation Button */}
              {selectedItem.supplierId && selectedItem.supplierId !== "in_house" && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        onClick={() => handleOpenSupplierOrders(selectedItem.supplierId, selectedItem.supplierName)}
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="hidden sm:inline">
                          {selectedItem.purchaseOrderNo || "Ta'minotchi"}
                        </span>
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                    {selectedItem.supplierName} buyurtmalarini ochish
                  </TooltipContent>
                </Tooltip>
              )}

              {selectedItem.imageUrl && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        onClick={() => setActivePreviewImage(selectedItem.imageUrl!)}
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0 text-blue-600 dark:text-blue-400 border-blue-500/30"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span className="hidden sm:inline">Rasm</span>
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                    Jihoz fotosuratini ko&apos;rish
                  </TooltipContent>
                </Tooltip>
              )}

              {selectedItem.fileUrl && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = selectedItem.fileUrl!;
                          a.download = selectedItem.fileName || "dieline.pdf";
                          a.click();
                        }}
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0 text-purple-600 dark:text-purple-400 border-purple-500/30"
                      >
                        <Download className="w-3 h-3" />
                        <span className="hidden sm:inline">CAD Fayl</span>
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                    CAD / Dieline chizmasini yuklab olish
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={() => handleDeleteItem(selectedItem.id)}
                      variant="ghost"
                      size="icon-sm"
                      className="h-6.5 w-6.5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                  Tanlanganni o&apos;chirish (Del)
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Right Financial & Quantity Summary (Matches BomMaterialsGrid style without category breakdown) */}
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0 pl-2 ml-auto whitespace-nowrap">
          <span className="text-muted-foreground">
            Jami: <strong className="text-foreground">{stats.totalCount} ta talab</strong>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            Tayyor: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.readyCount} ta</strong>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            Qiymati: <strong className="text-primary font-bold">{stats.totalCost.toLocaleString("uz-UZ")} {formData.currency || "UZS"}</strong>
          </span>
        </div>
      </div>

      {/* 2. Glide Data Grid with Context Menu Wrapping */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 min-h-0 w-full relative">
          <div
            className="w-full h-full"
            onKeyDown={(e) => {
              if (e.key === "Delete" && selectedItem) {
                e.preventDefault();
                handleDeleteItem(selectedItem.id);
              }
            }}
          >
            <DataEditor
              columns={columns}
              rows={filteredItems.length}
              getCellContent={getCellContent}
              onColumnResize={handleColumnResize}
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onItemHovered={onItemHovered}
              onCellContextMenu={(cell) => {
                const [, row] = cell;
                setSelection({
                  columns: CompactSelection.empty(),
                  rows: CompactSelection.fromSingleSelection(row),
                });
              }}
              onCellActivated={handleCellActivated}
              rowMarkers="both"
              freezeColumns={2}
              smoothScrollX
              smoothScrollY
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              width="100%"
              height="100%"
            />

            {/* Hover Magnified Artwork Preview */}
            {hoveredPreview && (
              <div
                style={{ left: `${hoveredPreview.x}px`, top: `${hoveredPreview.y}px` }}
                className="fixed z-50 pointer-events-none rounded-md bg-popover/95 backdrop-blur-xs border border-border shadow-2xl p-2 animate-in fade-in-0 zoom-in-95 duration-75 max-w-[340px] max-h-[360px] flex flex-col gap-1.5 overflow-hidden"
              >
                <img
                  src={hoveredPreview.url}
                  alt="Qolip / Buyurtma eskizi"
                  className="max-w-[320px] max-h-[280px] w-auto h-auto object-contain rounded border border-border/40 bg-background select-none"
                />
                {hoveredPreview.title && (
                  <div className="text-[11px] font-semibold text-foreground truncate max-w-[320px]">
                    {hoveredPreview.title}
                  </div>
                )}
                {hoveredPreview.subtitle && (
                  <div className="text-[10px] text-muted-foreground truncate max-w-[320px]">
                    {hoveredPreview.subtitle}
                  </div>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        {/* ─── Radix Context Menu: Add Tooling & Item Actions ─── */}
        <ContextMenuContent className="text-xs w-60">
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2 cursor-pointer font-semibold text-primary">
              <Plus className="w-3.5 h-3.5" />
              <span>Jihoz qo&apos;shish</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="text-xs w-56">
              <ContextMenuItem
                onClick={() => {
                  const isDraftDocNo = !docNo || docNo.startsWith("draft-") || docNo.startsWith("temp-");
                  const displayDocNo = !isDraftDocNo ? docNo : (formData.product ? formData.product : "");
                  setEditingItem({
                    category: "ctp_plates",
                    name: displayDocNo ? `${displayDocNo} CTP Metall Forma Komplekti` : "CTP Metall Forma Komplekti",
                    specDetails: `Format: ${formData.pressSheetW || 700}×${formData.pressSheetH || 1000} mm, CMYK`,
                    quantity: 4,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 25 : 300000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>CTP metall forma</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "die_cutting",
                    name: `${formData.product || "Mahsulot"} Kesish Shtampi`,
                    specDetails: `Format: ${formData.width || 700}×${formData.height || 1000} mm (Tekis shtansforma, pichoq 23.8 mm)`,
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 65 : 800000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-amber-600" />
                <span>Kesish shtampi (Die)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "foil_cliche",
                    name: `${formData.product || "Mahsulot"} Zarhal Klishesi`,
                    specDetails: "Material: Latun (Jez 3mm), Termo-folga",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 30 : 350000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
                <span>Folga klishesi (Jez)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "emboss_cliche",
                    name: `${formData.product || "Mahsulot"} Kongrev Klishesi`,
                    specDetails: "Material: Magniy 4mm (Kongrev/Bo'rtma)",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 25 : 300000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-purple-600" />
                <span>Kongrev klishesi (Magniy)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  const isDraftDocNo = !docNo || docNo.startsWith("draft-") || docNo.startsWith("temp-");
                  const displayDocNo = !isDraftDocNo ? docNo : (formData.product ? formData.product : "");
                  setEditingItem({
                    category: "flexo_polymer",
                    name: displayDocNo ? `${displayDocNo} Flexo Polimer Klishe Komplekti` : "Flexo Polimer Klishe Komplekti",
                    specDetails: `Format: ${formData.width || 330} mm, qalinligi 1.14 mm / 1.70 mm, CMYK`,
                    quantity: 4,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 40 : 450000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-600" />
                <span>Flexo polimer klishe</span>
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => {
                  const isDraftDocNo = !docNo || docNo.startsWith("draft-") || docNo.startsWith("temp-");
                  const displayDocNo = !isDraftDocNo ? docNo : (formData.product ? formData.product : "");
                  setEditingItem({
                    category: "ctp_plates",
                    name: displayDocNo ? `${displayDocNo} CTP Remake (Qayta chiqarish)` : "CTP Remake (Qayta chiqarish)",
                    specDetails: "Brak yoki matn xatosi sababli qayta chiqarish",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 10 : 75000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                    isRemake: true,
                    faultParty: "prepress",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer text-rose-600"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Remake / Qayta chiqarish</span>
              </ContextMenuItem>
              <DropdownMenuSeparator />

              <ContextMenuItem
                onClick={() => setIsCatalogPickerOpen(true)}
                className="gap-2 cursor-pointer font-medium text-blue-600 dark:text-blue-400"
              >
                <Warehouse className="w-3.5 h-3.5" />
                <span>Mavjud katalogdan biriktirish...</span>
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {/* Selected Row Actions */}
          {selectedItem && (
            <>
              {selectedItem.supplierId && selectedItem.supplierId !== "in_house" && (
                <ContextMenuItem
                  onClick={() => handleOpenSupplierOrders(selectedItem.supplierId, selectedItem.supplierName)}
                  className="gap-2 cursor-pointer font-medium text-emerald-600 dark:text-emerald-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ta&apos;minotchi kartochkasi ({selectedItem.supplierName})</span>
                </ContextMenuItem>
              )}

              {!selectedItem.purchaseOrderNo && (
                <ContextMenuItem
                  onClick={handleOpenToolingRegistry}
                  className="gap-2 cursor-pointer font-medium text-primary"
                >
                  <Stamp className="w-3.5 h-3.5" />
                  <span>Qoliplar va CTP modulida ochish</span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
                </ContextMenuItem>
              )}

              {/* Production Floor: Mark as Mounted when tool is on press */}
              {selectedItem.status === "Ready" && (
                <ContextMenuItem
                  onClick={() => handleUpdateItemStatus(selectedItem, "Mounted")}
                  className="gap-2 cursor-pointer font-medium text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Stanokda o&apos;rnatildi</span>
                </ContextMenuItem>
              )}

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => {
                  setEditingItem(selectedItem);
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Tahrirlash (F2 / Double-Click)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(selectedItem.name);
                }}
                className="gap-2 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Jihoz nomini nusxalash</span>
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => handleDeleteItem(selectedItem.id)}
                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yozuvni o&apos;chirish</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* 3. Add / Edit Tooling Item Modal */}
      <Dialog
        open={isAddEditOpen}
        onOpenChange={(open) => {
          setIsAddEditOpen(open);
          if (!open) setFileError(false);
        }}
      >
        <DialogContent className="sm:max-w-[680px] w-full p-5 text-xs max-h-[92vh] flex flex-col bg-card border-border">
          <DialogHeader className="gap-1 pb-2 border-b border-border shrink-0">
            <div className="flex items-center justify-between w-full pr-6">
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                <span>{editingItem?.id ? "Jihozni tahrirlash" : "Yangi texnologik jihoz qo'shish"}</span>
              </DialogTitle>
              {editingItem?.id && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium h-5 px-2",
                    editingItem.status === "Ready" || editingItem.status === "Delivered" || editingItem.status === "Mounted"
                      ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                      : editingItem.status === "Ordered" || editingItem.status === "In_Production"
                      ? "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10"
                      : "text-muted-foreground border-border bg-muted/30"
                  )}
                >
                  {STATUS_CONFIG[editingItem.status as ToolingStatus]?.label || "Kutilmoqda"}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {editingItem && (
            <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 text-xs">
              {/* Row 1: Category & Status */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Jihoz toifasi *</Label>
                  <Select
                    value={editingItem.category}
                    onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, category: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue>
                        {(val) => CATEGORY_CONFIG[val as ToolingCategory]?.label || val}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ctp_plates" className="text-xs">CTP Metall Forma (Offset)</SelectItem>
                      <SelectItem value="die_cutting" className="text-xs">Kesish Shtansformasi (Die-cutting)</SelectItem>
                      <SelectItem value="foil_cliche" className="text-xs">Folga Klishesi (Jez / Latun)</SelectItem>
                      <SelectItem value="emboss_cliche" className="text-xs">Kongrev Klishesi (Magniy)</SelectItem>
                      <SelectItem value="varnish_plate" className="text-xs">Lak Trafareti / Polimer</SelectItem>
                      <SelectItem value="flexo_polymer" className="text-xs">Flexo Fotopolimer Forma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Buyurtma holati *</Label>
                  <Select
                    value={editingItem.status || "Draft"}
                    onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, status: val || "Draft" }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue>
                        {(val) => STATUS_CONFIG[val as ToolingStatus]?.label || val || "Qoralama"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft" className="text-xs">Qoralama (Kutilmoqda)</SelectItem>
                      <SelectItem value="Ordered" className="text-xs">Buyurtma berildi</SelectItem>
                      <SelectItem value="In_Production" className="text-xs">Ishlab chiqarilmoqda</SelectItem>
                      <SelectItem value="Ready" className="text-xs">Tayyor</SelectItem>
                      <SelectItem value="Delivered" className="text-xs">Yetkazib berildi</SelectItem>
                      <SelectItem value="Mounted" className="text-xs">Stanokka o&apos;rnatildi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Name */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Jihoz / Qolip nomi *</Label>
                <Input
                  value={editingItem.name || ""}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Masalan: Shokolad qutisi shtampi FEFCO yoki 4 dona CTP forma"
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* Row 3: Technical Spec & Format */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Texnik spetsifikatsiya &amp; format
                </Label>
                <Input
                  value={editingItem.specDetails || ""}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, specDetails: e.target.value }))}
                  placeholder="700×1000 mm, pichoq balandligi 23.8 mm, latun 3 mm CNC..."
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* Row 4: Quantity, Unit, Unit Price, Total Cost */}
              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Miqdori *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editingItem.quantity ?? 1}
                    onChange={(e) => {
                      const qty = Math.max(1, parseInt(e.target.value) || 1);
                      const currentUnitPrice = (editingItem.estimatedCost || 0) / Math.max(1, editingItem.quantity || 1);
                      setEditingItem((prev) => ({
                        ...prev,
                        quantity: qty,
                        estimatedCost: Math.round(currentUnitPrice * qty),
                      }));
                    }}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Birligi *</Label>
                  <Select
                    value={editingItem.unit || "dona"}
                    onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, unit: val || "dona" }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue>{(val) => val || "dona"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dona" className="text-xs">dona</SelectItem>
                      <SelectItem value="komplekt" className="text-xs">komplekt</SelectItem>
                      <SelectItem value="kv.sm" className="text-xs">kv.sm (sm²)</SelectItem>
                      <SelectItem value="kv.m" className="text-xs">kv.m</SelectItem>
                      <SelectItem value="metr" className="text-xs">metr</SelectItem>
                      <SelectItem value="list" className="text-xs">list (varaq)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium truncate" title="1 birlik narxi">
                    Dona narxi
                  </Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={2}
                    value={
                      editingItem.quantity && editingItem.quantity > 0
                        ? Math.round(((editingItem.estimatedCost || 0) / editingItem.quantity) * 100) / 100
                        : 0
                    }
                    onValueChange={(values) => {
                      const uPrice = values.floatValue ?? 0;
                      const qty = editingItem.quantity || 1;
                      setEditingItem((prev) => ({
                        ...prev,
                        estimatedCost: Math.round(uPrice * qty * 100) / 100,
                      }));
                    }}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="col-span-3 space-y-1.5">
                  <Label
                    className="text-[11px] text-muted-foreground font-medium truncate"
                    title={`Jami summa (${editingItem.currency || formData.currency || "UZS"})`}
                  >
                    Jami summa
                  </Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={2}
                    value={editingItem.estimatedCost || 0}
                    onValueChange={(values) =>
                      setEditingItem((prev) => ({
                        ...prev,
                        estimatedCost: values.floatValue ?? 0,
                      }))
                    }
                    className="h-8 text-xs font-mono bg-background font-semibold"
                  />
                </div>
              </div>

              {/* Row 5: Storage Location */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span>Ombor / Stellaj joylashuvi (Inventar)</span>
                </Label>
                <Input
                  value={editingItem.location || ""}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Masalan: SHELF-A1, RACK-CYL-02 yoki Stanok yoni..."
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              {/* Centralized Procurement Notice */}
              <div className="flex items-center justify-between px-2.5 py-2 rounded bg-muted/40 border border-border text-[11px]">
                <div className="flex items-center gap-2">
                  {editingItem.purchaseOrderNo ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          Rasmiy PO: {editingItem.purchaseOrderNo} ({editingItem.supplierName || "Ta'minotchi"})
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Holati: {STATUS_CONFIG[editingItem.status as ToolingStatus]?.label || editingItem.status}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Stamp className="w-3.5 h-3.5 text-primary shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          Markazlashtirilgan ta&apos;minot
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Ta&apos;minotchi tanlash va rasmiy xarid &quot;Qoliplar va CTP buyurtmalari&quot; modulida amalga oshiriladi.
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {editingItem.purchaseOrderNo ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 p-1 cursor-pointer"
                    onClick={() => handleOpenSupplierOrders(editingItem.supplierId, editingItem.supplierName)}
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ta&apos;minotchida ko&apos;rish</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 text-primary p-1 cursor-pointer"
                    onClick={() => {
                      setIsAddEditOpen(false);
                      handleOpenToolingRegistry();
                    }}
                  >
                    <Stamp className="w-3 h-3" />
                    <span>Reestrda ochish</span>
                  </Button>
                )}
              </div>

              {/* Row 6: Attachments: Photo and CAD / Dieline file */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Jihoz fotosurati */}
                <div className="border border-border rounded-md p-2.5 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                      <span>Jihoz fotosurati</span>
                    </Label>
                    {editingItem.imageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-5 w-5 text-destructive p-0 cursor-pointer"
                        onClick={() => setEditingItem((prev) => ({ ...prev, imageUrl: undefined }))}
                        title="Rasmni o'chirish"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {editingItem.imageUrl ? (
                    <div className="flex items-center gap-2.5">
                      <img
                        src={editingItem.imageUrl}
                        alt="Jihoz fotosurati"
                        className="h-16 w-20 object-cover rounded border border-border bg-background cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                        onClick={() => setActivePreviewImage(editingItem.imageUrl!)}
                        title="Kattalashtirib ko'rish"
                      />
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="text-[11px] text-muted-foreground font-mono truncate">
                          Yuklangan fotosurat
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 cursor-pointer"
                          onClick={() => imageFileInputRef.current?.click()}
                        >
                          <Upload className="w-2.5 h-2.5" />
                          <span>Almashtirish</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => imageFileInputRef.current?.click()}
                      className="border border-dashed border-border rounded p-3 text-center cursor-pointer hover:bg-muted/40 transition-colors space-y-1"
                    >
                      <Upload className="w-4 h-4 mx-auto text-muted-foreground" />
                      <div className="text-[11px] font-medium text-muted-foreground">Fotosurat yuklash</div>
                      <div className="text-[10px] text-muted-foreground/70">JPG, PNG, WEBP</div>
                    </div>
                  )}
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>

                {/* CAD / Dieline / Texnik fayl */}
                <div
                  className={cn(
                    "border rounded-md p-2.5 transition-colors space-y-2",
                    fileError && !editingItem.fileUrl
                      ? "border-destructive/80 bg-destructive/5"
                      : "border-border bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Label
                      className={cn(
                        "text-[11px] font-medium flex items-center gap-1.5",
                        fileError && !editingItem.fileUrl ? "text-destructive" : "text-foreground"
                      )}
                    >
                      <FileText className={cn("w-3.5 h-3.5", fileError && !editingItem.fileUrl ? "text-destructive" : "text-purple-500")} />
                      <span>CAD / Dieline chizma</span>
                    </Label>
                    {editingItem.fileUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-5 w-5 text-destructive p-0 cursor-pointer"
                        onClick={() => setEditingItem((prev) => ({ ...prev, fileUrl: undefined, fileName: undefined }))}
                        title="Faylni o'chirish"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {editingItem.fileUrl ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border">
                        <FileText className="w-4 h-4 text-purple-500 shrink-0" />
                        <span className="text-[11px] font-mono truncate flex-1" title={editingItem.fileName || "dieline.pdf"}>
                          {editingItem.fileName || "dieline.pdf"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 cursor-pointer"
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = editingItem.fileUrl!;
                            a.download = editingItem.fileName || "dieline_drawing.pdf";
                            a.click();
                          }}
                        >
                          <Download className="w-2.5 h-2.5" />
                          <span>Yuklab olish</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground cursor-pointer"
                          onClick={() => cadFileInputRef.current?.click()}
                        >
                          <Upload className="w-2.5 h-2.5" />
                          <span>Almashtirish</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => cadFileInputRef.current?.click()}
                      className={cn(
                        "border border-dashed rounded p-3 text-center cursor-pointer transition-colors space-y-1",
                        fileError
                          ? "border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive/40"
                          : "border-border hover:bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <FileText className={cn("w-4 h-4 mx-auto", fileError ? "text-destructive" : "text-muted-foreground")} />
                      <div className={cn("text-[11px] font-medium", fileError ? "text-destructive font-semibold" : "text-muted-foreground")}>
                        {fileError ? "Chizma faylini biriktirish shart" : "CAD / PDF biriktirish"}
                      </div>
                      <div className={cn("text-[10px]", fileError ? "text-destructive/80" : "text-muted-foreground/70")}>
                        PDF, DXF, CF2, AI, EPS
                      </div>
                    </div>
                  )}
                  <input
                    ref={cadFileInputRef}
                    type="file"
                    accept=".pdf,.dxf,.cf2,.ai,.eps,.svg"
                    className="hidden"
                    onChange={handleCadFileUpload}
                  />
                  {fileError && !editingItem.fileUrl && (
                    <div className="text-[10px] text-destructive font-medium pt-0.5">
                      Buyurtma berish uchun jihoz chizma fayli yuklanishi shart
                    </div>
                  )}
                </div>
              </div>

              {/* Row 7: Notes & Prepress instructions */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Prepress ko&apos;rsatmasi va izohlar
                </Label>
                <Textarea
                  value={editingItem.notes || ""}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Stanok operatori yoki pudratchiga maxsus talablar, rezina turi, resurs..."
                  className="h-14 text-xs bg-background resize-none"
                />
              </div>

              {/* Cost phase: sample vs production run */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Bosqich</Label>
                <Select
                  value={editingItem.phase || "production"}
                  onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, phase: val }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue>
                      {(val) => (val === "sample" ? "Namuna" : "Ishlab chiqarish")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production" className="text-xs">Ishlab chiqarish</SelectItem>
                    <SelectItem value="sample" className="text-xs">Namuna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Remake Party (if remake) */}
              {editingItem.isRemake && (
                <div className="space-y-1.5 p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                  <Label className="text-[11px] font-medium text-rose-800 dark:text-rose-200">
                    Brak / Qayta chiqarish sababi va aybdor tomon
                  </Label>
                  <Select
                    value={editingItem.faultParty || "prepress"}
                    onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, faultParty: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue>
                        {(val) => FAULT_PARTY_CONFIG[val] || val}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepress" className="text-xs">Prepress xatosi (Dizayn/Spusk)</SelectItem>
                      <SelectItem value="production" className="text-xs">Ishlab chiqarish (Sexdagi brak)</SelectItem>
                      <SelectItem value="client" className="text-xs">Mijoz o&apos;zgartirishi</SelectItem>
                      <SelectItem value="supplier" className="text-xs">Ta&apos;minotchi / Pudratchi defekti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddEditOpen(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveToolingItem}
              className="h-7 text-xs bg-primary text-primary-foreground font-medium"
            >
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Image Preview Lightbox Dialog */}
      <Dialog open={Boolean(activePreviewImage)} onOpenChange={(open) => !open && setActivePreviewImage(null)}>
        <DialogContent className="sm:max-w-[620px] w-full p-4 text-xs bg-card border-border">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-xs font-semibold flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
              <span>Jihoz fotosurati</span>
            </DialogTitle>
          </DialogHeader>
          {activePreviewImage && (
            <div className="py-2 flex items-center justify-center bg-black/5 dark:bg-black/30 rounded border border-border overflow-hidden">
              <img
                src={activePreviewImage}
                alt="Jihoz fotosurati"
                className="max-h-[60vh] max-w-full object-contain rounded"
              />
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActivePreviewImage(null)}
              className="h-7 text-xs"
            >
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Catalog Tooling Picker Modal */}
      <Dialog open={isCatalogPickerOpen} onOpenChange={setIsCatalogPickerOpen}>
        <DialogContent className="sm:max-w-[660px] w-full p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Mavjud Shtamp, Klishe va Qoliplar Katalogi</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Korxona ombori yoki stellajida tayyor turgan shtamplar va klishelarni buyurtmaga biriktirish (Xarid xarajatisiz, 0 so&apos;m).
            </DialogDescription>
          </DialogHeader>

          {/* 1. Search Bar on Top */}
          <div className="space-y-2.5 py-1">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Shtamp kodi, nomi, o'lchami yoki stellaj joyi bo'yicha qidirish..."
                className="h-8.5 pl-9 text-xs bg-background w-full"
                autoFocus
              />
            </div>

            {/* 2. Filter Buttons Row Below Search */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "ALL", label: "Barchasi" },
                { id: "die_cutting", label: "Kesish shtamplari" },
                { id: "foil_cliche", label: "Folga klishelari" },
                { id: "emboss_cliche", label: "Kongrev klishelari" },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  variant={catalogCategoryFilter === tab.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCatalogCategoryFilter(tab.id)}
                  className={cn(
                    "h-7 px-3 text-xs font-medium cursor-pointer rounded shadow-none",
                    catalogCategoryFilter === tab.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground border-border"
                  )}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* 3. Clean Items List (No emojis, no useless badges, no redundant status text) */}
            <div className="border border-border rounded-md overflow-hidden max-h-[380px] overflow-y-auto divide-y divide-border bg-card mt-1">
              {filteredCatalogDies.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground space-y-1">
                  <div className="font-medium text-xs">Mavjud katalogda bunday jihoz topilmadi.</div>
                  <div className="text-[11px]">Qidiruv so&apos;zini o&apos;zgartiring yoki filterni tozalang.</div>
                </div>
              ) : (
                filteredCatalogDies.map((tool: any) => (
                  <div
                    key={tool.id}
                    className="p-3 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-foreground">
                          {tool.code}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {tool.widthMm || 0} × {tool.heightMm || 0} mm
                        </span>
                        {tool.location && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            [{tool.location}]
                          </span>
                        )}
                        {tool.customerName && (
                          <span className="text-[11px] text-muted-foreground">
                            • Mijoz: {tool.customerName}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-foreground font-medium truncate">
                        {tool.name}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAttachCatalogDie(tool)}
                      className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shrink-0 cursor-pointer shadow-none rounded"
                    >
                      Biriktirish
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between">
            <span className="text-[11px] text-muted-foreground">
              Jami <strong>{filteredCatalogDies.length}</strong> ta mos jihoz topildi
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCatalogPickerOpen(false)}
              className="h-7 text-xs"
            >
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteConfirmItem)} onOpenChange={(open) => { if (!open) setDeleteConfirmItem(null); }}>
        <DialogContent className="sm:max-w-[400px] p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Jihozni o&apos;chirish</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              <span className="font-medium text-foreground">{deleteConfirmItem?.name}</span> ni buyurtma jihozlari ro&apos;yxatidan o&apos;chirishni tasdiqlaysizmi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmItem(null)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={confirmDeleteItem}
              className="h-7 text-xs"
            >
              O&apos;chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
