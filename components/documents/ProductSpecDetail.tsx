"use client";

import React, { useState, useCallback, useMemo } from "react";
import { 
  Save, 
  Check, 
  Layers, 
  Boxes, 
  Factory, 
  Plus, 
  Trash2, 
  Edit3,
  FileText 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { FieldCombobox } from "@/components/ui/field-combobox";
import { 
  DataEditor, 
  GridCell, 
  GridCellKind, 
  GridColumn, 
  Item, 
  GridColumnIcon, 
  EditableGridCell,
  GridSelection,
  CompactSelection
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";

const MATERIAL_OPTIONS = [
  "Galerie Art Silk Paper 150g",
  "LumiForte Premium 250g",
  "Kraft Board 350g",
  "Munken Polar 120g",
  "Hubergroup CMYK Process Ink",
  "Toyo Ink Cyan",
  "Wash-Resistant Black Ink",
  "Spot UV Gloss Varnish",
  "Agfa CTP Thermal Plates",
  "Nylon Taffeta Tape 30mm",
  "Premium Satin Ribbon 40mm",
  "Tear-resistant Tyvek Tape",
  "Polyester Warp Yarn Black",
  "Polyester Weft Yarn White",
  "Hot Melt Glue PUR",
  "Stitching Wire 0.6mm",
  "Corrugated Shipping Box 40x30",
];

const UNIT_OPTIONS = [
  "kg",
  "Sheets",
  "Rolls",
  "pcs",
  "meters",
  "sets",
  "spools",
];

const OPERATION_OPTIONS = [
  "Pre-press & CTP Plate Imaging",
  "4-Color Offset Printing",
  "6-Color Flexo Printing",
  "Spot UV Coating & Varnish",
  "Automatic Die-cutting & Creasing",
  "High-Speed Folder Gluer",
  "Slitting & Rewinding",
  "Weaving & Loom Setup",
  "Thermo-cutting & Ultrasonic Slit",
  "Manual Quality Inspection & Packing",
];

const MACHINE_OPTIONS = [
  "Heidelberg Speedmaster XL 106",
  "Komori Lithrone G40",
  "Mark Andy Performance 8-Color",
  "Nilpeter FA-Line Flexo",
  "Staubli Jacquard Loom",
  "Bobst Novacut 106 Die-cutter",
  "Kolbus BF 513 Hardcover Line",
  "Autobond Mini 76 UV Coater",
  "Screen PlateRite 8600 CTP",
  "Manual QC & Packing Station",
];

export function ProductSpecDetail({ tab }: { tab: DocumentTab }) {
  const { setTabUnsaved, closeTab, setLevel3Tab, theme } = useWorkspaceStore();
  const isDark = theme === "dark";
  const data = tab.documentData || {};
  
  const [formData, setFormData] = useState({
    code: data.code || "NEW_SPEC",
    name: data.name || "New Product Specification",
    department: data.department || "Offset",
    status: data.status || "Draft",
    baseMaterial: data.baseMaterial || "Galerie Art Silk 150g",
    version: data.version || "1.0",
  });

  const [materials, setMaterials] = useState([
    { id: "1", name: "Hubergroup CMYK Process Ink", quantity: 0.5, unit: "kg" },
    { id: "2", name: "Spot UV Gloss Varnish", quantity: 0.1, unit: "kg" }
  ]);

  const [operations, setOperations] = useState([
    { id: "1", name: "Pre-press & CTP Plate Imaging", machineStr: "Screen PlateRite 8600 CTP" },
    { id: "2", name: "4-Color Offset Printing", machineStr: "Heidelberg Speedmaster XL 106" }
  ]);

  // Selections
  const [matSelection, setMatSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [opSelection, setOpSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Material Dialog state
  const [isMatDialogOpen, setIsMatDialogOpen] = useState(false);
  const [editingMatIndex, setEditingMatIndex] = useState<number | null>(null);
  const [matDialogForm, setMatDialogForm] = useState({
    name: MATERIAL_OPTIONS[0],
    quantity: 1,
    unit: "kg",
  });

  // Route Dialog state
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [editingOpIndex, setEditingOpIndex] = useState<number | null>(null);
  const [opDialogForm, setOpDialogForm] = useState({
    name: OPERATION_OPTIONS[0],
    machineStr: MACHINE_OPTIONS[0],
  });

  const activeTab = tab.activeLevel3Tab || "overview";

  const handleFieldChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleSaveAndClose = () => {
    setTabUnsaved(tab.id, false);
    closeTab(tab.id);
  };

  // --- Material Dialog Handlers ---
  const handleOpenAddMaterial = () => {
    setEditingMatIndex(null);
    setMatDialogForm({
      name: MATERIAL_OPTIONS[0],
      quantity: 1,
      unit: "kg",
    });
    setIsMatDialogOpen(true);
  };

  const handleOpenEditMaterial = (index: number) => {
    const item = materials[index];
    if (!item) return;
    setEditingMatIndex(index);
    setMatDialogForm({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    });
    setIsMatDialogOpen(true);
  };

  const handleSaveMaterialDialog = () => {
    if (editingMatIndex !== null) {
      // Edit existing
      const updated = [...materials];
      updated[editingMatIndex] = {
        ...updated[editingMatIndex],
        name: matDialogForm.name,
        quantity: Number(matDialogForm.quantity) || 1,
        unit: matDialogForm.unit,
      };
      setMaterials(updated);
    } else {
      // Add new
      setMaterials([
        ...materials,
        {
          id: String(Date.now()),
          name: matDialogForm.name,
          quantity: Number(matDialogForm.quantity) || 1,
          unit: matDialogForm.unit,
        },
      ]);
    }
    setTabUnsaved(tab.id, true);
    setIsMatDialogOpen(false);
  };

  const handleDeleteSelectedMaterial = () => {
    const selectedRows = matSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    const remaining = materials.filter((_, idx) => !selectedRows.includes(idx));
    setMaterials(remaining);
    setMatSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  // --- Route Dialog Handlers ---
  const handleOpenAddOperation = () => {
    setEditingOpIndex(null);
    setOpDialogForm({
      name: OPERATION_OPTIONS[0],
      machineStr: MACHINE_OPTIONS[0],
    });
    setIsOpDialogOpen(true);
  };

  const handleOpenEditOperation = (index: number) => {
    const item = operations[index];
    if (!item) return;
    setEditingOpIndex(index);
    setOpDialogForm({
      name: item.name,
      machineStr: item.machineStr,
    });
    setIsOpDialogOpen(true);
  };

  const handleSaveOperationDialog = () => {
    if (editingOpIndex !== null) {
      // Edit existing
      const updated = [...operations];
      updated[editingOpIndex] = {
        ...updated[editingOpIndex],
        name: opDialogForm.name,
        machineStr: opDialogForm.machineStr,
      };
      setOperations(updated);
    } else {
      // Add new
      setOperations([
        ...operations,
        {
          id: String(Date.now()),
          name: opDialogForm.name,
          machineStr: opDialogForm.machineStr,
        },
      ]);
    }
    setTabUnsaved(tab.id, true);
    setIsOpDialogOpen(false);
  };

  const handleDeleteSelectedOperation = () => {
    const selectedRows = opSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    const remaining = operations.filter((_, idx) => !selectedRows.includes(idx));
    setOperations(remaining);
    setOpSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  // --- Grid Configurations ---
  const matColumns = useMemo<GridColumn[]>(() => [
    { id: "index", title: "#", width: 50, icon: GridColumnIcon.HeaderNumber },
    { id: "name", title: "Material Name", width: 380, icon: GridColumnIcon.HeaderString },
    { id: "quantity", title: "Qty / Unit", width: 120, icon: GridColumnIcon.HeaderNumber },
    { id: "unit", title: "Unit", width: 100, icon: GridColumnIcon.HeaderString },
  ], []);

  const getMatCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const mat = materials[row];
    if (!mat) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    if (col === 0) return { kind: GridCellKind.Number, data: row + 1, displayData: String(row + 1), allowOverlay: false };
    if (col === 1) return { kind: GridCellKind.Text, data: mat.name, displayData: mat.name, allowOverlay: true };
    if (col === 2) return { kind: GridCellKind.Number, data: mat.quantity, displayData: String(mat.quantity), allowOverlay: true };
    if (col === 3) return { kind: GridCellKind.Text, data: mat.unit, displayData: mat.unit, allowOverlay: true };
    
    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [materials]);

  const onMatCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const newMats = [...materials];
    if (col === 1 && newValue.kind === GridCellKind.Text) {
      newMats[row].name = newValue.data.toString();
    } else if (col === 2 && newValue.kind === GridCellKind.Number) {
      newMats[row].quantity = Number(newValue.data);
    } else if (col === 3 && newValue.kind === GridCellKind.Text) {
      newMats[row].unit = newValue.data.toString();
    }
    setMaterials(newMats);
    setTabUnsaved(tab.id, true);
  }, [materials, tab.id, setTabUnsaved]);

  const opColumns = useMemo<GridColumn[]>(() => [
    { id: "index", title: "Step", width: 60, icon: GridColumnIcon.HeaderNumber },
    { id: "name", title: "Operation Description", width: 420, icon: GridColumnIcon.HeaderString },
    { id: "machineStr", title: "Machine / Equipment Class", width: 340, icon: GridColumnIcon.HeaderLookup },
  ], []);

  const getOpCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const op = operations[row];
    if (!op) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    if (col === 0) return { kind: GridCellKind.Number, data: row + 1, displayData: String(row + 1), allowOverlay: false };
    if (col === 1) return { kind: GridCellKind.Text, data: op.name, displayData: op.name, allowOverlay: true };
    if (col === 2) return { kind: GridCellKind.Text, data: op.machineStr, displayData: op.machineStr, allowOverlay: true };
    
    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [operations]);

  const onOpCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const newOps = [...operations];
    if (col === 1 && newValue.kind === GridCellKind.Text) {
      newOps[row].name = newValue.data.toString();
    } else if (col === 2 && newValue.kind === GridCellKind.Text) {
      newOps[row].machineStr = newValue.data.toString();
    }
    setOperations(newOps);
    setTabUnsaved(tab.id, true);
  }, [operations, tab.id, setTabUnsaved]);

  const selectedMatRow = matSelection.rows.toArray()[0];
  const hasSelectedMat = selectedMatRow !== undefined && materials[selectedMatRow] !== undefined;

  const selectedOpRow = opSelection.rows.toArray()[0];
  const hasSelectedOp = selectedOpRow !== undefined && operations[selectedOpRow] !== undefined;

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden text-xs">
      <Tabs value={activeTab} onValueChange={(val) => setLevel3Tab(tab.id, val)} className="flex-1 flex flex-col overflow-hidden">
        {/* Unified Level 3 Tabs & Action Buttons Bar */}
        <div className="px-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between h-10 gap-2">
          <TabsList className="bg-transparent h-10 p-0 gap-1.5 shrink-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150 cursor-pointer">
              <FileText className="w-4 h-4" /> <span>General</span>
            </TabsTrigger>
            <TabsTrigger value="materials" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150 cursor-pointer">
              <Boxes className="w-4 h-4" /> <span>Bill of Materials (BOM)</span>
            </TabsTrigger>
            <TabsTrigger value="operations" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150 cursor-pointer">
              <Factory className="w-4 h-4" /> <span>Technological Route</span>
            </TabsTrigger>
          </TabsList>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="font-mono text-[10px] hidden sm:inline-flex">
              Master Data Template
            </Badge>
            <Button 
              onClick={() => setTabUnsaved(tab.id, false)} 
              variant="outline" 
              size="sm" 
              className="h-7 border-zinc-300 dark:border-zinc-700 text-xs font-medium gap-1.5 rounded cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>Save</span>
            </Button>
            <Button 
              onClick={handleSaveAndClose} 
              size="sm" 
              className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none rounded cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Close</span>
            </Button>
          </div>
        </div>

        {/* General Tab */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 m-0">
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md max-w-2xl space-y-4">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Specification Details</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Code / ID</label>
                <Input value={formData.code} onChange={(e) => handleFieldChange("code", e.target.value)} className="h-8 text-xs font-mono" />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Status</label>
                <Select value={formData.status} onValueChange={(val) => handleFieldChange("status", val)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Obsolete">Obsolete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-zinc-500 font-medium block mb-1">Specification Name</label>
                <Input value={formData.name} onChange={(e) => handleFieldChange("name", e.target.value)} className="h-8 text-xs font-semibold" />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Technology / Department</label>
                <Select value={formData.department} onValueChange={(val) => handleFieldChange("department", val)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Offset">Offset Printing</SelectItem>
                    <SelectItem value="Flexo">Flexo Labeling</SelectItem>
                    <SelectItem value="Jacquard">Jacquard Woven</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Version</label>
                <Input value={formData.version} onChange={(e) => handleFieldChange("version", e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* BOM Tab */}
        <TabsContent value="materials" className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div 
                className="flex-1 w-full h-full relative" 
                id="glide-spec-materials-root"
                onKeyDown={(e) => {
                  if (e.key === "Insert") {
                    e.preventDefault();
                    handleOpenAddMaterial();
                  } else if (e.key === "Delete" && hasSelectedMat) {
                    e.preventDefault();
                    handleDeleteSelectedMaterial();
                  }
                }}
              >
                <DataEditor
                  getCellContent={getMatCellContent}
                  columns={matColumns}
                  rows={materials.length}
                  onCellEdited={onMatCellEdited}
                  gridSelection={matSelection}
                  onGridSelectionChange={setMatSelection}
                  onCellContextMenu={(cell) => {
                    const [, row] = cell;
                    setMatSelection({
                      columns: CompactSelection.empty(),
                      rows: CompactSelection.fromSingleSelection(row),
                    });
                  }}
                  onCellActivated={(cell) => {
                    const [, row] = cell;
                    handleOpenEditMaterial(row);
                  }}
                  rowMarkers="both"
                  width="100%"
                  height="100%"
                  headerHeight={28}
                  rowHeight={32}
                  theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                />
              </div>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-56 text-xs">
              <ContextMenuItem onClick={handleOpenAddMaterial} className="gap-2 cursor-pointer">
                <Plus className="w-3.5 h-3.5 text-blue-500" />
                <span>Add Material</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
              </ContextMenuItem>

              {hasSelectedMat && (
                <ContextMenuItem onClick={() => handleOpenEditMaterial(selectedMatRow)} className="gap-2 cursor-pointer">
                  <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Edit Material</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
                </ContextMenuItem>
              )}

              {hasSelectedMat && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handleDeleteSelectedMaterial} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Material</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </TabsContent>

        {/* Route Tab */}
        <TabsContent value="operations" className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div 
                className="flex-1 w-full h-full relative" 
                id="glide-spec-routes-root"
                onKeyDown={(e) => {
                  if (e.key === "Insert") {
                    e.preventDefault();
                    handleOpenAddOperation();
                  } else if (e.key === "Delete" && hasSelectedOp) {
                    e.preventDefault();
                    handleDeleteSelectedOperation();
                  }
                }}
              >
                <DataEditor
                  getCellContent={getOpCellContent}
                  columns={opColumns}
                  rows={operations.length}
                  onCellEdited={onOpCellEdited}
                  gridSelection={opSelection}
                  onGridSelectionChange={setOpSelection}
                  onCellContextMenu={(cell) => {
                    const [, row] = cell;
                    setOpSelection({
                      columns: CompactSelection.empty(),
                      rows: CompactSelection.fromSingleSelection(row),
                    });
                  }}
                  onCellActivated={(cell) => {
                    const [, row] = cell;
                    handleOpenEditOperation(row);
                  }}
                  rowMarkers="both"
                  width="100%"
                  height="100%"
                  headerHeight={28}
                  rowHeight={32}
                  theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                />
              </div>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-56 text-xs">
              <ContextMenuItem onClick={handleOpenAddOperation} className="gap-2 cursor-pointer">
                <Plus className="w-3.5 h-3.5 text-blue-500" />
                <span>Add Routing Step</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
              </ContextMenuItem>

              {hasSelectedOp && (
                <ContextMenuItem onClick={() => handleOpenEditOperation(selectedOpRow)} className="gap-2 cursor-pointer">
                  <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Edit Routing Step</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
                </ContextMenuItem>
              )}

              {hasSelectedOp && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handleDeleteSelectedOperation} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Step</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </TabsContent>
      </Tabs>

      {/* --- Dialog: Add / Edit Material --- */}
      <Dialog open={isMatDialogOpen} onOpenChange={setIsMatDialogOpen}>
        <DialogContent className="sm:max-w-[440px] text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>{editingMatIndex !== null ? "Edit Specification Material" : "Add Material to Specification"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select raw material from the catalog and define required unit consumption.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Material Item <span className="text-destructive">*</span></label>
              <FieldCombobox
                value={matDialogForm.name}
                onChange={(val) => setMatDialogForm((p) => ({ ...p, name: val }))}
                options={MATERIAL_OPTIONS.map((m) => ({ value: m, label: m }))}
                placeholder="Search raw material catalog..."
                className="h-8 text-xs bg-background"
                popoverClassName="w-auto min-w-[340px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Quantity per Unit <span className="text-destructive">*</span></label>
                <Input
                  type="number"
                  step="0.01"
                  value={matDialogForm.quantity}
                  onChange={(e) => setMatDialogForm((p) => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))}
                  className="h-8 text-xs font-mono"
                  placeholder="e.g. 1.5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Unit of Measure <span className="text-destructive">*</span></label>
                <Select
                  value={matDialogForm.unit}
                  onValueChange={(val) => val && setMatDialogForm((p) => ({ ...p, unit: val }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsMatDialogOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveMaterialDialog} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {editingMatIndex !== null ? "Save Changes" : "Add Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Dialog: Add / Edit Routing Step --- */}
      <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
        <DialogContent className="sm:max-w-[440px] text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-600" />
              <span>{editingOpIndex !== null ? "Edit Routing Operation" : "Add Routing Step to Specification"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the technological process step and assigned equipment class.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Operation Description <span className="text-destructive">*</span></label>
              <FieldCombobox
                value={opDialogForm.name}
                onChange={(val) => setOpDialogForm((p) => ({ ...p, name: val }))}
                options={OPERATION_OPTIONS.map((o) => ({ value: o, label: o }))}
                placeholder="Search operation catalog..."
                className="h-8 text-xs bg-background"
                popoverClassName="w-auto min-w-[340px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Machine / Work Center <span className="text-destructive">*</span></label>
              <FieldCombobox
                value={opDialogForm.machineStr}
                onChange={(val) => setOpDialogForm((p) => ({ ...p, machineStr: val }))}
                options={MACHINE_OPTIONS.map((m) => ({ value: m, label: m }))}
                placeholder="Search equipment catalog..."
                className="h-8 text-xs bg-background"
                popoverClassName="w-auto min-w-[340px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsOpDialogOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveOperationDialog} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {editingOpIndex !== null ? "Save Changes" : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
