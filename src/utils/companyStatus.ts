// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Company status, in the console's words
// ═══════════════════════════════════════════════════════
// The same rules as the admin web's models/platform.ts, so a company reads the
// same, and offers the same actions, in both consoles.

export type CompanyStage = 'pending' | 'active' | 'inactive' | 'rejected';

/** A company that was created but never submitted for review. */
export const isUnsubmitted = (status: string | null | undefined): boolean =>
  status === 'email_verified' || status === 'draft' || status === 'unverified';

/**
 * What a company is waiting on, for deciding what can be done to it. The
 * server stores `approved` for active and accepts `suspended` for inactive; a
 * never-submitted company sits in the approval queue and needs the same
 * decision as a submitted one.
 */
export const companyStage = (status: string | null | undefined): CompanyStage => {
  if (!status || status === 'approved' || status === 'active') return 'active';
  if (status === 'inactive' || status === 'suspended') return 'inactive';
  if (status === 'rejected') return 'rejected';
  return 'pending';
};

/** Badge wording: what an administrator did or is asked to do, not the DB word. */
export const companyStatusLabel = (status: string | null | undefined): string => {
  if (isUnsubmitted(status)) return 'Not submitted';
  switch (companyStage(status)) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Deactivated';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Awaiting approval';
  }
};
