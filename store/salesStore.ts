import { create } from "zustand";

export type PaymentMethod = "Cash" | "Debt" | "Quote";

export interface SaleItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface SaleRecord {
  id: string;
  timestamp: string;
  clientName: string | null;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status?: string;
  cashier?: string;
  registerId?: string;
}

const SEED_SALES_HISTORY: SaleRecord[] = [
  {
    id: "TXN-84920",
    timestamp: "2026-10-01T16:42:15.000Z",
    clientName: "Global Retailers Ltd",
    items: [
      { id: "SKU-8001", name: "Premium Cotton Polo (Navy)", price: 15.00, qty: 120 },
      { id: "SKU-8008", name: "High-Vis Safety Vest", price: 12.00, qty: 50 },
      { id: "SKU-8011", name: "Thermal Winter Gloves", price: 8.50, qty: 80 },
    ],
    subtotal: 3080.00,
    discountAmount: 154.00,
    taxAmount: 292.60,
    total: 3218.60,
    paymentMethod: "Debt",
    status: "Completed",
    cashier: "Alexey Kovalev",
    registerId: "POS-01",
  },
  {
    id: "TXN-84919",
    timestamp: "2026-10-01T15:20:00.000Z",
    clientName: null,
    items: [
      { id: "SKU-8001", name: "Premium Cotton Polo (Navy)", price: 15.00, qty: 2 },
    ],
    subtotal: 30.00,
    discountAmount: 0.00,
    taxAmount: 3.00,
    total: 33.00,
    paymentMethod: "Cash",
    status: "Completed",
    cashier: "Alexey Kovalev",
    registerId: "POS-01",
  },
  {
    id: "TXN-84918",
    timestamp: "2026-10-01T14:15:30.000Z",
    clientName: "Metro Hosp. Group",
    items: [
      { id: "SKU-8003", name: "Luxury Hotel Towel Set", price: 15.00, qty: 300 },
      { id: "SKU-8009", name: "Standard Bed Sheet Set", price: 28.00, qty: 150 },
      { id: "SKU-8014", name: "Spa Bathrobe (Plush)", price: 32.00, qty: 60 },
      { id: "SKU-8019", name: "Duvet Cover (King)", price: 38.00, qty: 80 },
    ],
    subtotal: 13660.00,
    discountAmount: 683.00,
    taxAmount: 1297.70,
    total: 14274.70,
    paymentMethod: "Debt",
    status: "Completed",
    cashier: "Elena Voronina",
    registerId: "POS-02",
  },
  {
    id: "TXN-84917",
    timestamp: "2026-10-01T13:05:10.000Z",
    clientName: null,
    items: [
      { id: "SKU-8002", name: "Industrial Work Jacket", price: 35.00, qty: 1 },
    ],
    subtotal: 35.00,
    discountAmount: 0.00,
    taxAmount: 3.50,
    total: 38.50,
    paymentMethod: "Cash",
    status: "Completed",
    cashier: "Alexey Kovalev",
    registerId: "POS-01",
  },
  {
    id: "TXN-84916",
    timestamp: "2026-10-01T11:45:00.000Z",
    clientName: "City Workwear Co.",
    items: [
      { id: "SKU-8005", name: "Chef Coat (White)", price: 20.00, qty: 45 },
      { id: "SKU-8006", name: "Denim Apron", price: 18.00, qty: 45 },
    ],
    subtotal: 1710.00,
    discountAmount: 85.50,
    taxAmount: 162.45,
    total: 1786.95,
    paymentMethod: "Quote",
    status: "Pending",
    cashier: "Elena Voronina",
    registerId: "POS-02",
  },
  {
    id: "TXN-84915",
    timestamp: "2026-10-01T10:12:45.000Z",
    clientName: null,
    items: [
      { id: "SKU-8021", name: "Custom Embroidered Cap", price: 8.00, qty: 3 },
    ],
    subtotal: 24.00,
    discountAmount: 0.00,
    taxAmount: 2.40,
    total: 26.40,
    paymentMethod: "Cash",
    status: "Completed",
    cashier: "Alexey Kovalev",
    registerId: "POS-01",
  },
  {
    id: "TXN-84914",
    timestamp: "2026-09-30T17:30:20.000Z",
    clientName: "Premier Textiles",
    items: [
      { id: "SKU-8007", name: "Medical Scrubs (Blue)", price: 22.00, qty: 200 },
      { id: "SKU-8022", name: "Isolation Gowns (Box of 50)", price: 65.00, qty: 40 },
    ],
    subtotal: 7000.00,
    discountAmount: 350.00,
    taxAmount: 665.00,
    total: 7315.00,
    paymentMethod: "Debt",
    status: "Completed",
    cashier: "Alexey Kovalev",
    registerId: "POS-01",
  },
  {
    id: "TXN-84913",
    timestamp: "2026-09-30T16:00:15.000Z",
    clientName: null,
    items: [
      { id: "SKU-8023", name: "Barista Apron (Leather Trim)", price: 26.00, qty: 1 },
    ],
    subtotal: 26.00,
    discountAmount: 0.00,
    taxAmount: 2.60,
    total: 28.60,
    paymentMethod: "Cash",
    status: "Completed",
    cashier: "Alexey Kovalev",
    registerId: "POS-01",
  },
  {
    id: "TXN-84912",
    timestamp: "2026-09-30T14:40:00.000Z",
    clientName: "Global Retailers Ltd",
    items: [
      { id: "SKU-8013", name: "Corporate Oxford Shirt (Light Blue)", price: 24.00, qty: 85 },
      { id: "SKU-8024", name: "Fleece Zip-Up Vest", price: 21.00, qty: 50 },
      { id: "SKU-8015", name: "Canvas Tote Bags (Blank)", price: 3.50, qty: 200 },
    ],
    subtotal: 3790.00,
    discountAmount: 189.50,
    taxAmount: 360.05,
    total: 3960.55,
    paymentMethod: "Quote",
    status: "Pending",
    cashier: "Elena Voronina",
    registerId: "POS-02",
  },
  {
    id: "TXN-84911",
    timestamp: "2026-09-30T12:15:30.000Z",
    clientName: null,
    items: [
      { id: "SKU-8004", name: "Fleece Blanket (Queen)", price: 25.00, qty: 2 },
    ],
    subtotal: 50.00,
    discountAmount: 5.00,
    taxAmount: 4.50,
    total: 49.50,
    paymentMethod: "Cash",
    status: "Completed",
    cashier: "Alexey Kovalev",
    registerId: "POS-01",
  },
];

interface SalesState {
  salesHistory: SaleRecord[];
  addSale: (sale: SaleRecord) => void;
  clearHistory: () => void;
}

export const useSalesStore = create<SalesState>((set) => ({
  salesHistory: SEED_SALES_HISTORY,
  addSale: (sale) => set((state) => ({ 
    salesHistory: [sale, ...state.salesHistory]
  })),
  clearHistory: () => set({ salesHistory: [] }),
}));
