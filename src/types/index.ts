// ═══════════════════════════════════════════════════════
// FinMatrix — Complete TypeScript Type Definitions
// ═══════════════════════════════════════════════════════

// ─── Enums & Unions ───────────────────────────────────
/**
 * `staff` is a company role like `admin`: it comes from the user's membership
 * of the company, not from the platform. `delivery` is the rider portal and
 * `super_admin` the platform console.
 */
export type UserRole = 'admin' | 'staff' | 'delivery' | 'super_admin';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type AccountSubType =
  | 'current_asset'
  | 'fixed_asset'
  | 'current_liability'
  | 'long_term_liability'
  | 'owner_equity'
  | 'retained_earnings'
  | 'operating_revenue'
  | 'other_revenue'
  | 'operating_expense'
  | 'cost_of_goods';
export type JournalEntryStatus = 'draft' | 'posted' | 'voided';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void' | 'cancelled';
export type PaymentMethod = 'cash' | 'cheque' | 'bank_transfer' | 'online';
export type BillStatus = 'draft' | 'open' | 'partial' | 'paid' | 'overdue' | 'void';
export type PurchaseOrderStatus = 'draft' | 'sent' | 'partially_received' | 'fully_received' | 'closed';
export type SalesOrderStatus = 'open' | 'partially_fulfilled' | 'fulfilled' | 'closed';
export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type CreditMemoStatus = 'draft' | 'issued' | 'applied' | 'voided';
export type DeliveryStatus =
  | 'pending'
  | 'picked_up'
  | 'assigned'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'failed'
  | 'returned';
export type InventoryAdjustmentType = 'increase' | 'decrease' | 'transfer' | 'count';
export type NotificationType =
  | 'delivery_assigned'
  | 'delivery_completed'
  | 'inventory_low'
  | 'invoice_overdue'
  | 'bill_due'
  | 'journal_posted'
  | 'system';
export type PayrollStatus = 'draft' | 'processed' | 'paid';
export type BankTransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'fee'
  | 'interest'
  | 'card_charge'
  | 'card_payment';

// ─── User ─────────────────────────────────────────────
export interface User {
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  role: UserRole;
  companyId: string | null;
  phoneNumber: string;
  photoURL: string | null;
  isActive: boolean;
  /** Stage 1: company-admin email verification status. */
  isEmailVerified?: boolean;
  /** Stage 1: onboarding/approval state of the user's company. */
  companyStatus?: string | null;
  /** Three-tier model: small_business | large_org | warehouse (null = legacy). */
  companyType?: string | null;
  /** Effective feature flags for the company (server-computed, kill switch applied). */
  features?: Record<string, boolean> | null;
  /**
   * Plan + free-trial summary from signin / /auth/me. The trial countdown reads
   * this, so the shell never needs a billing fetch of its own.
   */
  subscription?: SubscriptionSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionSummary {
  plan: string;
  planLabel: string;
  /** ISO timestamp; null for a plan that never expires. */
  expiryDate: string | null;
  paymentStatus: string;
  /** Permanent history: true once a trial has been approved, even after paying. */
  isTrial: boolean;
  trialStartedAt: string | null;
  /** Set when a real payment was approved after the trial. */
  trialConvertedAt: string | null;
}

// ─── Company ──────────────────────────────────────────
export interface Company {
  id: string;
  name: string;
  industry: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  fiscalYearStart: string;
  currency: string;
  logoURL: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Chart of Accounts ───────────────────────────────
export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  description: string;
  parentId: string | null;
  isActive: boolean;
  isSystemAccount: boolean;
  balance: number;
  normalBalance: 'debit' | 'credit';
  createdAt: string;
  updatedAt: string;
}

// ─── Journal Entries ──────────────────────────────────
export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  entryNumber: string;
  date: string;
  description: string;
  reference: string;
  status: JournalEntryStatus;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  approvedBy: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Customer ─────────────────────────────────────────
export type PaymentTerms = 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'due_on_receipt' | '2_10_net30' | 'custom';

export interface CustomerAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  billingAddress: CustomerAddress;
  shippingAddress: CustomerAddress;
  creditLimit: number;
  paymentTerms: PaymentTerms;
  balance: number;
  totalPurchases: number;
  contactPerson: string;
  taxId: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Detail responses only: what the credit limit is checked against. */
  credit?: CustomerCredit;
}

export interface CustomerCredit {
  /** False when the limit is 0 — no limit. */
  limited: boolean;
  /** Open invoices + shipped on credit − advances − credit memos. */
  exposure: number;
  /** Money paid in advance and not yet applied to an invoice. */
  advances: number;
  /** null when there is no limit. */
  available: number | null;
}

// ─── Vendor ───────────────────────────────────────────
export interface Vendor {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxId: string;
  contactPerson: string;
  notes: string;
  balance: number;
  paymentTerms: string;
  defaultExpenseAccountId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Invoice ──────────────────────────────────────────
export interface InvoiceLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export type DiscountType = 'percent' | 'amount' | 'none';

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  subtotal: number;
  taxAmount: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment ──────────────────────────────────────────
export interface PaymentAllocation {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  /** What is still owing on the invoice now; null when the server did not say. */
  invoiceBalance?: number | null;
}

export interface Payment {
  id: string;
  companyId: string;
  paymentNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  method: PaymentMethod;
  reference: string;
  amount: number;
  allocations: PaymentAllocation[];
  /** Portion of `amount` not allocated to any invoice — kept as a customer credit for future use. */
  creditAmount: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Bill ─────────────────────────────────────────────
export interface BillLine {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export interface Bill {
  id: string;
  companyId: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  issueDate: string;
  dueDate: string;
  status: BillStatus;
  lines: BillLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Bill Payment ─────────────────────────────────────
export interface BillPaymentAllocation {
  billId: string;
  billNumber: string;
  amount: number;
}

export interface BillPayment {
  id: string;
  companyId: string;
  paymentNumber: string;
  vendorId: string;
  vendorName: string;
  date: string;
  method: PaymentMethod;
  reference: string;
  amount: number;
  bankAccountId: string;
  /**
   * Link to the payment proof. Null on payments recorded before proof became
   * mandatory — those rows must still render, just without a link.
   */
  proofUrl?: string | null;
  allocations: BillPaymentAllocation[];
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Vendor Credit ────────────────────────────────────
export interface VendorCreditLine {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  amount: number;
  taxRate: number;
}

export interface VendorCredit {
  id: string;
  companyId: string;
  creditNumber: string;
  vendorId: string;
  vendorName: string;
  date: string;
  lines: VendorCreditLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  appliedAmount: number;
  notes: string;
  status: 'draft' | 'issued' | 'applied' | 'voided';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Purchase Order ───────────────────────────────────
export interface PurchaseOrderLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Tax %; `amount` excludes it. */
  taxRate: number;
  amount: number;
  receivedQuantity: number;
  billedQuantity: number;
}

export interface PurchaseOrderBillRef {
  id: string;
  billNumber: string;
  billDate: string;
  total: number;
  balance: number;
  status: string;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  orderDate: string;
  expectedDate: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string;
  /** The latest bill raised from this PO; empty until the first. */
  billId: string;
  billNumber: string;
  /** Every bill raised from this PO — goods are billed per receipt. */
  bills: PurchaseOrderBillRef[];
  /** Tax-inclusive values, comparable with `total`. */
  receivedValueGross: number;
  billedValueGross: number;
  unbilledValueGross: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Sales Order ──────────────────────────────────────
export interface SalesOrderLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
  fulfilledQuantity: number;
}

export interface SalesOrder {
  id: string;
  companyId: string;
  soNumber: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  expectedDate: string;
  status: SalesOrderStatus;
  lines: SalesOrderLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Estimate ─────────────────────────────────────────
export interface Estimate {
  id: string;
  companyId: string;
  estimateNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  expirationDate: string;
  status: EstimateStatus;
  lines: InvoiceLine[];
  subtotal: number;
  taxAmount: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Credit Memo ──────────────────────────────────────
export interface CreditMemoLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export interface CreditMemo {
  id: string;
  companyId: string;
  creditMemoNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  status: CreditMemoStatus;
  invoiceId: string | null;
  invoiceNumber: string | null;
  lines: CreditMemoLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Inventory ────────────────────────────────────────
export interface InventoryItem {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  costPrice: number;
  sellingPrice: number;
  quantityOnHand: number;
  reorderLevel: number;
  reorderQuantity: number;
  warehouseId: string;
  warehouseName: string;
  barcode: string;
  isActive: boolean;
  lastCountDate: string | null;
  imageURL: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAdjustment {
  id: string;
  companyId: string;
  itemId: string;
  itemName: string;
  type: InventoryAdjustmentType;
  quantityBefore: number;
  quantityAfter: number;
  quantityChange: number;
  reason: string;
  reference: string;
  performedBy: string;
  performedAt: string;
}

export interface ShadowInventory {
  id: string;
  deliveryPersonId: string;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  lastSyncedAt: string;
}

export interface InventoryUpdateRequest {
  id: string;
  companyId: string;
  deliveryPersonId: string;
  deliveryPersonName: string;
  itemId: string;
  itemName: string;
  currentQuantity: number;
  requestedQuantity: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

// ─── Delivery ─────────────────────────────────────────
export interface DeliveryItem {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface Delivery {
  id: string;
  companyId: string;
  deliveryNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  deliveryPersonId: string;
  deliveryPersonName: string;
  status: DeliveryStatus;
  items: DeliveryItem[];
  totalAmount: number;
  assignedAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  signatureURL: string | null;
  photoURL: string | null;
  notes: string;
  failureReason: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryPerson {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  isAvailable: boolean;
  isActive: boolean;
  currentDeliveries: number;
  totalDeliveries: number;
  rating: number;
  photoURL: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Employee & Payroll ───────────────────────────────
export interface Employee {
  id: string;
  companyId: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  salary: number;
  payFrequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  bankAccountNumber: string;
  bankRoutingNumber: string;
  taxWithholding: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  companyId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  status: PayrollStatus;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Banking ──────────────────────────────────────────
export interface BankAccount {
  id: string;
  companyId: string;
  accountId: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings' | 'credit_card';
  balance: number;
  lastReconciledDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  companyId: string;
  date: string;
  payee: string;
  description: string;
  type: BankTransactionType;
  amount: number;
  balance: number;
  memo?: string;
  reference: string;
  isReconciled: boolean;
  transferPairId?: string;
  matchedTransactionId: string | null;
  createdAt: string;
}

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  companyId: string;
  statementDate: string;
  beginningBalance: number;
  endingBalance: number;
  clearedBalance: number;
  difference: number;
  clearedTransactionIds: string[];
  adjustmentTransactionId: string | null;
  createdAt: string;
}

// ─── Tax ──────────────────────────────────────────────
export type TaxType = 'GST' | 'WHT' | 'Income Tax' | 'Sales Tax' | 'Custom';

export interface TaxRate {
  id: string;
  companyId: string;
  name: string;
  rate: number;
  taxType: TaxType;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxPaymentRecord {
  id: string;
  companyId: string;
  taxRateId: string;
  taxRateName: string;
  taxType: TaxType;
  amount: number;
  date: string;
  bankAccountId: string;
  bankAccountName: string;
  reference: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxLiabilityRow {
  taxRateId: string;
  taxName: string;
  taxType: TaxType;
  rate: number;
  collected: number;
  paid: number;
  net: number;
}

export interface TaxLiabilityReport {
  fromDate: string;
  toDate: string;
  rows: TaxLiabilityRow[];
  totalCollected: number;
  totalPaid: number;
  totalNet: number;
}

// ─── Notifications ────────────────────────────────────
export interface Notification {
  id: string;
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

// ─── Audit ────────────────────────────────────────────
export interface AuditEntry {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  ipAddress: string;
  timestamp: string;
}

// ─── Navigation Params ────────────────────────────────
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  RoleSelection: undefined;
  // `role` is optional because several screens legitimately return the user to
  // sign-in without one (password reset, "Back to Sign In", sign-out). Under
  // React Navigation v7 a navigate() to a non-focused route PUSHES a fresh
  // route rather than reusing the existing one, so its params are exactly what
  // the caller passed — declaring `role` required made those call sites lie and
  // crashed the destructure in the screen.
  SignIn: { role?: UserRole } | undefined;
  SignUp: { role?: UserRole } | undefined;
  ForgotPassword: undefined;
  EmailVerification: { email?: string; token?: string } | undefined;
  CompanySetup: undefined;
  CompanyTypeSelect: undefined;
  CreateCompany: { companyType?: 'small_business' | 'large_org' | 'warehouse' } | undefined;
  JoinCompany: undefined;
  DeliveryOnboarding: undefined;
  PendingApproval: { fromLogin?: boolean; pendingKind?: 'trial' | 'payment' } | undefined;
  CompanyRejected: { fromLogin?: boolean; mode?: 'rejected' | 'inactive'; reason?: string } | undefined;
  AdminTabs: undefined;
  DeliveryTabs: undefined;
  SuperAdminTabs: undefined;
  SubscriptionSelect: { companyId?: string; companyType?: string } | undefined;
  RenewSubscription: { mode?: 'renew' | 'change' } | undefined;
  SubscriptionPay: { plan: string; mode?: 'renew' | 'change' | 'signup'; companyId?: string };
  PaymentSubmissions: undefined;
  DeliveryPersonnelList: undefined;
  AddDeliveryPersonnel: undefined;
  DeliveryPersonnelDetail: { userId: string };
  AssignDeliveries: undefined;
  CreateDelivery: undefined;
  AssignWork: undefined;
  DeliveryMonitor: undefined;
  AdminDeliveryDetail: { deliveryId: string };
};
