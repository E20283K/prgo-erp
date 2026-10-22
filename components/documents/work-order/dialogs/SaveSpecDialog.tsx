"use client";

import React, { useState } from "react";
import { BookmarkPlus, Layers, Boxes, Factory, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RouteStep, type WorkOrderDepartment } from "../types";
import { BomItem } from "../../BomMaterialsGrid";

interface SaveSpecDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  department: string;
  currentRecipeCode?: string;
  currentRecipeName?: string;
  materials: BomItem[];
  operations: RouteStep[];
  onSaveSpec: (newSpec: {
    code: string;
    name: string;
    department: WorkOrderDepartment;
    description: string;
    materials: BomItem[];
    operations: RouteStep[];
  }) => void;
}

export function SaveSpecDialog({
  isOpen,
  onOpenChange,
  department,
  currentRecipeCode,
  currentRecipeName,
  materials,
  operations,
  onSaveSpec,
}: SaveSpecDialogProps) {
  // Generate a suggested default code
  const defaultCode = React.useMemo(() => {
    const prefix =
      department === "Flexo"
        ? "FLEXO"
        : department === "Jacquard"
        ? "JACQ"
        : "OFFSET";
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}_CUSTOM_${rand}`;
  }, [department]);

  const [code, setCode] = useState(defaultCode);
  const [name, setName] = useState(
    currentRecipeName ? `${currentRecipeName} (Moslashtirilgan)` : "Yangi mahsulot spetsifikatsiyasi"
  );
  const [dept, setDept] = useState<WorkOrderDepartment>(
    (department as any) || "Offset"
  );
  const [description, setDescription] = useState(
    `Buyurtmadan ko'chirilgan moslashtirilgan spetsifikatsiya (${materials.length} xomashyo, ${operations.length} marshrut)`
  );
  const [includeMaterials, setIncludeMaterials] = useState(true);
  const [includeOperations, setIncludeOperations] = useState(true);

  // Sync default values when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setCode(defaultCode);
      if (currentRecipeName) {
        setName(`${currentRecipeName} (Moslashtirilgan)`);
      }
      setDept((department as any) || "Offset");
      setDescription(
        `Buyurtmadan ko'chirilgan moslashtirilgan spetsifikatsiya (${materials.length} xomashyo, ${operations.length} operatsiya)`
      );
    }
  }, [isOpen, defaultCode, currentRecipeName, department, materials.length, operations.length]);

  const handleConfirm = () => {
    if (!code.trim() || !name.trim()) return;

    onSaveSpec({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      department: dept,
      description: description.trim(),
      materials: includeMaterials ? materials : [],
      operations: includeOperations ? operations : [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Yangi Spetsifikatsiya (Master BOM) sifatida saqlash</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ushbu buyurtmada o'zgartirilgan xomashyolar va texnologik marshrutni yangi etalon spetsifikatsiya sifatida saqlab, kelgusi buyurtmalarda qayta ishlatishingiz mumkin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Base Reference Info */}
          {currentRecipeCode && (
            <div className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border text-[11px]">
              <span className="text-muted-foreground">Asosiy shablon:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-semibold">
                  {currentRecipeCode}
                </Badge>
                <span className="text-muted-foreground truncate max-w-[200px]">{currentRecipeName}</span>
              </div>
            </div>
          )}

          {/* Code & Department */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-muted-foreground font-medium block">
                Spetsifikatsiya kodi (ID) <span className="text-destructive">*</span>
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="OFFSET_STD_V2"
                className="h-8 text-xs font-mono font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground font-medium block">Ishlab chiqarish sexi</label>
              <Select value={dept} onValueChange={(val: any) => setDept(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Offset">Offset Printing</SelectItem>
                  <SelectItem value="Flexo">Flexo Label & Web</SelectItem>
                  <SelectItem value="Jacquard">Jacquard Woven</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-muted-foreground font-medium block">
              Spetsifikatsiya nomi <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Standart CMYK + Soft Touch Matte"
              className="h-8 text-xs font-medium"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-muted-foreground font-medium block">Tavsif (izoh)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Texnik xususiyatlar va qo'llanish sohasi..."
              className="h-8 text-xs"
            />
          </div>

          {/* Included Data Preview */}
          <div className="space-y-2 pt-1">
            <label className="text-muted-foreground font-medium block">Saqlanadigan komponentlar</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${
                  includeMaterials
                    ? "bg-blue-500/10 border-blue-500/30 text-foreground"
                    : "bg-muted/30 border-border text-muted-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={includeMaterials}
                  onChange={(e) => setIncludeMaterials(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Boxes className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Xomashyo (BOM)</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {materials.length} ta material kiritiladi
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${
                  includeOperations
                    ? "bg-blue-500/10 border-blue-500/30 text-foreground"
                    : "bg-muted/30 border-border text-muted-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={includeOperations}
                  onChange={(e) => setIncludeOperations(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Factory className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Marshrut (Route)</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {operations.length} ta operatsiya bosqichi
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Bekor qilish
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!code.trim() || !name.trim()}
            onClick={handleConfirm}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Spetsifikatsiyani saqlash</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
