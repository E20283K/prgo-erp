"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, ShoppingCart, Trash2, CreditCard, Banknote, User, Package, Minus, Plus, FileText, LayoutGrid, List, ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { 
  DataEditor, 
  GridCell, 
  GridCellKind, 
  GridColumn, 
  Item as GridItem, 
  GridSelection, 
  CompactSelection, 
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useSalesStore, PaymentMethod } from "@/store/salesStore";
import { History, Clock } from "lucide-react";

const MOCK_CLIENTS = [
  { id: "C-001", name: "Global Retailers Ltd", terms: "Net 30" },
  { id: "C-002", name: "Metro Hosp. Group", terms: "Net 60" },
  { id: "C-003", name: "City Workwear Co.", terms: "Due on Receipt" },
  { id: "C-004", name: "Premier Textiles", terms: "Net 15" },
];

// Mock B2B Catalog
const POS_PRODUCTS = [
  { id: "SKU-8001", name: "Premium Cotton Polo (Navy)", price: 15.00, category: "Apparel", stock: 1500, image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=200&q=80" },
  { id: "SKU-8002", name: "Industrial Work Jacket", price: 35.00, category: "Workwear", stock: 400, image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=200&q=80" },
  { id: "SKU-8003", name: "Luxury Hotel Towel Set", price: 15.00, category: "Hospitality", stock: 2500, image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=200&q=80" },
  { id: "SKU-8004", name: "Fleece Blanket (Queen)", price: 25.00, category: "Home Textile", stock: 800, image: "https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?w=200&q=80" },
  { id: "SKU-8005", name: "Chef Coat (White)", price: 20.00, category: "Hospitality", stock: 600, image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=200&q=80" },
  { id: "SKU-8006", name: "Denim Apron", price: 18.00, category: "Workwear", stock: 300, image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=200&q=80" },
  { id: "SKU-8007", name: "Medical Scrubs (Blue)", price: 22.00, category: "Healthcare", stock: 1200, image: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=200&q=80" },
  { id: "SKU-8008", name: "High-Vis Safety Vest", price: 12.00, category: "Workwear", stock: 900, image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=200&q=80" },
  { id: "SKU-8009", name: "Standard Bed Sheet Set", price: 28.00, category: "Hospitality", stock: 500, image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=200&q=80" },
  { id: "SKU-8010", name: "Microfiber Cleaning Cloths (50pk)", price: 18.50, category: "Cleaning", stock: 3200, image: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=200&q=80" },
  { id: "SKU-8011", name: "Thermal Winter Gloves", price: 8.50, category: "Workwear", stock: 1800, image: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=200&q=80" },
  { id: "SKU-8012", name: "Disposable Hairnets (1000pk)", price: 45.00, category: "Healthcare", stock: 150, image: "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=200&q=80" },
  { id: "SKU-8013", name: "Corporate Oxford Shirt (Light Blue)", price: 24.00, category: "Apparel", stock: 850, image: "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=200&q=80" },
  { id: "SKU-8014", name: "Spa Bathrobe (Plush)", price: 32.00, category: "Hospitality", stock: 400, image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=200&q=80" },
  { id: "SKU-8015", name: "Canvas Tote Bags (Blank)", price: 3.50, category: "Accessories", stock: 5000, image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=200&q=80" },
  { id: "SKU-8016", name: "Heavy Duty Cargo Pants", price: 29.00, category: "Workwear", stock: 650, image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=200&q=80" },
  { id: "SKU-8017", name: "Restaurant Tablecloth (White)", price: 14.00, category: "Hospitality", stock: 1100, image: "https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?w=200&q=80" },
  { id: "SKU-8018", name: "Mechanic Coveralls", price: 42.00, category: "Workwear", stock: 220, image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&q=80" },
  { id: "SKU-8019", name: "Duvet Cover (King)", price: 38.00, category: "Home Textile", stock: 450, image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=200&q=80" },
  { id: "SKU-8020", name: "Waterproof Rain Jacket", price: 27.50, category: "Workwear", stock: 380, image: "https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?w=200&q=80" },
  { id: "SKU-8021", name: "Custom Embroidered Cap", price: 8.00, category: "Accessories", stock: 2100, image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=200&q=80" },
  { id: "SKU-8022", name: "Isolation Gowns (Box of 50)", price: 65.00, category: "Healthcare", stock: 300, image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&q=80" },
  { id: "SKU-8023", name: "Barista Apron (Leather Trim)", price: 26.00, category: "Hospitality", stock: 180, image: "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=200&q=80" },
  { id: "SKU-8024", name: "Fleece Zip-Up Vest", price: 21.00, category: "Apparel", stock: 720, image: "https://images.unsplash.com/photo-1545042746-ec9e5a59b359?w=200&q=80" }
];

export function SalesPOS() {
  const tMod = useTranslations("Modules");
  const { theme, addNotification, setActiveModule, setModule, openTab } = useWorkspaceStore();
  const { addSale, salesHistory } = useSalesStore();
  const isDark = theme === "dark";

  const [cart, setCart] = useState<{ product: any; qty: number }[]>([]);
  const [search, setSearch] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxExempt, setTaxExempt] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [openClient, setOpenClient] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredProducts = POS_PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()));

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
  const discountAmount = discountType === "percentage" ? (subtotal * (discountValue || 0)) / 100 : (discountValue || 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = taxExempt ? 0 : taxableAmount * 0.10; // 10% mock tax
  const total = taxableAmount + tax;

  const handleCheckout = (method: PaymentMethod) => {
    if (cart.length === 0) return;
    
    const clientName = selectedClient ? MOCK_CLIENTS.find(c => c.id === selectedClient)?.name || null : null;
    
    addSale({
      id: `TXN-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      timestamp: new Date().toISOString(),
      clientName,
      items: cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        qty: item.qty
      })),
      subtotal,
      discountAmount,
      taxAmount: tax,
      total,
      paymentMethod: method
    });

    setCart([]);
    setDiscountValue(0);
    setTaxExempt(false);
    setSelectedClient(null);
    setCheckoutOpen(false);
    
    if (addNotification) {
      addNotification({ title: "Sale Completed", description: `Order saved successfully (${method}).`, severity: "success" });
    }
  };

  const columns: GridColumn[] = React.useMemo(() => [
    { id: "image", title: "Photo", width: 64, icon: GridColumnIcon.HeaderImage },
    { id: "id", title: "SKU", width: 110, icon: GridColumnIcon.HeaderReference },
    { id: "name", title: "Product Name", width: 250, icon: GridColumnIcon.HeaderTextTemplate },
    { id: "category", title: "Category", width: 150, icon: GridColumnIcon.HeaderString },
    { id: "price", title: "Price ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
    { id: "stock", title: "Stock", width: 120, icon: GridColumnIcon.HeaderNumber },
  ], []);

  const getContent = React.useCallback((cell: GridItem): GridCell => {
    const [col, row] = cell;
    const product = filteredProducts[row];
    if (!product) {
      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    }
    const column = columns[col];

    if (column.id === "image") {
      return {
        kind: GridCellKind.Image,
        data: [product.image],
        displayData: [product.image],
        allowOverlay: false,
      };
    }

    let val: any = product[column.id as keyof typeof product];

    return {
      kind: typeof val === "number" ? GridCellKind.Number : GridCellKind.Text,
      data: val,
      displayData: String(val),
      allowOverlay: false,
      readonly: true,
      contentAlign: typeof val === "number" ? "right" : "left",
    };
  }, [filteredProducts, columns]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (id: string, newQty: number) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(item => item.product.id === id ? { ...item, qty: newQty } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
  };

  return (
    <div className="flex h-full w-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
      {/* Left side - Product Catalog */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border bg-card">
        <div className="p-2 border-b border-border flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <SidebarTrigger className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md" />
            <div className="relative flex-1">
              <InputGroup className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                <InputGroupAddon align="inline-start" className="pl-2.5">
                  <Search className="size-3.5 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput 
                  placeholder="Search by name or SKU..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-xs pl-0"
                />
              </InputGroup>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveModule("sales");
                setModule("sales", "orders");
                openTab({
                  id: "tab-sales-orders",
                  title: tMod("orders"),
                  type: "registry",
                  module: "sales",
                });
              }}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <History className="w-3.5 h-3.5" />
              <span>{tMod("orders")}</span>
            </Button>

            <div className="flex bg-muted/50 dark:bg-zinc-900 border border-border p-0.5 rounded-md shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-sm flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-sm flex items-center justify-center transition-colors ${viewMode === "table" ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className="group flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden cursor-pointer hover:border-blue-500 hover:shadow-sm transition-all h-[170px]"
                >
                  <div className="h-24 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 relative overflow-hidden">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="object-cover w-full h-full mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 flex flex-col flex-1 min-h-0">
                    <div className="text-[10px] text-muted-foreground font-mono mb-1 truncate">{product.id}</div>
                    <div className="text-sm font-medium leading-tight mb-2 flex-1 line-clamp-2">{product.name}</div>
                    <div className="flex items-center justify-between mt-auto shrink-0">
                      <span className="font-semibold text-xs text-blue-600 dark:text-blue-400">${product.price.toFixed(2)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono shadow-none bg-white/50 dark:bg-black/50">{product.stock}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 w-full h-full relative border border-border rounded-lg overflow-hidden" id="pos-grid-root">
              <DataEditor
                getCellContent={getContent}
                columns={columns}
                rows={filteredProducts.length}
                rowMarkers="none"
                freezeColumns={1}
                smoothScrollX={true}
                smoothScrollY={true}
                width="100%"
                height="100%"
                gridSelection={selection}
                onGridSelectionChange={setSelection}
                onCellActivated={(cell) => addToCart(filteredProducts[cell[1]])}
                headerHeight={32}
                rowHeight={36}
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right side - Cart / Ticket */}
      <div className="w-[450px] h-full shrink-0 flex flex-col min-h-0 border-l border-border bg-white dark:bg-zinc-900 relative">
        <div className="p-2 px-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between shrink-0 h-[49px]">
          <div className="font-semibold flex items-center gap-1.5 text-sm">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            <span>Current Ticket</span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearCart} className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center mt-20">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">Ticket is empty.</p>
              <p className="text-xs mt-1">Select products to add them to the ticket.</p>
            </div>
          ) : (
            <ItemGroup className="p-3 gap-2">
              {cart.map(item => (
                <Item key={item.product.id} variant="outline" className="p-2 gap-3 hover:bg-muted/30 shadow-sm border-border bg-white dark:bg-zinc-950">
                  <ItemMedia variant="image" className="size-12 rounded">
                    <img src={item.product.image} alt={item.product.name} loading="lazy" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-sm">{item.product.name}</ItemTitle>
                    <ItemDescription className="font-mono flex items-center gap-1.5 mt-1">
                      <span className="truncate max-w-[80px]" title={item.product.id}>{item.product.id}</span>
                      <span className="opacity-50">•</span>
                      <span className="whitespace-nowrap">${item.product.price.toFixed(2)} / ea</span>
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="flex-col items-end gap-1.5 self-stretch justify-between py-0.5">
                    <div className="font-semibold text-sm shrink-0">${(item.product.price * item.qty).toFixed(2)}</div>
                    <InputGroup className="w-24 h-7 bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0 p-0.5 rounded-md">
                      <InputGroupButton variant="ghost" size="icon-xs" onClick={() => updateQty(item.product.id, item.qty - 1)} className="hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                        <Minus className="w-3 h-3" />
                      </InputGroupButton>
                      <InputGroupInput 
                        type="number" 
                        value={item.qty} 
                        onChange={(e) => updateQty(item.product.id, parseInt(e.target.value) || 1)}
                        className="text-center font-medium text-xs px-0 min-w-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <InputGroupButton variant="ghost" size="icon-xs" onClick={() => updateQty(item.product.id, item.qty + 1)} className="hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                        <Plus className="w-3 h-3" />
                      </InputGroupButton>
                    </InputGroup>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </div>

        {/* Totals & Payment */}
        <div className="border-t border-border bg-zinc-50 dark:bg-zinc-950 p-4 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-10">
          <div className="flex justify-between font-bold text-lg mb-3">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
            <DialogTrigger render={<Button className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-none" disabled={cart.length === 0} />}>
              <ShoppingCart className="w-4 h-4 mr-2" /> Checkout ({cart.reduce((s, i) => s + i.qty, 0)} items)
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Complete Order</DialogTitle>
              </DialogHeader>

              {/* Client Selection */}
              <div className="mt-2 mb-2 flex flex-col gap-1.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">B2B Client</div>
                <Popover open={openClient} onOpenChange={setOpenClient}>
                  <PopoverTrigger render={
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openClient}
                      className={`w-full justify-between px-3 h-10 shadow-sm ${!selectedClient ? "text-muted-foreground" : "font-medium"}`}
                    >
                      <span className="truncate">
                        {selectedClient 
                          ? MOCK_CLIENTS.find(c => c.id === selectedClient)?.name 
                          : "Search & select B2B Client..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  } />
                  <PopoverContent className="w-[400px] p-0 shadow-md">
                    <Command>
                      <CommandInput placeholder="Search clients by name..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          {MOCK_CLIENTS.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.name}
                              data-checked={selectedClient === client.id}
                              onSelect={() => {
                                setSelectedClient(client.id === selectedClient ? null : client.id)
                                setOpenClient(false)
                              }}
                              className="py-2"
                            >
                              <span className="flex-1 font-medium">{client.name}</span>
                              <span className="text-muted-foreground text-xs font-mono ml-2">({client.terms})</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Discount Input */}
              <div className="flex flex-col gap-1.5 mt-4 mb-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Discount</span>
                <InputGroup className="bg-white dark:bg-zinc-950 shadow-sm h-10 p-1">
                  <div className="flex shrink-0 h-full bg-zinc-100 dark:bg-zinc-900 rounded-[calc(var(--radius)-4px)] p-0.5">
                    <button 
                      onClick={() => setDiscountType("fixed")}
                      className={`px-3 py-1 h-full text-xs font-medium transition-colors rounded-[calc(var(--radius)-6px)] ${discountType === "fixed" ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm" : "bg-transparent text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"}`}
                    >$</button>
                    <button 
                      onClick={() => setDiscountType("percentage")}
                      className={`px-3 py-1 h-full text-xs font-medium transition-colors rounded-[calc(var(--radius)-6px)] ${discountType === "percentage" ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm" : "bg-transparent text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"}`}
                    >%</button>
                  </div>
                  <InputGroupInput 
                    type="number"
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="text-right font-medium text-foreground px-2 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    placeholder="0.00"
                  />
                </InputGroup>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Summary</div>
                <div className="space-y-3 text-sm border border-border p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 shadow-sm">
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Discount ({discountType === "percentage" ? `${discountValue}%` : 'Fixed'})</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-muted-foreground font-medium">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors group">
                      <Checkbox checked={taxExempt} onCheckedChange={(c) => setTaxExempt(!!c)} />
                      <span onClick={() => setTaxExempt(!taxExempt)}>Tax Exempt (10%)</span>
                    </div>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <Separator className="my-2 bg-border/80" />
                  <div className="flex justify-between items-baseline font-bold">
                    <span className="text-base text-foreground">Total Due</span>
                    <span className="text-xl text-blue-600 dark:text-blue-400">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                <Button 
                  onClick={() => handleCheckout("Quote")}
                  className="h-10 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-200 dark:hover:bg-zinc-100 dark:text-zinc-900 text-white gap-2 font-semibold shadow-none text-xs col-span-2"
                >
                  <FileText className="w-4 h-4" />
                  Generate Draft / Quote
                </Button>
                <Button 
                  onClick={() => handleCheckout("Debt")}
                  className="h-12 bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold shadow-none" 
                  disabled={!selectedClient}
                >
                  <User className="w-4 h-4" />
                  Put on Debt
                </Button>
                <Button 
                  onClick={() => handleCheckout("Cash")}
                  className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-none"
                >
                  <Banknote className="w-4 h-4" />
                  Pay Cash
                </Button>
              </div>
              {!selectedClient && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center font-medium mt-1">
                  * Select a B2B client to enable "Put on Debt"
                </p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
