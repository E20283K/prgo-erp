export interface SizeDistribution {
  id: string;
  size: string;
  quantity: number;
}

export interface ProductionMilestone {
  id: string;
  name: string;
  department: string;
  status: "Pending" | "In Progress" | "Done" | "Issue";
  assignedTo?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface OrderAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  isImage?: boolean;
  /** Public or blob URL of the file contents (used for preview & download) */
  url?: string;
}

export interface ClientOrderFormData {
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  recipe: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press" | string;
  site: string;
  deadline: string;
  responsible: string;
  orderType: string; // "Sample" | "Production"
  linkedWoId: string;
  status: string;
  priority?: string;
  pressMachine?: string;
  paperStock?: string;
  coating?: string;
  priceTotal?: number;
  currency?: string;
  photoUrl?: string;
  attachments?: OrderAttachment[];
  // Physical Item Specifications
  itemCategory?: "Label" | "Hangtag" | "Card" | "Sticker" | "Jacquard Ribbon" | "Carton" | "Other" | string;
  width?: number;
  height?: number;
  dimensionUnit?: "mm" | "cm" | "in" | string;
  cornerType?: "Square" | "Rounded (R3)" | "Rounded (R5)" | "Die-cut" | "Center Fold" | "End Fold" | string;
  bleed?: number;
  milestones?: ProductionMilestone[];
  sizes?: SizeDistribution[];
}

export interface ClientOrderSampleData {
  dispatchDate: string;
  deliveryMethod: string;
  courierName: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  trackingNumber: string;
  sampleQty: number;
  packingNotes: string;
  isDispatched: boolean;
  approvalStatus: string; // "Pending" | "Approved" | "Revision Requested"
  approvalNotes: string;
}
