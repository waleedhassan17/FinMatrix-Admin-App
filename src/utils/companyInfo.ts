// ═══════════════════════════════════════════════════════
// FinMatrix — Company identity for customer-facing documents
// ═══════════════════════════════════════════════════════
// Single source for the business identity printed on every generated
// document (invoice, estimate, sales order, statement — payslips are
// rendered server-side from the same company record). Reads the signed-in
// company (Company Profile data) and maps it onto the PDF builders'
// CompanyInfo shape. Falls back to just the company/user-visible name —
// a customer-facing slip must NEVER carry the app vendor's branding.

import { useMemo } from 'react';
import { useAppSelector } from '../hooks/useReduxHooks';
import { selectActiveCompany, type CompanyData } from '../screens/Auth/companySlice';
import type { CompanyInfo } from './invoicePdf';

export function companyInfoFrom(
  company: CompanyData | null | undefined,
  fallbackName?: string | null,
): CompanyInfo {
  if (!company) {
    return { name: fallbackName || 'Your Company', addressLine1: '' };
  }
  const cityLine = [company.city, company.state, company.zipCode]
    .filter(Boolean)
    .join(', ');
  const addressLine2 = [cityLine, company.country].filter(Boolean).join(', ');
  return {
    name: company.name || fallbackName || 'Your Company',
    addressLine1: company.address || '',
    addressLine2: addressLine2 || undefined,
    phone: company.phone || undefined,
    email: company.email || undefined,
    website: company.website || undefined,
    taxId: company.taxId || undefined,
  };
}

/** The active company's identity, ready to hand to any PDF/share builder. */
export function useCompanyInfo(): CompanyInfo {
  const company = useAppSelector(selectActiveCompany);
  return useMemo(() => companyInfoFrom(company), [company]);
}
