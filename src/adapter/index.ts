/**
 * Adapter factory and main entry point
 */

export {
  ApsoAdapterFactory,
  apsoAdapter,
  createApsoAdapter,
  createReliableApsoAdapter,
  createHighThroughputApsoAdapter,
  checkAdapterHealth,
  getActiveAdapters,
  closeAllAdapters,
} from './ApsoAdapterFactory';

export { ApsoAdapter } from './ApsoAdapter';
export type { ApsoAdapterComponents } from './ApsoAdapter';
export type { ApsoAdapterConfig } from '../types';
