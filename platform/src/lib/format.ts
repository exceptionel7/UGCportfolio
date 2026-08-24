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

export function fmtDate(d?: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}
