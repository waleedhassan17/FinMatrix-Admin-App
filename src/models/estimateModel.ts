// ═══════════════════════════════════════════════════════
// FinMatrix — Estimate (Quote) Model + UI types
// ═══════════════════════════════════════════════════════

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted' | 'expired';
export type DiscountType = 'percent' | 'amount' | 'none';

export interface EstimateLine {
  id?: string;
  /** Linked inventory item, '' for a free-text/service line. Carried to the
   *  sales order or invoice this becomes, where it drives COGS. */
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export interface Estimate {
  id: string;
  estimateNumber: string;
  customerId: string;
  customerName: string;
  estimateDate: string;
  expiryDate: string | null;
  status: EstimateStatus;
  lines: EstimateLine[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes: string;
  convertedToType: 'invoice' | 'sales_order' | null;
  convertedToId: string | null;
}

export interface EstimateQueryParams {
  status?: string;
  customerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}
