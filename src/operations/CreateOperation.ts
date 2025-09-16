/**
 * Create Operation Implementation
 *
 * This module handles create operations for the Apso adapter.
 */

import type { CreateParams, CreateManyParams } from '../types';

export class CreateOperation {
  // TODO: Implement create operation
  // Will be implemented in Phase 3

  async create<T>(_params: CreateParams): Promise<T> {
    throw new Error('Method not implemented - Phase 3');
  }

  async createMany<T>(_params: CreateManyParams): Promise<T[]> {
    throw new Error('Method not implemented - Phase 3');
  }
}
