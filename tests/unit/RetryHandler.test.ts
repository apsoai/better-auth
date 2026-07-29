/**
 * RetryHandler unit tests — the module was at 0% coverage and is the
 * adapter's transient-failure backbone (used by HttpClient on every request).
 */
import { RetryHandler } from '../../src/utils/RetryHandler';
import type { RetryConfig } from '../../src/types';

const fastConfig: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 1,
  maxDelayMs: 5,
  retryableStatuses: [429, 500, 503],
};

/** Minimal AdapterError look-alike: isAdapterError checks constructor name. */
class AdapterError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public statusCode?: number
  ) {
    super(message);
  }
}

describe('RetryHandler', () => {
  describe('executeWithRetry', () => {
    it('returns the result on first success without retrying', async () => {
      const handler = new RetryHandler(fastConfig);
      const fn = jest.fn().mockResolvedValue('ok');
      await expect(handler.executeWithRetry(fn)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries network errors and succeeds', async () => {
      const handler = new RetryHandler(fastConfig);
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockResolvedValue('recovered');
      await expect(handler.executeWithRetry(fn)).resolves.toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('retries timeout errors', async () => {
      const handler = new RetryHandler(fastConfig);
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockResolvedValue('after-timeout');
      await expect(handler.executeWithRetry(fn)).resolves.toBe('after-timeout');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('fails immediately on non-retryable errors', async () => {
      const handler = new RetryHandler(fastConfig);
      const fn = jest.fn().mockRejectedValue(new Error('validation failed'));
      await expect(handler.executeWithRetry(fn)).rejects.toThrow(
        'validation failed'
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws the last error after exhausting retries', async () => {
      const handler = new RetryHandler(fastConfig);
      const fn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(handler.executeWithRetry(fn)).rejects.toThrow(
        'ECONNREFUSED'
      );
      // initial attempt + maxRetries
      expect(fn).toHaveBeenCalledTimes(fastConfig.maxRetries + 1);
    });

    it('respects AdapterError retryable=false', async () => {
      const handler = new RetryHandler(fastConfig);
      const fn = jest
        .fn()
        .mockRejectedValue(new AdapterError('denied', false, 500));
      await expect(handler.executeWithRetry(fn)).rejects.toThrow('denied');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries AdapterError with a retryable status', async () => {
      const handler = new RetryHandler(fastConfig);
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new AdapterError('busy', true, 503))
        .mockResolvedValue('ok');
      await expect(handler.executeWithRetry(fn)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does not retry AdapterError with a non-retryable status', async () => {
      const handler = new RetryHandler(fastConfig);
      const fn = jest
        .fn()
        .mockRejectedValue(new AdapterError('bad request', true, 400));
      await expect(handler.executeWithRetry(fn)).rejects.toThrow('bad request');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('logs retry success through the provided logger', async () => {
      const logger = {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const handler = new RetryHandler(fastConfig, logger as any);
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValue('ok');
      await handler.executeWithRetry(fn, { operation: 'test-op' });
      expect(logger.info).toHaveBeenCalledWith(
        'Retry succeeded',
        expect.objectContaining({ attempt: 1, operation: 'test-op' })
      );
    });

    it('logs the immediate-fail path when the final attempt exhausts retries', async () => {
      // Note: the final failed attempt exits through the not-retryable branch
      // (attempt >= maxRetries), so the 'All retry attempts failed' error log
      // after the loop is unreachable — the debug log is the observable exit.
      const logger = {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const handler = new RetryHandler(fastConfig, logger as any);
      const fn = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
      await expect(handler.executeWithRetry(fn)).rejects.toThrow('ENOTFOUND');
      expect(fn).toHaveBeenCalledTimes(fastConfig.maxRetries + 1);
      expect(logger.debug).toHaveBeenCalledWith(
        'Error not retryable, failing immediately',
        expect.objectContaining({ attempt: fastConfig.maxRetries })
      );
    });
  });

  describe('static configs', () => {
    it('createDefaultConfig returns sane values', () => {
      const c = RetryHandler.createDefaultConfig();
      expect(c.maxRetries).toBe(3);
      expect(c.retryableStatuses).toContain(503);
    });

    it('createAggressiveConfig retries more, waits less initially', () => {
      const c = RetryHandler.createAggressiveConfig();
      expect(c.maxRetries).toBeGreaterThan(
        RetryHandler.createDefaultConfig().maxRetries
      );
      expect(c.retryableStatuses).toContain(408);
    });

    it('createConservativeConfig retries once', () => {
      const c = RetryHandler.createConservativeConfig();
      expect(c.maxRetries).toBe(1);
    });
  });
});
