// ═══════════════════════════════════════════════════════
// FinMatrix — Analytics Dashboard Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';
import { fetchReport } from '../reports/reportHelpers';

// Removed: getDashboardSummaryAPI, which called /reports/profit-loss with
// `params = {}` — a dateless P&L. Nothing referenced it, and every real report
// caller sends a range from getDefaultReportRange, so it was a footgun waiting
// for someone to wire it up rather than a working entry point.

export const getNotificationsAPI = async (params: any = {}): Promise<any> => {
  try {
    const response = await api.get('/notifications', { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const markNotificationReadAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const markAllNotificationsReadAPI = async (): Promise<any> => {
  try {
    const response = await api.post('/notifications/read-all');
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getUnreadCountAPI = async (userId: string): Promise<any> => {
  try {
    const response = await api.get('/notifications/unread-count', { params: { userId } });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getAnalyticsDashboardAPI = async (params: any = {}): Promise<any> => {
  return fetchReport('/reports/analytics-dashboard', params);
};
