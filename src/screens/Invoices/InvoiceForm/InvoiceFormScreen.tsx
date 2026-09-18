// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice Form Screen (Create / Edit)
// Customer dropdown, auto invoice #, date / due date,
// line items with tax, discount, grand total.
// Premium Enterprise UI
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';

import { THEME } from '../../../utils/theme';
const PANEL = THEME.form.summaryPanel;
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectInvoiceFormState,
  setField,
  setCustomer,
  setErrors,
  addLine,
  removeLine,
  updateLine,
  setLineItem,
  calculateTotals,
  fetchInvoiceForEdit,
  saveInvoice,
  loadFromRequestPayload,
  resetInvoiceForm,
  type FormLineItem,
} from './invoiceFormSlice';
import {
  selectInvoices,
  fetchInvoices,
} from '../InvoiceList/invoiceListSlice';
import { fetchCustomers, selectCustomers } from '../../Customers/CustomerList/customerListSlice';
import { selectInventoryItems, fetchInventoryItems } from '../../Inventory/InventoryList/inventoryListSlice';
import { selectFeatures } from '../../Auth/authSlice';
import CustomInput from '../../../Custom-Components/CustomInput';
import { DateField, ReportHeader, HEADER_NAVY } from '../../../components/reports/ReportUI';
import CustomDropdown from '../../../Custom-Components/CustomDropdown';
import CustomButton from '../../../Custom-Components/CustomButton';
import LineItemRow from '../../../components/shared/LineItemRow';
import {
  AddButton,
  FormSectionHeader,
  PrimaryButton,
  SecondaryButton,
} from '../../../components/form/FormUI';
import { useCapability } from '../../../hooks/useCapability';
import { fetchApprovalById } from '../../../networks/approvals/approvalsNetwork';
import { decideApproval } from '../../Approvals/approvalsSlice';
import { APPROVAL_TYPE_EFFECTS, isPendingApproval } from '../../../models/approvalModel';
import type { ApprovalRequest } from '../../../models/approvalModel';
import RejectReasonModal from '../../Approvals/RejectReasonModal';
import CreditLimitModal from '../../../components/shared/CreditLimitModal';
import { creditAssessmentFrom, type CreditAssessment } from '../../../models/creditModel';
import { lineTaxError } from '../../../models/taxRate';
import {
  UNCLASSIFIED_LINE_MESSAGE,
  firstUnclassifiedLine,
  salesLineOptions,
  salesLinePickerValue,
  stockHint,
} from '../../../models/salesLineModel';
import { formatCurrency } from '../../../utils/formatters';
import type { DiscountType, InvoiceStatus } from '../../../types';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type FormRoute = RouteProp<TransactionsStackParamList, 'InvoiceForm'>;

const DISCOUNT_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Fixed (Rs)', value: 'amount' },
  { label: 'Percentage (%)', value: 'percent' },
];

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const InvoiceFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<FormRoute>();
  const dispatch = useAppDispatch();

  const editingId = route.params?.invoiceId;
  const isEditing = !!editingId;
  // Set when arriving from the approvals inbox or My Requests: the form shows
  // a staff request read-only so it can be judged on its contents.
  const approvalRequestId = route.params?.fromApprovalRequestId;
  const isReviewing = !!approvalRequestId;
  const invoices = useAppSelector(selectInvoices);
  const customers = useAppSelector(selectCustomers);
  const inventory = useAppSelector(selectInventoryItems);
  const features = useAppSelector(selectFeatures);
  const form = useAppSelector(selectInvoiceFormState);
  // Raising an invoice recognises the sale, so for staff it goes to the owner.
  const invoiceCap = useCapability('invoice.create');
  // Only the owner decides. Staff opening their own request from My Requests
  // get the identical read-only form with no decision buttons.
  const decideCap = useCapability('approvals.decide');
  const hydratedRef = React.useRef(false);
  const requestLoadedRef = React.useRef(false);

  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // ── Line picker: a stock item, or explicitly a service / charge ──
  // A product sold from an inventory company must be a stock item so the sale
  // moves stock and posts cost of sales; the server refuses a typed line not
  // marked as a service (LINE_ITEM_REQUIRED).
  const itemOptions = useMemo(() => salesLineOptions(inventory), [inventory]);
  const inventoryEnabled = features?.inventory !== false;
  const [creditRefusal, setCreditRefusal] = useState<{ assessment: CreditAssessment; status: InvoiceStatus } | null>(null);

  const handleSelectItem = useCallback(
    (lineId: string, itemId: string) => {
      const it = inventory.find(i => i.id === itemId);
      dispatch(
        setLineItem({
          id: lineId,
          itemId,
          description: it?.name,
          unitPrice: it ? String(it.sellingPrice) : undefined,
        }),
      );
    },
    [inventory, dispatch],
  );

  // ── Customer options for dropdown ───────────────
  const customerOptions = useMemo(
    () =>
      customers
        .filter(c => c.isActive)
        .map(c => ({ label: `${c.name} — ${c.company}`, value: c.id })),
    [customers],
  );

  // ── Auto-generate invoice number ────────────────
  const generateInvoiceNumber = useCallback(() => {
    const maxNum = invoices.reduce((max, inv) => {
      const match = inv.invoiceNumber.match(/INV-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `INV-${String(maxNum + 1).padStart(4, '0')}`;
  }, [invoices]);

  // ── Load data on mount ──────────────────────────
  useEffect(() => {
    dispatch(fetchCustomers());
    // Inventory is tier-gated (FinMatrix.md) — skip the fetch entirely for
    // companies without the feature instead of firing a guaranteed 403.
    if (features?.inventory !== false) {
      dispatch(fetchInventoryItems());
    }

    if (hydratedRef.current) return;
    hydratedRef.current = true;

    if (isReviewing) {
      // Nothing seeded — the request's own payload is loaded by the effect
      // below, once customers are available to name its customerId.
    } else if (isEditing && editingId) {
      // Fetched by id, not looked up in the list slice. A list row carries
      // `lines: []` whenever the list endpoint returns summary rows, so the
      // header hydrated while the items silently did not — and saving from
      // that form would have written the invoice back empty. It also made
      // editing depend on the list having been loaded first, which is not true
      // of every route that reaches this screen.
      dispatch(fetchInvoiceForEdit(editingId));
    } else {
      dispatch(setField({ key: 'invoiceNumber', value: generateInvoiceNumber() }));
      // Today, read now rather than whenever the bundle started — the slice's
      // initialState is evaluated once, so a long-running app would post the
      // launch date as this document's accounting date.
      dispatch(setField({ key: 'issueDate', value: dayjs().format('YYYY-MM-DD') }));
      dispatch(setField({ key: 'dueDate', value: dayjs().add(30, 'day').format('YYYY-MM-DD') }));
      // Preselect the customer when launched from a customer's detail screen.
      if (route.params?.customerId) {
        dispatch(setField({ key: 'customerId', value: route.params.customerId }));
      }
    }

    return () => { dispatch(resetInvoiceForm()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId, isReviewing, dispatch]);

  // Load the approval request and put its payload back in the form.
  //
  // Deliberately NOT gated on customers having arrived. Waiting for a lookup
  // list means a company with none yet, a 403, or an offline device leaves the
  // owner staring at a blank form with no explanation — and they can approve
  // from it. CustomDropdown resolves its label from its own options at render,
  // so setting the id is enough; the name fills in when the list lands.
  useEffect(() => {
    if (!approvalRequestId || requestLoadedRef.current) return;
    requestLoadedRef.current = true;

    let cancelled = false;
    const bail = (text2: string) => {
      if (cancelled) return;
      // Never leave a blank form standing in for a request: the owner would
      // approve against whatever it happened to show.
      Toast.show({ type: 'error', text1: 'Could not open this request', text2 });
      navigation.goBack();
    };

    (async () => {
      try {
        const req = await fetchApprovalById(approvalRequestId);
        if (cancelled) return;
        if (req?.type !== 'invoice') {
          bail('Only invoice requests can be opened here.');
          return;
        }
        const payload = (req.payload ?? {}) as Record<string, any>;
        if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
          bail('This request has no line items to show.');
          return;
        }
        setRequest(req);
        dispatch(
          loadFromRequestPayload({
            payload,
            customerName:
              customers.find(c => c.id === payload.customerId)?.name ?? '',
          }),
        );
      } catch (e: any) {
        bail(e?.message || 'Please try again.');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalRequestId, customers, dispatch, navigation]);

  // ── Deciding a request under review ─────────────
  const decide = useCallback(
    async (decision: 'approve' | 'reject', comment?: string) => {
      if (!request || deciding) return null;
      setDeciding(true);
      try {
        const result: any = await dispatch(
          decideApproval({ id: request.id, decision, comment }),
        );
        if (result.error) throw new Error(result.error.message);
        return result.payload as ApprovalRequest;
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: decision === 'approve' ? 'Could not approve' : 'Could not reject',
          text2: e?.message || 'Please try again.',
        });
        return null;
      } finally {
        setDeciding(false);
      }
    },
    [request, deciding, dispatch],
  );

  const handleApprove = useCallback(async () => {
    const decided = await decide('approve');
    if (!decided) return;
    await dispatch(fetchInvoices());
    Toast.show({
      type: 'success',
      text1: 'Request approved',
      text2: 'The invoice has been created and the sale posted.',
    });
    navigation.goBack();
  }, [decide, dispatch, navigation]);

  const handleReject = useCallback(
    async (comment: string) => {
      setRejectOpen(false);
      const decided = await decide('reject', comment);
      if (!decided) return;
      Toast.show({
        type: 'success',
        text1: 'Request rejected',
        text2: 'The requester sees your reason in My requests.',
      });
      navigation.goBack();
    },
    [decide, navigation],
  );

  // ── Customer change handler (also sets due date from terms) ──
  const handleCustomerChange = useCallback(
    (custId: string) => {
      const cust = customers.find(c => c.id === custId);
      if (!cust) return;
      dispatch(setCustomer({ id: cust.id, name: cust.name }));

      // Auto-set due date based on payment terms
      const termDays: Record<string, number> = {
        net_15: 15, net_30: 30, net_45: 45, net_60: 60, due_on_receipt: 0,
      };
      const days = termDays[cust.paymentTerms] ?? 30;
      dispatch(setField({ key: 'dueDate', value: dayjs(form.issueDate).add(days, 'day').format('YYYY-MM-DD') }));
    },
    [customers, dispatch, form.issueDate],
  );

  // ── Line helpers ────────────────────────────────
  const lineAmount = useCallback((l: FormLineItem) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    return qty * price;
  }, []);

  // ── Validation ──────────────────────────────────
  const validate = useCallback((): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.customerId) errs.customerId = 'Select a customer';
    if (!form.invoiceNumber.trim()) errs.invoiceNumber = 'Invoice number is required';
    if (!form.issueDate) errs.issueDate = 'Issue date is required';
    if (!form.dueDate) errs.dueDate = 'Due date is required';
    if (form.lines.length === 0) errs.lines = 'At least one line item is required';

    const hasEmptyLine = form.lines.some(
      l => !l.description.trim() || !(parseFloat(l.quantity) > 0) || !(parseFloat(l.unitPrice) > 0),
    );
    const taxError = lineTaxError(form.lines);
    if (hasEmptyLine) errs.lines = 'All line items must have description, quantity, and rate';
    else if (firstUnclassifiedLine(form.lines, inventoryEnabled) >= 0) {
      errs.lines = UNCLASSIFIED_LINE_MESSAGE;
    } else if (taxError) {
      errs.lines = taxError;
    }

    return errs;
  }, [form, inventoryEnabled]);

  // ── Save ────────────────────────────────────────
  const handleSave = useCallback(
    async (saveStatus: InvoiceStatus = 'draft', overrideReason?: string) => {
      const validationErrors = validate();
      if (Object.keys(validationErrors).length > 0) {
        dispatch(setErrors(validationErrors));
        Toast.show({ type: 'error', text1: 'Validation Error', text2: Object.values(validationErrors)[0] });
        return;
      }

      dispatch(calculateTotals());

      try {
        const result: any = await dispatch(
          saveInvoice({
            status: saveStatus,
            editingId,
            inventoryEnabled,
            ...(overrideReason ? { overrideReason } : {}),
          }),
        );
        if (result.error) {
          // Over the credit limit: offer an advance, or the owner's override.
          const assessment = creditAssessmentFrom(result.payload);
          if (assessment) {
            setCreditRefusal({ assessment, status: saveStatus });
            return;
          }
          throw new Error(result.payload?.message ?? result.error.message);
        }

        // Staff get an approval request back, not an invoice. Nothing exists
        // and nothing has posted, so the success toast below would be a lie —
        // and the worse kind, because the person would believe the customer
        // had been billed.
        if (result.payload?.pending) {
          Toast.show({
            type: 'success',
            text1: 'Sent to the owner for approval',
            text2: 'The invoice is created, and the sale posts, once they approve.',
          });
          navigation.goBack();
          return;
        }

        await dispatch(fetchInvoices());

        Toast.show({
            type: 'success',
            text1: isEditing ? 'Invoice Updated' : 'Invoice Created',
            text2: `${form.invoiceNumber} has been ${isEditing ? 'updated' : 'created'} as ${saveStatus}.`,
          });
          navigation.goBack();
      } catch (e: any) {
        // Show what the server actually said. createInvoiceAPI already runs
        // extractErrorMessage and throws the real reason -- a bare `catch {}`
        // discarded it and replaced every cause with "please try again", so an
        // insufficient-stock COGS posting, a closed period and a dropped
        // connection were indistinguishable to the person trying to invoice.
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: e?.message || 'Failed to save invoice. Please try again.',
        });
      }
    },
    [form, isEditing, editingId, dispatch, navigation, validate, inventoryEnabled],
  );

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, styles.safeTop]} edges={['top']}>
      {/* ── Premium Gradient Header ─────────────────── */}
      <ReportHeader
        title={
          isReviewing
            ? 'Review request'
            : isEditing
              ? `Edit ${form.invoiceNumber}`
              : 'New Invoice'
        }
        subtitle={
          isReviewing
            ? request?.requestedBy
              ? `Raised by ${request.requestedBy}`
              : 'Raised by a staff member'
            : isEditing
              ? 'Update invoice details'
              : 'Create a professional invoice'
        }
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {isReviewing && (
            <View style={styles.reviewBanner}>
              <Feather name="clock" size={16} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: spacing.xs }}>
                <Text style={styles.reviewBannerTitle}>Waiting for your decision</Text>
                <Text style={styles.reviewBannerBody}>
                  {request?.summary || 'A staff member asked you to approve this invoice.'}
                </Text>
                <Text style={styles.reviewBannerBody}>{APPROVAL_TYPE_EFFECTS.invoice}</Text>
              </View>
            </View>
          )}

          {/* Nothing is editable while reviewing: approving replays the payload
              exactly as submitted, so an edit here would be a lie. Gated at the
              container because DateField and LineItemRow have no disabled prop. */}
          <View pointerEvents={isReviewing ? 'none' : 'auto'}>
          {/* ── Section: Customer & Dates ────────────── */}
          <FormSectionHeader title="INVOICE DETAILS" dotColor={colors.actionGreen} />
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.actionGreen }]} />
            <View style={styles.cardBody}>
              <CustomDropdown
                label="Customer *"
                options={customerOptions}
                value={form.customerId}
                onChange={handleCustomerChange}
                placeholder="Select customer…"
                error={form.errors.customerId}
                searchable
              />
              <CustomInput
                label="Invoice #"
                value={form.invoiceNumber}
                onChangeText={v => dispatch(setField({ key: 'invoiceNumber', value: v }))}
                placeholder="INV-0000"
                error={form.errors.invoiceNumber}
                disabled={isEditing}
              />
              <View style={styles.rowFields}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <DateField
                    label="Issue Date *"
                    value={form.issueDate}
                    onChangeText={v => dispatch(setField({ key: 'issueDate', value: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {/* Due date is a future date → allow dates after today; never
                      before the issue date. */}
                  <DateField
                    label="Due Date *"
                    value={form.dueDate}
                    onChangeText={v => dispatch(setField({ key: 'dueDate', value: v }))}
                    minimumDate={form.issueDate ? new Date(form.issueDate) : undefined}
                    maximumDate={new Date(2100, 11, 31)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ── Section: Line Items ──────────────────── */}
          <FormSectionHeader
            title="LINE ITEMS"
            dotColor={colors.info}
            right={<AddButton label="Add Item" onPress={() => dispatch(addLine())} />}
          />
          {form.errors.lines && (
            <Text style={styles.lineError}>{form.errors.lines}</Text>
          )}

          {/* The inventory picker goes through LineItemRow's topSlot so it is
              drawn inside the line's card. It used to be a sibling, which put
              the control that decides what the line IS on the bare canvas
              above the card holding everything else about that line. */}
          {form.lines.map((line, idx) => (
            <LineItemRow
              key={line.id}
              index={idx}
              topSlot={
                features?.inventory !== false ? (
                  <View>
                    <CustomDropdown
                      label="Item or service *"
                      options={itemOptions}
                      value={salesLinePickerValue(line)}
                      onChange={v => handleSelectItem(line.id, v)}
                      placeholder="Pick a stock item…"
                      searchable
                    />
                    {line.lineKind === 'service' && !line.itemId && (
                      <Text style={styles.lineHint}>Service / charge — no stock moves</Text>
                    )}
                    {(() => {
                      const h = stockHint(inventory.find(x => x.id === line.itemId), line.quantity);
                      return h ? (
                        <Text style={[styles.lineHint, h.short && { color: colors.warning }]}>
                          {h.short ? `${h.text} — cannot be invoiced until received` : h.text}
                        </Text>
                      ) : null;
                    })()}
                  </View>
                ) : undefined
              }
              description={line.description}
              quantity={line.quantity}
              unitPrice={line.unitPrice}
              taxRate={line.taxRate}
              lineAmount={lineAmount(line)}
              onDescriptionChange={v => dispatch(updateLine({ id: line.id, field: 'description', value: v }))}
              onQuantityChange={v => dispatch(updateLine({ id: line.id, field: 'quantity', value: v }))}
              onUnitPriceChange={v => dispatch(updateLine({ id: line.id, field: 'unitPrice', value: v }))}
              onTaxRateChange={v => dispatch(updateLine({ id: line.id, field: 'taxRate', value: v }))}
              onDelete={() => dispatch(removeLine(line.id))}
              // Any line can go, including the last. `length > 1` meant a row
              // added by mistake was stuck there for good. Deleting them all is
              // caught at save -- validate() returns 'At least one line item is
              // required' -- which says what is wrong, unlike a dead control.
              canDelete
            />
          ))}

          {/* ── Section: Discount ────────────────────── */}
          <FormSectionHeader title="DISCOUNT" dotColor={colors.warning} />
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.warning }]} />
            <View style={styles.cardBody}>
              <View style={styles.rowFields}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <CustomDropdown
                    label="Discount Type"
                    options={DISCOUNT_OPTIONS}
                    value={form.discountType}
                    onChange={v => {
                      dispatch(setField({ key: 'discountType', value: v as DiscountType }));
                      dispatch(calculateTotals());
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CustomInput
                    label={form.discountType === 'percent' ? 'Discount (%)' : 'Discount (Rs)'}
                    value={form.discountValue}
                    onChangeText={v => {
                      dispatch(setField({ key: 'discountValue', value: v.replace(/[^0-9.]/g, '') }));
                      dispatch(calculateTotals());
                    }}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ── Section: Notes ───────────────────────── */}
          <FormSectionHeader title="NOTES" dotColor={colors.secondary} />
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.secondary }]} />
            <View style={styles.cardBody}>
              <CustomInput
                label="Notes"
                value={form.notes}
                onChangeText={v => dispatch(setField({ key: 'notes', value: v }))}
                placeholder="Additional notes for this invoice…"
                multiline
              />
            </View>
          </View>

          {/* ── Premium Totals Panel ──────────────────── */}
          <LinearGradient
            colors={PANEL.gradient}
            style={styles.totalsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.totalsHeader}>
              <Feather name="credit-card" size={16} color={PANEL.accent} />
              <Text style={styles.totalsHeaderText}>Invoice Summary</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatCurrency(form.subtotal, 'Rs ')}</Text>
            </View>
            {form.discountAmount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount{' '}
                  {form.discountType === 'percent'
                    ? `(${form.discountValue}%)`
                    : '(Fixed)'}
                </Text>
                <Text style={[styles.totalsValue, { color: PANEL.positive }]}>
                  − {formatCurrency(form.discountAmount, 'Rs ')}
                </Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{formatCurrency(form.taxAmount, 'Rs ')}</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.totalsRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(form.total, 'Rs ')}</Text>
            </View>
          </LinearGradient>

          </View>

          {/* ── Action Buttons ───────────────────────── */}
          {isReviewing ? (
            decideCap.allowed && request && isPendingApproval(request) ? (
              <View style={styles.btnRow}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <SecondaryButton
                    title="Reject"
                    onPress={() => setRejectOpen(true)}
                    disabled={deciding}
                    icon={<Feather name="x" size={16} color={colors.actionGreen} />}
                  />
                </View>
                <View style={{ flex: 1.4 }}>
                  <PrimaryButton
                    title={deciding ? 'Approving…' : 'Approve'}
                    onPress={handleApprove}
                    isLoading={deciding}
                    icon={<Feather name="check" size={16} color={colors.neutral0} />}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.reviewNote}>
                <Text style={styles.reviewNoteText}>
                  {request && !isPendingApproval(request)
                    ? 'This request has already been decided.'
                    : 'Only the owner can approve or reject a request.'}
                </Text>
              </View>
            )
          ) : invoiceCap.needsApproval && !isEditing ? (
            // One button, because there is only one outcome: the request is
            // filed either way, and draft-vs-sent is a distinction the owner
            // makes when they approve, not one staff can act on here.
            <View style={styles.btnRow}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={form.isSaving ? 'Sending…' : invoiceCap.submitLabel('Save & Send')}
                  onPress={() => handleSave('sent')}
                  isLoading={form.isSaving}
                  icon={<Feather name="send" size={16} color={colors.neutral0} />}
                />
              </View>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <SecondaryButton
                  title="Save Draft"
                  onPress={() => handleSave('draft')}
                  disabled={form.isSaving}
                  icon={<Feather name="save" size={16} color={colors.actionGreen} />}
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <PrimaryButton
                  title={form.isSaving ? 'Saving…' : 'Save & Send'}
                  onPress={() => handleSave('sent')}
                  isLoading={form.isSaving}
                  icon={<Feather name="send" size={16} color={colors.neutral0} />}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <RejectReasonModal
        visible={rejectOpen}
        summary={request?.summary}
        onCancel={() => setRejectOpen(false)}
        onSubmit={handleReject}
      />
      <CreditLimitModal
        assessment={creditRefusal?.assessment ?? null}
        busy={form.isSaving}
        onClose={() => setCreditRefusal(null)}
        onOverride={reason => {
          const status = creditRefusal?.status ?? 'sent';
          setCreditRefusal(null);
          void handleSave(status, reason);
        }}
        onRecordAdvance={a => {
          setCreditRefusal(null);
          navigation.navigate('ReceivePayment', { customerId: a.customerId });
        }}
      />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  lineHint: { ...typography.caption, color: colors.textSecondary, marginTop: -4, marginBottom: 6 },
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: HEADER_NAVY[0] },

  // ── Header ──────────────────────────────────────

  scrollContent: {
    paddingHorizontal: spacing.md,
    // 0: FormSectionHeader's own marginTop provides this now, so the first
    // section sits exactly where it always did and the later ones gain the
    // gap they were missing.
    paddingTop: 0,
    paddingBottom: spacing.xxl,
  },

  // ── Section labels ──────────────────────────────

  // ── Section card with accent stripe ─────────────
  sectionCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.xs,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: spacing.md,
  },
  rowFields: { flexDirection: 'row' },

  // ── Line items header ──────────────────────────
  lineError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.xs,
  },

  // ── Premium Totals Panel ────────────────────────
  totalsCard: {
    borderRadius: radius.lg + 4,
    padding: spacing.md + 4,
    marginTop: spacing.xl,
    ...shadows.md,
  },
  totalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs + 2,
    marginBottom: spacing.xs,
  },
  totalsHeaderText: { ...typography.labelMd, color: PANEL.accent, letterSpacing: 0.5 },
  totalsDivider: {
    height: 1,
    backgroundColor: PANEL.divider,
    marginVertical: spacing.xxs + 2,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xxs + 2,
  },
  // h5's 14px at body weight -- the label is quieter than the value beside it.
  totalsLabel: { ...typography.h5, fontWeight: typography.bodyMd.fontWeight, color: PANEL.label },
  totalsValue: { ...typography.h5, color: PANEL.text, fontVariant: ['tabular-nums'] },
  grandTotalLabel: { ...typography.h4, color: PANEL.accent },
  grandTotalValue: { ...typography.h2, color: colors.neutral0, fontVariant: ['tabular-nums'] },

  // ── Buttons ────────────────────────────────────
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning + '12',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  reviewBannerTitle: { ...typography.labelMd, color: colors.textPrimary },
  reviewBannerBody: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  reviewNote: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
  },
  reviewNoteText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
});

export default InvoiceFormScreen;
