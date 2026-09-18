import {
  STAFF_FORBIDDEN_ROUTES,
  STAFF_MORE_ROUTE_NAMES,
  StaffMoreRouteNames,
} from '../../navigations-maps/staffMoreRouteNames';

/**
 * The staff route allow-list.
 *
 * Hiding a menu row still leaves its route registered, so anything holding a
 * navigation reference — a deep link, a stale param, a shared component that
 * calls navigate('Settings') — reaches the screen anyway. Leaving the route
 * off the list makes that a no-op. The failure mode is silent: nothing crashes
 * when a route creeps back in, a staff member simply gains a screen they
 * should not have. Hence these tests.
 *
 * The list lives in its own dependency-free module for two reasons: it can be
 * asserted without loading every screen (and the Expo native stack with them),
 * and StaffMore.ts types its registrations against it — so a route that is not
 * on this list is a COMPILE error, not something a test has to notice.
 *
 * The server's 403s remain the real enforcement. This is the matching UX.
 */
describe('staff route allow-list', () => {
  it.each(STAFF_FORBIDDEN_ROUTES)('excludes %s', route => {
    expect(STAFF_MORE_ROUTE_NAMES).not.toContain(route);
  });

  it('excludes every governance screen, stated as one set', () => {
    const overlap = STAFF_MORE_ROUTE_NAMES.filter(name =>
      (STAFF_FORBIDDEN_ROUTES as readonly string[]).includes(name),
    );
    expect(overlap).toEqual([]);
  });

  describe('what staff DO get', () => {
    it('their own requests', () => {
      expect(STAFF_MORE_ROUTE_NAMES).toContain(StaffMoreRouteNames.MyRequests);
    });

    it('delivery completion approvals', () => {
      // Table B row 4 makes signing off a rider's delivery a staff action.
      // This is NOT the owner's approvals inbox — StaffApprovals is asserted
      // absent above, and the two are easy to conflate.
      expect(STAFF_MORE_ROUTE_NAMES).toContain(
        StaffMoreRouteNames.InventoryApproval,
      );
    });

    it('the delivery working set', () => {
      for (const route of [
        StaffMoreRouteNames.AssignDeliveries,
        StaffMoreRouteNames.CreateDelivery,
        StaffMoreRouteNames.DeliveryMonitor,
        StaffMoreRouteNames.AdminDeliveryDetail,
      ]) {
        expect(STAFF_MORE_ROUTE_NAMES).toContain(route);
      }
    });

    it('rider management, so the owner is not the bottleneck', () => {
      for (const route of [
        StaffMoreRouteNames.DeliveryPersonnelList,
        StaffMoreRouteNames.AddDeliveryPersonnel,
        StaffMoreRouteNames.DeliveryPersonnelDetail,
      ]) {
        expect(STAFF_MORE_ROUTE_NAMES).toContain(route);
      }
    });

    /**
     * Staff had no sign-out anywhere in their surface — they could sign in and
     * not get back out. It lives behind StaffSettings, so losing that route
     * strands them again, silently. Hence an assertion rather than trust.
     */
    it('their own settings, which is where sign-out lives', () => {
      expect(STAFF_MORE_ROUTE_NAMES).toContain(StaffMoreRouteNames.StaffSettings);
    });

    it('customers and vendors', () => {
      for (const route of [
        StaffMoreRouteNames.CustomerList,
        StaffMoreRouteNames.CustomerForm,
        StaffMoreRouteNames.VendorList,
        StaffMoreRouteNames.VendorForm,
      ]) {
        expect(STAFF_MORE_ROUTE_NAMES).toContain(route);
      }
    });
  });

  it('lists every name exactly once', () => {
    expect(new Set(STAFF_MORE_ROUTE_NAMES).size).toBe(
      STAFF_MORE_ROUTE_NAMES.length,
    );
  });
});
