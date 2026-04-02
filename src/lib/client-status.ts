/**
 * Pipeline order for client statuses.
 * A status should never regress automatically.
 * "lost" is special: can be set manually at any time but never by automation.
 */
const PIPELINE_ORDER = ["new", "to_recall", "quote_sent", "rdv_confirmed", "client"];

/**
 * Returns true if the new status is more advanced than the current one.
 * "lost" always returns false (never set automatically).
 */
export function shouldAdvanceStatus(currentStatus: string, newStatus: string): boolean {
  if (newStatus === "lost") return false;
  const currentIdx = PIPELINE_ORDER.indexOf(currentStatus);
  const newIdx = PIPELINE_ORDER.indexOf(newStatus);
  if (currentIdx === -1 || newIdx === -1) return true;
  return newIdx > currentIdx;
}
