// The console has exactly one door. It names itself as `admin` so the server
// can refuse an account that belongs on another one (WRONG_PORTAL) before
// issuing a token.
//
// Two of the three tests here used to exercise authDeliveryLogin -- the rider
// and staff portal, which this app has no screen for and never called. They
// went with that function: a suite that spends most of its assertions on code
// the app cannot reach reads as coverage without being any.
jest.mock('../../network/apiHelpers', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  API_BASE_URL: 'http://test.local/api/v1',
  setTokens: jest.fn().mockResolvedValue(undefined),
  setStoredCompanyId: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
  getAccessToken: jest.fn().mockResolvedValue(null),
  extractErrorMessage: jest.fn(() => 'Request failed'),
}));

import { api } from '../../network/apiHelpers';
import { authLogin } from '../authNetwork';

const post = api.post as jest.Mock;

const ok = (role: string) => ({
  data: {
    data: {
      user: { id: 'u1', email: 'a@b.c', username: 'u', displayName: 'U', role },
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
      companyId: 'c1',
      companyStatus: 'active',
      companyType: 'warehouse',
      features: {} as Record<string, boolean>,
    },
  },
});

describe('sign-in portals', () => {
  beforeEach(() => post.mockReset());

  it('the Business Portal signs in as the owner door', async () => {
    post.mockResolvedValueOnce(ok('admin'));
    await authLogin({ signInInfo: { email: ' owner@x.z ', password: 'pw' } });
    expect(post).toHaveBeenCalledWith('/auth/signin', {
      identifier: 'owner@x.z',
      email: 'owner@x.z',
      password: 'pw',
      portal: 'admin',
    });
  });

  it('signs a super admin in through the same admin door', async () => {
    // PORTAL_ROLES maps 'admin' to ['admin', 'super_admin'] -- the platform
    // operator and the company owner share a door, and the console branches
    // on role after the token comes back.
    post.mockResolvedValueOnce(ok('super_admin'));
    await authLogin({ signInInfo: { email: 'ops@finmatrix.pk', password: 'pw' } });
    expect(post.mock.calls[0][1].portal).toBe('admin');
  });

  it('surfaces the server’s wrong-door message', async () => {
    const serverError = { response: { status: 403, data: { error: { code: 'WRONG_PORTAL', message: 'This is a rider account.' } } } };
    post.mockRejectedValueOnce(serverError);
    const { extractErrorMessage } = jest.requireMock('../../network/apiHelpers');
    (extractErrorMessage as jest.Mock).mockReturnValueOnce('This is a rider account.');
    await expect(
      authLogin({ signInInfo: { email: 'rider@x.z', password: 'pw' } }),
    ).rejects.toThrow('This is a rider account.');
  });
});
