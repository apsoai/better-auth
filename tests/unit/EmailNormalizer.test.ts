import { EmailNormalizer } from '../../src/utils/EmailNormalizer';

describe('EmailNormalizer.isValidEmail', () => {
  it('accepts an ordinary address and one at the 254 character limit', () => {
    expect(EmailNormalizer.isValidEmail('a@example.com')).toBe(true);
    const atLimit = `${'a'.repeat(254 - '@example.com'.length)}@example.com`;
    expect(atLimit).toHaveLength(254);
    expect(EmailNormalizer.isValidEmail(atLimit)).toBe(true);
  });

  it('rejects an address longer than 254 characters, quickly', () => {
    const started = Date.now();
    expect(EmailNormalizer.isValidEmail(`!@${'!.'.repeat(200_000)}`)).toBe(
      false
    );
    expect(EmailNormalizer.isValidEmail(`${'a'.repeat(255)}@example.com`)).toBe(
      false
    );
    expect(Date.now() - started).toBeLessThan(200);
  });
});
