import { useCallback, useEffect, useState } from 'react';

import { getCustomerAdvancesAPI } from '../networks/sales/paymentNetwork';
import { customerAdvancesSerializer } from '../serializers/paymentSerializer';

/**
 * What a customer has paid in advance and not yet had applied to an invoice.
 *
 * Keyed by customer, so a stale figure for the previous customer is never
 * shown while the next one loads. `reload` re-reads it after an apply.
 */
export const useCustomerAdvanceTotal = (customerId: string | undefined, enabled = true) => {
  const [loaded, setLoaded] = useState<{ customerId: string; total: number } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!customerId || !enabled) return;
    let cancelled = false;
    getCustomerAdvancesAPI(customerId)
      .then(raw => {
        if (cancelled) return;
        const total = customerAdvancesSerializer(raw).reduce((sum, a) => sum + a.unapplied, 0);
        setLoaded({ customerId, total: Math.round(total * 100) / 100 });
      })
      // A failed lookup hides the hint; it never blocks recording a payment.
      .catch(() => !cancelled && setLoaded({ customerId, total: 0 }));
    return () => {
      cancelled = true;
    };
  }, [customerId, enabled, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  const total = enabled && loaded && loaded.customerId === customerId ? loaded.total : 0;
  return { total, reload };
};
