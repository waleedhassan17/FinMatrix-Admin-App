// ═══════════════════════════════════════════════════════
// FinMatrix — Credit Memo Model + UI types
// ═══════════════════════════════════════════════════════

export type CreditMemoStatus = 'open' | 'applied' | 'closed' | 'refunded' | 'void';

export interface CreditMemoLine {
  id?: string;
  itemId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export interface CreditMemo {
  id: string;
  creditMemoNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  originalInvoiceId: string | null;
  reason: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountApplied: number;
  balance: number;
  status: CreditMemoStatus;
  lines: CreditMemoLine[];
}
