import type {
  SubmitBillPhotoResult,
} from '../models/dpBillPhotoCaptureModel';

export const dpBillPhotoCaptureSerializer = (
  payload: any,
): SubmitBillPhotoResult | null => {
  if (!payload) return null;
  if (payload.success === false) return null;

  // Try multiple response shapes the backend might use
  const raw = payload.data ?? payload;

  const requestId =
    raw.requestId ?? raw.request_id ??
    raw.id ?? raw.approvalId ?? raw.approval_id ?? '';
  const photoUrl =
    raw.photoUrl ?? raw.photo_url ??
    raw.billPhotoUri ?? raw.bill_photo_uri ??
    raw.url ?? '';
  const uploadedAt =
    raw.uploadedAt ?? raw.uploaded_at ??
    raw.createdAt ?? raw.created_at ??
    raw.submittedAt ?? new Date().toISOString();
  const deliveryId = raw.deliveryId ?? raw.delivery_id ?? '';

  if (!requestId && !photoUrl) return null;

  return { requestId, deliveryId, photoUrl, uploadedAt };
};
