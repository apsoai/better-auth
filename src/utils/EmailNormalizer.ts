/**
 * Email Normalizer Utility
 *
 * This utility handles email address normalization for consistent
 * email handling across the adapter.
 */

export class EmailNormalizer {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Normalize an email address
   * @param email - Email address to normalize
   * @returns Normalized email address
   */
  static normalize(email: string): string {
    // TODO: Implement email normalization
    // 1. Convert to lowercase
    // 2. Trim whitespace
    // 3. Validate format
    // 4. Apply domain-specific normalization rules

    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email: must be a non-empty string');
    }

    // Basic normalization
    let normalized = email.toLowerCase().trim();

    // Validate format
    if (!this.isValidEmail(normalized)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    // Apply domain-specific rules
    normalized = this.applyDomainRules(normalized);

    return normalized;
  }

  /**
   * Validate email format
   * @param email - Email to validate
   * @returns True if email format is valid
   */
  static isValidEmail(email: string): boolean {
    return this.EMAIL_REGEX.test(email);
  }

  /**
   * Apply domain-specific normalization rules
   * @param email - Email to process
   * @returns Email with domain-specific rules applied
   */
  private static applyDomainRules(email: string): string {
    // TODO: Apply domain-specific normalization rules
    // 1. Handle Gmail dot and plus rules
    // 2. Handle other common email providers
    // 3. Return normalized email

    const [localPart, domain] = email.split('@');

    if (!localPart || !domain) {
      return email;
    }

    // Gmail-specific rules
    if (this.isGmailDomain(domain)) {
      return this.normalizeGmail(localPart, domain);
    }

    return email;
  }

  /**
   * Check if domain is Gmail
   * @param domain - Email domain
   * @returns True if Gmail domain
   */
  private static isGmailDomain(domain: string): boolean {
    const gmailDomains = ['gmail.com', 'googlemail.com'];
    return gmailDomains.includes(domain.toLowerCase());
  }

  /**
   * Apply Gmail-specific normalization
   * @param localPart - Local part of Gmail address
   * @param domain - Gmail domain
   * @returns Normalized Gmail address
   */
  private static normalizeGmail(localPart: string, domain: string): string {
    // TODO: Implement Gmail normalization rules
    // 1. Remove dots from local part
    // 2. Remove everything after + (plus addressing)
    // 3. Convert googlemail.com to gmail.com

    let normalized = localPart;

    // Remove plus addressing (everything after +)
    const plusIndex = normalized.indexOf('+');
    if (plusIndex !== -1) {
      normalized = normalized.substring(0, plusIndex);
    }

    // Remove dots
    normalized = normalized.replace(/\./g, '');

    // Normalize domain to gmail.com
    const normalizedDomain =
      domain.toLowerCase() === 'googlemail.com'
        ? 'gmail.com'
        : domain.toLowerCase();

    return `${normalized}@${normalizedDomain}`;
  }
}
