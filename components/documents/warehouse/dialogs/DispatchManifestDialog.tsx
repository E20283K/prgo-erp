"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  Printer,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  Send,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface DispatchManifestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialShipmentId?: string;
  initialShipmentIds?: string[];
  manifest?: any | null;
}

export function DispatchManifestDialog({
  open,
  onOpenChange,
  initialShipmentId,
  initialShipmentIds,
  manifest,
}: DispatchManifestDialogProps) {
  const {
    warehouseShipments = [],
    upsertDispatchManifestAsync,
    dispatchManifests = [],
    carriersList = [],
    addNotification,
    activeCompanyId,
  } = useWorkspaceStore();

  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [vehiclePlate, setVehiclePlate] = useState("01 A 772 BB");
  const [vehicleModel, setVehicleModel] = useState("ISUZU Furgon 3.5t");
  const [driverName, setDriverName] = useState("Rustam Ismoilov");
  const [driverPhone, setDriverPhone] = useState("+998 90 123-45-67");
  const [destinationRoute, setDestinationRoute] = useState("Toshkent shahri bo'ylab yetkazish");
  const [departureTime, setDepartureTime] = useState("14:30");
  const [status, setStatus] = useState<string>("Loading");
  const [notes, setNotes] = useState("");
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsPrintPreview(false);

    if (manifest) {
      setVehiclePlate(manifest.vehiclePlate || "01 A 772 BB");
      setVehicleModel(manifest.vehicleModel || "ISUZU Furgon 3.5t");
      setDriverName(manifest.driverName || "Rustam Ismoilov");
      setDriverPhone(manifest.driverPhone || "+998 90 123-45-67");
      setDestinationRoute(manifest.destinationRoute || "Toshkent shahri bo'ylab yetkazish");
      setDepartureTime(manifest.departureTime || "14:30");
      setStatus(manifest.status || "Loading");
      setNotes(manifest.notes || "");

      const linkedIds = Array.isArray(manifest.shipments)
        ? manifest.shipments.map((s: any) => s.shipmentNumber || s.id)
        : warehouseShipments
            .filter(
              (s) =>
                s.manifestId === manifest.dbId ||
                s.manifestId === manifest.id ||
                s.manifestNumber === manifest.manifestNumber
            )
            .map((s) => s.id);
      setSelectedShipmentIds(linkedIds);
    } else {
      setStatus("Loading");
      if (initialShipmentIds && initialShipmentIds.length > 0) {
        setSelectedShipmentIds(initialShipmentIds);
      } else if (initialShipmentId) {
        setSelectedShipmentIds([initialShipmentId]);
      } else {
        const readyOnes = warehouseShipments
          .filter((s) => (s.status === "Packed" || s.status === "Draft") && !s.manifestId)
          .map((s) => s.id);
        setSelectedShipmentIds(readyOnes);
      }
    }
  }, [open, manifest, initialShipmentId, initialShipmentIds, warehouseShipments]);

  const candidateShipments = useMemo(() => {
    return warehouseShipments.filter(
      (s) =>
        s.status !== "Delivered" ||
        selectedShipmentIds.includes(s.id) ||
        (manifest && (s.manifestId === manifest.dbId || s.manifestId === manifest.id))
    );
  }, [warehouseShipments, selectedShipmentIds, manifest]);

  const selectedShipments = useMemo(() => {
    return warehouseShipments.filter((s) => selectedShipmentIds.includes(s.id));
  }, [warehouseShipments, selectedShipmentIds]);

  const totalPackages = useMemo(() => {
    return selectedShipments.reduce((sum, s) => {
      if (s.packagesCount) return sum + Number(s.packagesCount);
      const itemsCount = Array.isArray(s.items)
        ? s.items.reduce((acc: number, item: any) => acc + (Number(item.packageCount) || 1), 0)
        : 1;
      return sum + itemsCount;
    }, 0);
  }, [selectedShipments]);

  const totalWeightKg = useMemo(() => {
    return selectedShipments.reduce((sum, s) => {
      if (s.grossWeightKg) return sum + Number(s.grossWeightKg);
      return sum + 45;
    }, 0);
  }, [selectedShipments]);

  const activeManifestNo = useMemo(() => {
    if (manifest?.manifestNumber || manifest?.id) {
      return manifest.manifestNumber || manifest.id;
    }
    return `MNF-26-${String((dispatchManifests?.length ?? 0) + 1).padStart(4, "0")}`;
  }, [manifest, dispatchManifests]);

  const handleToggleShipment = (id: string) => {
    setSelectedShipmentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedShipmentIds.length === candidateShipments.length) {
      setSelectedShipmentIds([]);
    } else {
      setSelectedShipmentIds(candidateShipments.map((s) => s.id));
    }
  };

  const handleCarrierPresetSelect = (carrierId: string) => {
    const found = carriersList.find((c) => c.id === carrierId);
    if (!found) return;
    if (found.vehicleNo) setVehiclePlate(found.vehicleNo);
    if (found.vehicleModel || found.name) setVehicleModel(found.vehicleModel || found.name);
    if (found.driverName) setDriverName(found.driverName);
    if (found.driverPhone) setDriverPhone(found.driverPhone);
  };

  const handleSaveManifest = async (overrideStatus?: string) => {
    if (selectedShipmentIds.length === 0) {
      addNotification({
        title: "Yuk tanlanmagan",
        description: "Reysga biriktirish uchun ro'yxatdan kamida bitta yukni (chiqimni) belgilang.",
        severity: "warning",
      });
      return;
    }
    try {
      setIsSubmitting(true);
      const finalStatus = overrideStatus || status || "Loading";
      const manifestPayload = {
        id: manifest?.dbId || manifest?.id,
        manifestNumber: manifest ? (manifest.manifestNumber || manifest.id) : "",
        date: manifest?.date || new Date().toISOString().split("T")[0],
        vehiclePlate,
        vehicleModel,
        driverName,
        driverPhone,
        destinationRoute,
        departureTime,
        status: finalStatus,
        totalShipmentsCount: selectedShipments.length,
        totalPackages,
        totalWeightKg,
        notes,
        shipmentIds: selectedShipmentIds,
        companyId: manifest?.companyId || selectedShipments[0]?.companyId || (activeCompanyId !== "ALL" ? activeCompanyId : undefined),
      };

      const res = await upsertDispatchManifestAsync(manifestPayload);
      const isSuccess = typeof res === "boolean" ? res : Boolean(res?.success);
      if (isSuccess) {
        const savedNo = (typeof res === "object" && res?.manifestNumber) || manifestPayload.manifestNumber || activeManifestNo;
        addNotification({
          title: "Reys saqlandi",
          description: `${savedNo} reysiga ${selectedShipments.length} ta yuk muvaffaqiyatli biriktirildi.`,
          severity: "success",
        });
        onOpenChange(false);
      } else {
        const errDesc = (typeof res === "object" && res?.error) ? res.error : "Reysni saqlashda server xatoligi yuz berdi. Iltimos qayta urinib ko'ring.";
        addNotification({
          title: "Saqlashda xatolik",
          description: errDesc,
          severity: "error",
        });
      }
    } catch (err) {
      console.error(err);
      addNotification({
        title: "Saqlashda xatolik",
        description: err instanceof Error ? err.message : "Reysni saqlashda xatolik yuz berdi.",
        severity: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 border-border bg-card">
        {/* Header */}
        <DialogHeader className="px-4 py-2.5 border-b border-border bg-muted/30 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600/10 flex items-center justify-center shrink-0">
              <Truck className="size-3.5 text-blue-600" />
            </div>
            <DialogTitle className="text-xs font-semibold text-foreground flex items-center gap-2">
              <span>Reys hujjati</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{activeManifestNo}</span>
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1.5 mr-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPrintPreview(!isPrintPreview)}
              className="h-7 text-xs px-2.5 gap-1.5"
            >
              <Printer className="size-3.5" />
              <span>{isPrintPreview ? "Tahrirlash" : "Marshrut varaqasi"}</span>
            </Button>
          </div>
        </DialogHeader>

        {isPrintPreview ? (
          /* A4 Printable Manifest Preview */
          <div className="p-6 bg-white text-black font-sans text-xs max-h-[68vh] overflow-y-auto">
            <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-base font-bold uppercase tracking-wider">
                  Yuk Tashish Marshrut Varaqasi
                </h2>
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  Reys №: {activeManifestNo} | Sana: {manifest?.date || new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="text-right text-xs">
                <span className="font-bold">PRINTGOO LOGISTICS</span>
                <p className="text-gray-500">Tayyor mahsulotlar ombori</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border p-3 rounded mb-4 bg-gray-50 text-xs">
              <div>
                <p><strong>Avtotransport:</strong> {vehicleModel} ({vehiclePlate})</p>
                <p><strong>Haydovchi:</strong> {driverName} ({driverPhone})</p>
              </div>
              <div>
                <p><strong>Marshrut:</strong> {destinationRoute}</p>
                <p><strong>Jo&apos;nash vaqti:</strong> {departureTime} | <strong>Yuk:</strong> {totalPackages} quti ({totalWeightKg} kg)</p>
              </div>
            </div>

            <h3 className="font-bold text-xs uppercase mb-2">Ortilgan Yuk Xatlari va Mijozlar:</h3>
            <table className="w-full border-collapse border border-gray-300 text-xs mb-4">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="border border-gray-300 p-1.5 text-left w-8">№</th>
                  <th className="border border-gray-300 p-1.5 text-left w-28">Chiqim №</th>
                  <th className="border border-gray-300 p-1.5 text-left">Buyurtmachi</th>
                  <th className="border border-gray-300 p-1.5 text-left">Mahsulotlar</th>
                  <th className="border border-gray-300 p-1.5 text-right w-24">Miqdor</th>
                  <th className="border border-gray-300 p-1.5 text-center w-24">Imzo</th>
                </tr>
              </thead>
              <tbody>
                {selectedShipments.map((s, idx) => {
                  const itemsSummary = Array.isArray(s.items) && s.items.length > 0
                    ? s.items.map((i: any) => `${i.name} (${Number(i.quantity ?? i.shippedQty).toLocaleString()} ${i.unit || "dona"})`).join(", ")
                    : s.product || "Mahsulot";

                  const totalQty = Array.isArray(s.items) && s.items.length > 0
                    ? s.items.reduce((sum: number, i: any) => sum + (Number(i.quantity ?? i.shippedQty) || 0), 0)
                    : Number(s.quantity) || 0;

                  return (
                    <tr key={s.id} className="border-b border-gray-300">
                      <td className="border border-gray-300 p-1.5 text-center font-mono">{idx + 1}</td>
                      <td className="border border-gray-300 p-1.5 font-mono font-bold">{(s as any).shipmentNumber || s.id}</td>
                      <td className="border border-gray-300 p-1.5 font-medium">{(s as any).customerName || s.customer}</td>
                      <td className="border border-gray-300 p-1.5">{itemsSummary}</td>
                      <td className="border border-gray-300 p-1.5 text-right font-mono">{totalQty.toLocaleString()}</td>
                      <td className="border border-gray-300 p-1.5 text-center text-gray-400">_______</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-between items-end mt-8 pt-4 border-t border-gray-300 text-xs">
              <div>
                <p>Ombor mudiri: _______________________</p>
              </div>
              <div>
                <p>Haydovchi: {driverName} _______________________</p>
              </div>
            </div>
          </div>
        ) : (
          /* Editor Mode */
          <div className="p-3.5 space-y-3 max-h-[68vh] overflow-y-auto">
            {/* Quick Carrier Selector + Status */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Avtoparkdan tanlash:</span>
                <Select onValueChange={(v) => v && handleCarrierPresetSelect(String(v))}>
                  <SelectTrigger className="h-7 w-56 text-xs">
                    <SelectValue placeholder="Mashina va haydovchi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {carriersList.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name} {c.vehicleNo ? `(${c.vehicleNo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Reys holati:</span>
                <Select value={status} onValueChange={(v) => v && setStatus(String(v))}>
                  <SelectTrigger className="h-7 w-40 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Loading" className="text-xs">Yuklanmoqda</SelectItem>
                    <SelectItem value="InTransit" className="text-xs">Yo&apos;lda (Jo&apos;natilgan)</SelectItem>
                    <SelectItem value="Completed" className="text-xs">Yakunlandi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vehicle & Logistics Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 p-2.5 rounded-md border border-border bg-muted/20">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Truck className="size-3 text-muted-foreground" />
                  Davlat raqami
                </label>
                <Input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="01 A 772 BB"
                  className="h-7 text-xs font-mono mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Mashina rusumi</label>
                <Input
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="ISUZU Furgon 3.5t"
                  className="h-7 text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <User className="size-3 text-muted-foreground" />
                  Haydovchi
                </label>
                <Input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Rustam Ismoilov"
                  className="h-7 text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Phone className="size-3 text-muted-foreground" />
                  Telefon
                </label>
                <Input
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+998 90 123-45-67"
                  className="h-7 text-xs font-mono mt-1"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3 text-muted-foreground" />
                  Yo&apos;nalish
                </label>
                <Input
                  value={destinationRoute}
                  onChange={(e) => setDestinationRoute(e.target.value)}
                  placeholder="Chilonzor - Sergeli - Yangihayot"
                  className="h-7 text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Jo&apos;nash vaqti</label>
                <Input
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  placeholder="14:30"
                  className="h-7 text-xs font-mono mt-1"
                />
              </div>
            </div>

            {/* Shipments Selector Table */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Biriktiriladigan yuk xatlari ({selectedShipmentIds.length} ta)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-6 text-[11px] text-primary px-2"
                >
                  {selectedShipmentIds.length === candidateShipments.length ? "Barchasini yechish" : "Barchasini tanlash"}
                </Button>
              </div>

              <div className="border border-border rounded-md overflow-hidden max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10">
                    <TableRow className="h-7 border-b border-border">
                      <TableHead className="w-8 px-2 text-center">
                        <Checkbox
                          checked={selectedShipmentIds.length > 0 && selectedShipmentIds.length === candidateShipments.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground px-2 h-7">Chiqim №</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground px-2 h-7">Mijoz</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground px-2 h-7">Mahsulotlar</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground px-2 h-7 text-right">Adad</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground px-2 h-7 text-center">Holati</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidateShipments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                          Tayyor chiqim hujjatlari topilmadi
                        </TableCell>
                      </TableRow>
                    ) : (
                      candidateShipments.map((s) => {
                        const isSelected = selectedShipmentIds.includes(s.id);
                        const itemsSummary = Array.isArray(s.items) && s.items.length > 0
                          ? s.items.map((i: any) => `${i.name} (${Number(i.quantity ?? i.shippedQty).toLocaleString()})`).join(", ")
                          : s.product || "Mahsulot";

                        const totalQty = Array.isArray(s.items) && s.items.length > 0
                          ? s.items.reduce((sum: number, i: any) => sum + (Number(i.quantity ?? i.shippedQty) || 0), 0)
                          : Number(s.quantity) || 0;

                        return (
                          <TableRow
                            key={s.id}
                            onClick={() => handleToggleShipment(s.id)}
                            className="h-7 border-b border-border hover:bg-muted/30 cursor-pointer"
                          >
                            <TableCell className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleShipment(s.id)}
                              />
                            </TableCell>
                            <TableCell className="px-2 py-1 font-mono text-xs font-semibold text-primary">
                              {(s as any).shipmentNumber || s.id}
                            </TableCell>
                            <TableCell className="px-2 py-1 text-xs font-medium text-foreground">
                              {(s as any).customerName || s.customer}
                            </TableCell>
                            <TableCell className="px-2 py-1 text-xs text-muted-foreground truncate max-w-[240px]">
                              {itemsSummary}
                            </TableCell>
                            <TableCell className="px-2 py-1 text-xs text-right font-mono">
                              {totalQty.toLocaleString()}
                            </TableCell>
                            <TableCell className="px-2 py-1 text-center">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                                {s.status === "Packed" ? "Tayyor" : s.status === "Dispatched" ? "Yo'lda" : s.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Summary KPI Bar */}
            <div className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30 text-xs">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  Yuk xatlari: <strong className="text-foreground font-mono">{selectedShipmentIds.length} ta</strong>
                </span>
                <span className="text-muted-foreground">
                  Jami qutilar: <strong className="text-foreground font-mono">{totalPackages} ta</strong>
                </span>
                <span className="text-muted-foreground">
                  Jami vazn: <strong className="text-foreground font-mono">{totalWeightKg} kg</strong>
                </span>
              </div>
              <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/30 font-medium h-5 text-[10px]">
                Reys konsolidatsiyasi
              </Badge>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs px-3"
          >
            Yopish
          </Button>

          <div className="flex items-center gap-2">
            {isPrintPreview ? (
              <Button
                size="sm"
                onClick={() => window.print()}
                className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-medium shadow-none"
              >
                <Printer className="size-3.5" />
                <span>Chop etish</span>
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedShipmentIds.length === 0 || isSubmitting}
                  onClick={() => handleSaveManifest()}
                  className="h-7 text-xs px-3 gap-1.5 font-medium"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Saqlash ({selectedShipmentIds.length})</span>
                </Button>
                <Button
                  size="sm"
                  disabled={selectedShipmentIds.length === 0 || isSubmitting}
                  onClick={() => handleSaveManifest("InTransit")}
                  className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-medium shadow-none"
                >
                  <Send className="size-3.5" />
                  <span>Reysni jo&apos;natish</span>
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
