import { useAppSelector } from './useReduxHooks';
import { selectUser } from '../screens/Auth/authSlice';
import {
  can,
  capabilityFor,
  needsApproval,
  submitLabelFor,
  type Capability,
  type CapabilityOutcome,
} from '../utils/capabilities';

/**
 * What the signed-in user may do — see utils/capabilities.ts for the map.
 *
 * A UX helper, not a security boundary: the server refuses anything this gets
 * wrong. Use it to keep dead buttons off the screen and to say "Send for
 * approval" where that is what tapping will actually do.
 *
 *   const adjust = useCapability('inventory.adjust');
 *   if (!adjust.allowed) return null;
 *   <Button title={adjust.submitLabel('Save adjustment')} />
 */
export const useCapability = (capability: Capability) => {
  const role = useAppSelector(selectUser)?.role ?? null;
  const outcome: CapabilityOutcome = capabilityFor(role, capability);

  return {
    outcome,
    /** Visible at all — either it completes or it files a request. */
    allowed: can(role, capability),
    /** Completes immediately. */
    direct: outcome === 'direct',
    /** Files a request the owner has to approve first. */
    needsApproval: needsApproval(role, capability),
    /** Button wording that matches what will actually happen. */
    submitLabel: (directLabel: string) =>
      submitLabelFor(role, capability, directLabel),
  };
};

/** The signed-in user's role, for the handful of places that branch on it. */
export const useRole = () => useAppSelector(selectUser)?.role ?? null;

/** True for a company owner. */
export const useIsOwner = () => useRole() === 'admin';
