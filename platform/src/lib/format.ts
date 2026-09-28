export function usd(cents?: number | null): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return "$" + dollars.toLocaleString(undefined, { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  APPLICATIONS: "Applications",
  CREATOR_SELECTED: "Creator selected",
  IN_PRODUCTION: "In production",
  SUBMITTED: "Submitted",
  REVISION_REQUESTED: "Revision requested",
  APPROVED: "Approved",
  COMPLETED: "Completed",
};

export const CAMPAIGN_STATUS_ORDER = [
  "DRAFT", "OPEN", "APPLICATIONS", "CREATOR_SELECTED", "IN_PRODUCTION", "SUBMITTED", "REVISION_REQUESTED", "APPROVED", "COMPLETED",
];

export const EARNING_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending — awaiting campaign completion",
  ELIGIBLE: "Eligible for payout",
  PAID: "Paid out",
  CANCELED: "Canceled",
};

export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ELIGIBLE: "Eligible",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELED: "Canceled",
};

export function fmtDate(d?: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}
