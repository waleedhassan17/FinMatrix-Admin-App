// ═══════════════════════════════════════════════════════
// FinMatrix — TransactionsStack (dumb mapper over navigations-maps/Transactions)
// ═══════════════════════════════════════════════════════
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TRANSACTIONS_ROUTES } from '../../navigations-maps/Transactions';

export type TransactionsStackParamList = {
  TransactionsHub: undefined;
  InvoiceList: undefined;
  // fromApprovalRequestId opens a staff request read-only, so the owner sees
  // the customer, dates and every line before approving. An ID, not a payload,
  // for the same reason CreditMemoForm's fromDeliveryRequestId is one.
  InvoiceForm:
    | { invoiceId?: string; customerId?: string; fromApprovalRequestId?: string }
    | undefined;
  InvoiceDetail: { invoiceId: string };
  EstimateList: undefined;
  EstimateForm: { estimateId?: string } | undefined;
  EstimateDetail: { estimateId: string };
  SalesOrderList: undefined;
  SalesOrderForm: { salesOrderId?: string } | undefined;
  SalesOrderDetail: { salesOrderId: string };
  CreditMemoList: undefined;
  CreditMemoForm:
    | {
        creditMemoId?: string;
        /**
         * Reversing an approved delivery: the form fetches the draft by this
         * id and pre-fills the customer, invoice and delivered lines. Passed
         * as an ID rather than a payload so it cannot go stale in the back
         * stack, and so a deep link works.
         */
        fromDeliveryRequestId?: string;
      }
    | undefined;
  CreditMemoDetail: { creditMemoId: string };
  VendorCreditList: undefined;
  VendorCreditForm: { vendorCreditId?: string } | undefined;
  VendorCreditDetail: { vendorCreditId: string };
  ReceivePayment:
    | { customerId?: string; invoiceId?: string; fromApprovalRequestId?: string }
    | undefined;
  BillList: undefined;
  BillForm: { billId?: string; vendorId?: string } | undefined;
  BillDetail: { billId: string };
  PayBills: { vendorId?: string; billId?: string } | undefined;
  PaymentSuccess: {
    amount: number;
    /** Settled by vendor credit rather than cash — no money moved for this part. */
    creditApplied?: number;
    vendorName: string;
    accountName: string;
    paymentDate: string;
    reference: string;
    method: string;
    /** Where the user came from, so "View bill" returns there. */
    billId?: string;
    lines: { billNumber: string; applied: number; remaining: number }[];
  };
  POList: undefined;
  // prefillItemId seeds the first line from an inventory item, so "Create PO"
  // on an item detail lands on a form that already knows what to reorder.
  //
  // fromApprovalRequestId opens a staff request read-only, so the owner can see
  // the vendor, dates and every line before approving instead of deciding off
  // the one-line summary. Passed as an ID rather than a payload, for the same
  // reasons CreditMemoForm's fromDeliveryRequestId is: it cannot go stale in
  // the back stack, and a deep link works.
  POForm:
    | { poId?: string; prefillItemId?: string; fromApprovalRequestId?: string }
    | undefined;
  PODetail: { poId: string };
  JournalEntryList: undefined;
  JournalEntryForm: { entryId?: string } | undefined;
  JournalEntryDetail: { entryId: string };
};

const Stack = createNativeStackNavigator();

const TransactionsStack: React.FC = () => (
  <Stack.Navigator id="TransactionsStack" screenOptions={{ headerShown: false }}>
    {TRANSACTIONS_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default TransactionsStack;
