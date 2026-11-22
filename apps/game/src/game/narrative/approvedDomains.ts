/**
 * Real-looking domains in the Last Submission mission (owner decision, 2026-11-22): the UEH
 * addresses are the university's own, and the others are look-alikes the player must learn to spot
 * (`payment-ueh.vn` imitates `payment.ueh.edu.vn`). They are display text only: the game never
 * loads them and never renders them as live links (`.kiro/steering/safety.md`). Every other
 * scenario domain stays on a reserved name (`.example`, `.test`, `.invalid`).
 */
export const OWNER_APPROVED_DOMAINS = ["ueh.edu.vn", "payment-ueh.vn", "quickpay-tasks.vn", "golden-platform-invest.com", "inkhoaluan.vn"] as const;

/** True when `host` is one of the approved domains or a subdomain of one. */
export function isOwnerApprovedHost(host: string): boolean {
  const h = host.toLowerCase();
  return OWNER_APPROVED_DOMAINS.some((domain) => h === domain || h.endsWith(`.${domain}`));
}
