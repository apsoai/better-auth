/**
 * VerificationTokenOperations unit tests
 *
 * Regression coverage for the OAuth login break: findVerificationTokensByIdentifier
 * must filter server-side. It previously issued an unfiltered GET /verifications and
 * filtered only the first page client-side, so once the table grew past one page the
 * target token was missed -> "No verification token found for deletion" -> every
 * OAuth login bounced back to /login.
 */

import { VerificationTokenOperations } from '../../../src/operations/VerificationTokenOperations';
import type { ApsoAdapterConfig } from '../../../src/types';
import { createTestConfig, createMockLogger } from '../testUtils';

describe('VerificationTokenOperations - server-side filtering', () => {
  let ops: VerificationTokenOperations;
  let mockHttpClient: any;
  let mockConfig: ApsoAdapterConfig;

  beforeEach(() => {
    mockConfig = createTestConfig({ logger: createMockLogger() });

    mockHttpClient = {
      request: jest.fn(),
      get: jest.fn().mockResolvedValue([]),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    const mockQueryTranslator = {
      translateWhere: jest.fn(),
      buildQuery: jest.fn(),
      addTenantScope: jest.fn(),
      buildFindQuery: jest.fn(),
    } as any;

    const mockResponseNormalizer = {
      normalizeSingleResponse: jest.fn(),
      normalizeArrayResponse: jest.fn((r: unknown) =>
        Array.isArray(r) ? r : []
      ),
      normalizeCountResponse: jest.fn(),
    } as any;

    const mockEntityMapper = {
      mapVerificationTokenToApi: jest.fn(),
      mapVerificationTokenFromApi: jest.fn((t: any) => t),
      getApiPath: jest.fn(),
      transformOutbound: jest.fn(),
      transformInbound: jest.fn(),
      validate: jest.fn(),
    } as any;

    ops = new VerificationTokenOperations({
      httpClient: mockHttpClient,
      queryTranslator: mockQueryTranslator,
      responseNormalizer: mockResponseNormalizer,
      entityMapper: mockEntityMapper,
      config: mockConfig,
    } as any);
  });

  it('sends an identifier filter as a query parameter (not an unfiltered GET)', async () => {
    await ops.findVerificationTokensByIdentifier('state-token-abc');

    expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    const calledUrl = mockHttpClient.get.mock.calls[0][0] as string;
    // The regression: the URL must scope the query server-side to this identifier.
    expect(calledUrl).toContain('filter=identifier||eq||state-token-abc');
    // Guard against the old behaviour: a bare /verifications with no query string.
    expect(calledUrl).toMatch(/\?filter=/);
  });

  it('url-encodes identifiers that contain special characters', async () => {
    await ops.findVerificationTokensByIdentifier('user+tag@example.com');

    const calledUrl = mockHttpClient.get.mock.calls[0][0] as string;
    expect(calledUrl).toContain('filter=identifier||eq||');
    // '+' and '@' must be encoded so the filter is transmitted intact.
    expect(calledUrl).not.toContain('user+tag@example.com');
  });
});
