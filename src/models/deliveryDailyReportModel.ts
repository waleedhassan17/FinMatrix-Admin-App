import type { ApiEnvelope } from './reportModel';

export interface DeliveryPersonnelStat {
  personId: string;
  name: string;
  total: number;
  delivered: number;
  failed: number;
  onTimeRate: number;
}

export interface DeliveryAgencyCount {
  agencyId: string;
  agencyName: string;
  count: number;
}

export interface DeliveryDailyReport {
  date: string;
  total: number;
  completed: number;
  failed: number;
  onTimePercent: number;
  personnelStats: DeliveryPersonnelStat[];
  agencyDistribution: DeliveryAgencyCount[];
}

export type DeliveryDailyReportResponse = ApiEnvelope<DeliveryDailyReport>;
