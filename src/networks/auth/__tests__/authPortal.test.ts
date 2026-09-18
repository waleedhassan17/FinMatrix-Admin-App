// Each sign-in door names itself, so the server can refuse an account that
// belongs on another one (WRONG_PORTAL) before issuing a token.
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
import { authDeliveryLogin, authLogin } from '../authNetwork';

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

  it('the User Portal signs in as the team door (staff and riders)', async () => {
    post.mockResolvedValueOnce(ok('staff'));
    await authDeliveryLogin({ signInInfo: { username: 'verify.staff', password: 'pw' } });
    expect(post).toHaveBeenCalledWith('/auth/signin', {
      identifier: 'verify.staff',
      email: 'verify.staff',
      password: 'pw',
      portal: 'team',
    });
  });

  it('surfaces the server’s wrong-door message on the User Portal', async () => {
    const serverError = { response: { status: 403, data: { error: { code: 'WRONG_PORTAL', message: 'This is a business owner account.' } } } };
    post.mockRejectedValueOnce(serverError);
    const { extractErrorMessage } = jest.requireMock('../../network/apiHelpers');
    (extractErrorMessage as jest.Mock).mockReturnValueOnce('This is a business owner account.');
    await expect(
      authDeliveryLogin({ signInInfo: { username: 'owner@x.z', password: 'pw' } }),
    ).rejects.toThrow('This is a business owner account.');
  });
});
