/**
 * Comprehensive Apso SDK Mock for Unit Tests
 *
 * This mock provides a complete implementation of the Apso SDK
 * for testing our adapter operations without hitting real HTTP endpoints.
 */

export interface MockApsoClientConfig {
  baseURL: string;
  apiKey: string;
  client?: 'fetch' | 'axios';
}

export interface MockQueryParams {
  fields?: string[];
  filter?: Record<string, any>;
  or?: Record<string, any>;
  join?: string[];
  sort?: Record<string, 'ASC' | 'DESC'>;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface MockEntityClient {
  select: jest.MockedFunction<(fields: string[]) => MockEntityClient>;
  where: jest.MockedFunction<(filter: Record<string, any>) => MockEntityClient>;
  or: jest.MockedFunction<
    (orCondition: Record<string, any>) => MockEntityClient
  >;
  join: jest.MockedFunction<(joinTables: string[]) => MockEntityClient>;
  orderBy: jest.MockedFunction<
    (sort: Record<string, 'ASC' | 'DESC'>) => MockEntityClient
  >;
  limit: jest.MockedFunction<(limit: number) => MockEntityClient>;
  offset: jest.MockedFunction<(offset: number) => MockEntityClient>;
  page: jest.MockedFunction<(page: number) => MockEntityClient>;
  cache: jest.MockedFunction<
    (useCache?: boolean, duration?: number) => MockEntityClient
  >;
  get: jest.MockedFunction<() => Promise<any>>;
  post: jest.MockedFunction<(data: any) => Promise<any>>;
  put: jest.MockedFunction<(data: any) => Promise<any>>;
  delete: jest.MockedFunction<() => Promise<any>>;
}

export interface MockApsoClient {
  entity: jest.MockedFunction<(entityName: string) => MockEntityClient>;
  get: jest.MockedFunction<
    (
      resource: string,
      params?: MockQueryParams,
      useCache?: boolean,
      cacheDuration?: number
    ) => Promise<any>
  >;
  post: jest.MockedFunction<(resource: string, data: any) => Promise<any>>;
  put: jest.MockedFunction<(resource: string, data: any) => Promise<any>>;
  delete: jest.MockedFunction<(resource: string) => Promise<any>>;
}

// Mock data store for consistent test behavior
export class MockDataStore {
  private static instance: MockDataStore;
  private readonly data = new Map<string, Map<string, any>>();
  private readonly idCounters = new Map<string, number>();

  public static getInstance(): MockDataStore {
    if (!MockDataStore.instance) {
      MockDataStore.instance = new MockDataStore();
    }
    return MockDataStore.instance;
  }

  public reset(): void {
    this.data.clear();
    this.idCounters.clear();
  }

  public createEntity(entityType: string, data: any): any {
    if (!this.data.has(entityType)) {
      this.data.set(entityType, new Map());
      this.idCounters.set(entityType, 1);
    }

    const id = data.id || this.generateId(entityType);
    const entityData = {
      ...data,
      id,
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.data.get(entityType)!.set(id, entityData);
    return entityData;
  }

  public getEntity(entityType: string, id: string): any | null {
    const entities = this.data.get(entityType);
    return entities?.get(id) || null;
  }

  public updateEntity(
    entityType: string,
    id: string,
    updates: any
  ): any | null {
    const entities = this.data.get(entityType);
    const existing = entities?.get(id);

    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      updated_at: new Date(),
    };

    entities!.set(id, updated);
    return updated;
  }

  public deleteEntity(entityType: string, id: string): any | null {
    const entities = this.data.get(entityType);
    const existing = entities?.get(id);

    if (!existing) return null;

    entities!.delete(id);
    return existing;
  }

  public findEntities(entityType: string, filter?: Record<string, any>): any[] {
    const entities = this.data.get(entityType);
    if (!entities) return [];

    let results = Array.from(entities.values());

    if (filter) {
      results = results.filter(entity => {
        return Object.entries(filter).every(([key, value]) => {
          if (key === 'email' && typeof value === 'string') {
            // Case-insensitive email matching
            return entity[key]?.toLowerCase() === value.toLowerCase();
          }
          if (key === 'emailVerified' && typeof value === 'boolean') {
            // Handle boolean matching
            return entity[key] === value;
          }
          if (key === 'sessionToken' && typeof value === 'string') {
            // Handle session token matching
            return entity[key] === value;
          }
          if (key === 'identifier' && typeof value === 'string') {
            // Handle verification token identifier matching
            return entity[key] === value;
          }
          if (key === 'token' && typeof value === 'string') {
            // Handle verification token matching (check both token and value fields)
            return entity[key] === value || entity['value'] === value;
          }
          if (key === 'value' && typeof value === 'string') {
            // Handle verification value matching (BetterAuth format)
            return entity[key] === value || entity['token'] === value;
          }
          return entity[key] === value;
        });
      });
    }

    return results;
  }

  public countEntities(
    entityType: string,
    filter?: Record<string, any>
  ): number {
    return this.findEntities(entityType, filter).length;
  }

  public updateMany(
    entityType: string,
    filter: Record<string, any>,
    updates: any
  ): number {
    const entities = this.findEntities(entityType, filter);
    let updateCount = 0;

    entities.forEach(entity => {
      const updated = this.updateEntity(entityType, entity.id, updates);
      if (updated) {
        updateCount++;
      }
    });

    return updateCount;
  }

  public deleteMany(entityType: string, filter: Record<string, any>): number {
    const entities = this.findEntities(entityType, filter);
    let deleteCount = 0;

    entities.forEach(entity => {
      const deleted = this.deleteEntity(entityType, entity.id);
      if (deleted) {
        deleteCount++;
      }
    });

    return deleteCount;
  }

  public findByUniqueField(
    entityType: string,
    field: string,
    value: any
  ): any | null {
    const entities = this.data.get(entityType);
    if (!entities) return null;

    const results = Array.from(entities.values());
    const found = results.find(entity => {
      if (field === 'email' && typeof value === 'string') {
        return entity[field]?.toLowerCase() === value.toLowerCase();
      }
      return entity[field] === value;
    });

    return found || null;
  }

  private generateId(entityType: string): string {
    const counter = this.idCounters.get(entityType) || 1;
    this.idCounters.set(entityType, counter + 1);
    return `${entityType}_${Date.now()}_${counter}`;
  }
}

// Create mock EntityClient
function createMockEntityClient(entityName: string): MockEntityClient {
  const store = MockDataStore.getInstance();

  // Create a query builder state for method chaining
  let queryState = {
    fields: undefined as string[] | undefined,
    filter: undefined as Record<string, any> | undefined,
    or: undefined as Record<string, any> | undefined,
    join: undefined as string[] | undefined,
    sort: undefined as Record<string, 'ASC' | 'DESC'> | undefined,
    limit: undefined as number | undefined,
    offset: undefined as number | undefined,
    page: undefined as number | undefined,
    useCache: false,
    cacheDuration: 60,
  };

  const entityClient: MockEntityClient = {
    select: jest.fn((fields: string[]) => {
      queryState.fields = fields;
      return entityClient;
    }),

    where: jest.fn((filter: Record<string, any>) => {
      queryState.filter = filter;
      return entityClient;
    }),

    or: jest.fn((orCondition: Record<string, any>) => {
      queryState.or = orCondition;
      return entityClient;
    }),

    join: jest.fn((joinTables: string[]) => {
      queryState.join = joinTables;
      return entityClient;
    }),

    orderBy: jest.fn((sort: Record<string, 'ASC' | 'DESC'>) => {
      queryState.sort = sort;
      return entityClient;
    }),

    limit: jest.fn((limit: number) => {
      queryState.limit = limit;
      return entityClient;
    }),

    offset: jest.fn((offset: number) => {
      queryState.offset = offset;
      return entityClient;
    }),

    page: jest.fn((page: number) => {
      queryState.page = page;
      return entityClient;
    }),

    cache: jest.fn((useCache = true, duration = 60) => {
      queryState.useCache = useCache;
      queryState.cacheDuration = duration;
      return entityClient;
    }),

    get: jest.fn(async () => {
      // Reset query state after use
      const filter = queryState.filter;
      queryState = {
        fields: undefined,
        filter: undefined,
        or: undefined,
        join: undefined,
        sort: undefined,
        limit: undefined,
        offset: undefined,
        page: undefined,
        useCache: false,
        cacheDuration: 60,
      };

      return store.findEntities(entityName, filter);
    }),

    post: jest.fn(async (data: any) => {
      return store.createEntity(entityName, data);
    }),

    put: jest.fn(async (data: any) => {
      if (!data.id) {
        throw new Error('PUT requires an ID');
      }
      const result = store.updateEntity(entityName, data.id, data);
      if (!result) {
        const error = new Error('Not found') as any;
        error.status = 404;
        throw error;
      }
      return result;
    }),

    delete: jest.fn(async () => {
      // For delete operations, we need to know which entity to delete
      // This would typically be based on query filters or ID in URL
      if (queryState.filter?.id) {
        const result = store.deleteEntity(entityName, queryState.filter.id);
        if (!result) {
          const error = new Error('Not found') as any;
          error.status = 404;
          throw error;
        }
        return result;
      }
      throw new Error('Delete requires an ID filter');
    }),
  };

  return entityClient;
}

// Create mock ApsoClient
function createMockApsoClient(): MockApsoClient {
  const store = MockDataStore.getInstance();

  return {
    entity: jest.fn((entityName: string) => {
      return createMockEntityClient(entityName);
    }),

    get: jest.fn(async (resource: string, params?: MockQueryParams) => {
      // Parse resource to get entity type and ID
      const [, entityType, id] = resource.split('/');

      if (id && entityType) {
        // Single entity request
        const result = store.getEntity(entityType, id);
        if (!result) {
          const error = new Error('Not found') as any;
          error.status = 404;
          throw error;
        }
        return result;
      } else if (entityType) {
        // Multiple entities request
        return store.findEntities(entityType, params?.filter);
      }
      return [];
    }),

    post: jest.fn(async (resource: string, data: any) => {
      const [, entityType] = resource.split('/');
      if (!entityType) throw new Error('Invalid resource path');
      return store.createEntity(entityType, data);
    }),

    put: jest.fn(async (resource: string, data: any) => {
      const [, entityType, id] = resource.split('/');

      if (!id) {
        throw new Error('PUT requires an ID in the resource path');
      }
      if (!entityType) throw new Error('Invalid resource path');

      const result = store.updateEntity(entityType, id, data);
      if (!result) {
        const error = new Error('Not found') as any;
        error.status = 404;
        throw error;
      }
      return result;
    }),

    delete: jest.fn(async (resource: string) => {
      const [, entityType, id] = resource.split('/');

      if (!id) {
        throw new Error('DELETE requires an ID in the resource path');
      }
      if (!entityType) throw new Error('Invalid resource path');

      const result = store.deleteEntity(entityType, id);
      if (!result) {
        const error = new Error('Not found') as any;
        error.status = 404;
        throw error;
      }
      return result;
    }),
  };
}

// Mock factory
export const mockApsoClientFactory = {
  getClient: jest.fn((_config: MockApsoClientConfig) => {
    return createMockApsoClient();
  }),
};

// Export the data store for test setup
// Note: MockDataStore class and other functions already exported above
