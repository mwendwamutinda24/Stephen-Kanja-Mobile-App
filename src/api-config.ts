// api-config.ts
export const API_BASE = "https://new-kanja-portal.onrender.com";

export const ENDPOINTS = {
  trackFees:      `${API_BASE}/api/track_fees.php`,
  receiptLink: `${API_BASE}/api/receipt_link.php`,
  paymentHistory: `${API_BASE}/api/learner_payment_history.php`,
  fetchStudents: `${API_BASE}/api/fetch_students.php`,
  savePayments:  `${API_BASE}/api/save_fee_payments.php`,
  receipt:       `${API_BASE}/api/download_receipt.php`,
};