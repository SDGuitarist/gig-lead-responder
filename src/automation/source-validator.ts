/**
 * Validates that an email came from a known lead platform.
 * Uses exact sender patterns (not substring matching) plus
 * Gmail SPF/DKIM header checks to prevent spoofing.
 */

/** Platforms that can arrive via Gmail (subset of the shared Platform type in types.ts). */
export type GmailPlatform = "gigsalad" | "yelp" | "squarespace";

const ALLOWED_SENDERS: Record<GmailPlatform, RegExp> = {
  gigsalad: /^(leads|noreply|notifications)@gigsalad\.com$/i,
  yelp: /^(no-reply|biz-alerts)@yelp\.com$/i,
  squarespace: /^(form-submission|noreply)@squarespace\.(com|info)$/i,
};

export interface ValidationResult {
  valid: boolean;
  platform?: GmailPlatform;
  reason?: string;
}

/**
 * Extract the email address from a "Display Name <email>" format header.
 */
function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}

/**
 * Check if Gmail's Authentication-Results header indicates SPF and DKIM pass.
 */
function checkAuthHeaders(authResults: string): boolean {
  if (!authResults) return false;
  const hasSPF = /spf=pass/i.test(authResults);
  const hasDKIM = /dkim=pass/i.test(authResults);
  return hasSPF && hasDKIM;
}

/**
 * Validate an incoming email against the sender allowlist and auth headers.
 *
 * @param fromHeader - The "From" header value (e.g., "GigSalad <leads@gigsalad.com>")
 * @param authenticationResults - Gmail's "Authentication-Results" header (for SPF/DKIM)
 */
export function validateSource(
  fromHeader: string,
  authenticationResults: string = ""
): ValidationResult {
  const email = extractEmail(fromHeader);

  // Match against allowlist
  for (const [platform, pattern] of Object.entries(ALLOWED_SENDERS)) {
    if (pattern.test(email)) {
      // Check SPF/DKIM if auth header is available
      if (authenticationResults && !checkAuthHeaders(authenticationResults)) {
        return {
          valid: false,
          platform: platform as GmailPlatform,
          reason: `Sender ${email} matched ${platform} but SPF/DKIM check failed — possible spoofing`,
        };
      }
      return { valid: true, platform: platform as GmailPlatform };
    }
  }

  return { valid: false, reason: `Unknown sender: ${email}` };
}
