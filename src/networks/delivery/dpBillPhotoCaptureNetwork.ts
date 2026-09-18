// ═══════════════════════════════════════════════════════
// FinMatrix — DP Bill Photo Capture Network (Production API)
// ═══════════════════════════════════════════════════════

import { postMultipart, appendImageToForm } from '../network/apiHelpers';

// Uploads go through postMultipart (fetch), NOT the axios `api` instance:
// axios with a manually-set multipart Content-Type loses the boundary and the
// photo never reaches the server (backend answers "photo file is required").

export const uploadBillPhotoAPI = async (deliveryId: string, formData: FormData): Promise<any> =>
  postMultipart(`/deliveries/${deliveryId}/bill-photo`, formData);

export const submitBillPhotoAPI = async (payload: any): Promise<any> => {
  const deliveryId = payload.deliveryId ?? payload.id ?? '';

  const formData = new FormData();

  // Append the photo file (web-safe: resolves blob:/data: URIs to a real Blob)
  if (payload.photoUri) {
    await appendImageToForm(formData, 'photo', payload.photoUri);
  }

  // Append scalar fields
  if (payload.deliveryReference) formData.append('deliveryReference', payload.deliveryReference);
  if (payload.personnelId) formData.append('personnelId', payload.personnelId);
  if (payload.personnelName) formData.append('personnelName', payload.personnelName);
  if (payload.routeLabel) formData.append('routeLabel', payload.routeLabel);
  if (payload.source) formData.append('source', payload.source);
  if (payload.signedBy) formData.append('signedBy', payload.signedBy);
  if (payload.paidStatus) formData.append('paidStatus', payload.paidStatus);
  if (payload.paidStatus === 'partial' && payload.amountCollected) {
    formData.append('amountCollected', payload.amountCollected);
  }
  if (payload.note) formData.append('note', payload.note);

  // Append complex fields as JSON strings
  if (payload.changes) formData.append('changes', JSON.stringify(payload.changes));

  return uploadBillPhotoAPI(deliveryId, formData);
};
