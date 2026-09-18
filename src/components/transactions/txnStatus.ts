// ═══════════════════════════════════════════════════════
// FinMatrix — Transaction status accent
// ═══════════════════════════════════════════════════════
// Before the canonical map existed, the same five status maps were duplicated
// across list/detail pairs and three more were invented independently, so a
// status could render three different colours depending on the screen — "sent"
// was violet on an invoice, blue on an estimate and emerald on a PO.
//
// That map has since grown to cover admin and subscription statuses too, so it
// lives in theme.ts. This module is the transactions-facing name for it.

import { statusStyle } from '../../theme';

/**
 * Accent for a transaction status.
 *
 * The map itself now lives in theme.ts as `statusStyle`, which covers every
 * domain in the app rather than just transactions. This stays as the
 * transactions-facing name so the eight list and detail screens calling it are
 * unaffected, and because `TxnCard`'s `statusColor` prop wants one colour
 * rather than a foreground/background pair.
 */
export const txnStatusColor = (status: string): string => statusStyle(status).fg;
