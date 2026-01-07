/**
 * EntityMapper for transforming data between Better Auth format and Apso API format
 *
 * This class handles bidirectional transformation between Better Auth entities
 * and Apso API entities, including field name differences, data type conversions,
 * date formatting, email normalization, and validation.
 *
 * @example
 * ```typescript
 * const mapper = new EntityMapper();
 *
 * // Transform Better Auth user to Apso API format
 * const betterAuthUser: BetterAuthUser = {
 *   id: '123',
 *   email: 'user@example.com',
 *   emailVerified: true,
 *   name: 'John Doe'
 * };
 * const apsoUser = mapper.mapUserToApi(betterAuthUser);
 *
 * // Transform Apso API user back to Better Auth format
 * const transformedUser = mapper.mapUserFromApi(apsoUser);
 * ```
 */

import {
  BetterAuthUser,
  BetterAuthSession,
  BetterAuthVerificationToken,
  BetterAuthAccount,
  BetterAuthAccountWithPassword,
  ApsoUser,
  ApsoSession,
  ApsoVerificationToken,
  ApsoAccount,
  EntityType,
  TransformationDirection,
  BetterAuthEntity,
  ApsoEntity,
  ValidationError,
  AdapterError,
  AdapterErrorCode,
} from '../types/index';
import { EmailNormalizer } from '../utils/EmailNormalizer';

/**
 * Configuration options for EntityMapper
 */
export interface EntityMapperConfig {
  /** Whether to enable email normalization for user entities */
  enableEmailNormalization: boolean;
  /** Whether to validate entities during transformation */
  enableValidation: boolean;
  /** Whether to include timestamps in transformations */
  includeTimestamps: boolean;
}

/**
 * Default configuration for EntityMapper
 */
const DEFAULT_CONFIG: EntityMapperConfig = {
  enableEmailNormalization: true,
  enableValidation: false, // Disabled by default for compatibility
  includeTimestamps: true,
};

/**
 * EntityMapper class for transforming data between Better Auth and Apso API formats
 *
 * Provides bidirectional mapping with support for:
 * - Field name transformations
 * - Data type conversions
 * - Email normalization
 * - Timestamp management
 * - Comprehensive validation
 * - Null/undefined value handling
 */
export class EntityMapper {
  private readonly config: EntityMapperConfig;

  /**
   * Create a new EntityMapper instance
   * @param config - Configuration options for the mapper
   */
  constructor(config: Partial<EntityMapperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // =============================================================================
  // User Entity Mapping
  // =============================================================================

  /**
   * Transform Better Auth user to Apso API format
   * @param user - Better Auth user entity
   * @returns Transformed Apso API user entity
   * @throws {AdapterError} If validation fails or transformation error occurs
   */
  mapUserToApi(user: BetterAuthUser): ApsoUser {
    try {
      if (this.config.enableValidation && user.id && user.id !== '') {
        this.validateBetterAuthUser(user);
      }

      const currentTime = new Date();
      let normalizedEmail = user.email;

      // Normalize email if enabled
      if (this.config.enableEmailNormalization && user.email) {
        try {
          normalizedEmail = EmailNormalizer.normalize(user.email);
        } catch (error) {
          throw new AdapterError(
            AdapterErrorCode.VALIDATION_ERROR,
            `Invalid email format: ${(error as Error).message}`,
            { email: user.email },
            false,
            400
          );
        }
      }

      const apsoUser: ApsoUser = {
        // Only include ID if it's a meaningful value (not empty string)
        ...(user.id && user.id !== '' && { id: user.id }),
        email: normalizedEmail,
        emailVerified: user.emailVerified,
        // Include hashedPassword in User table (mapped to password_hash in API)
        ...(user.hashedPassword && { password_hash: user.hashedPassword }),
        ...(user.name !== undefined && user.name !== '' && { name: user.name }),
        ...(user.image !== undefined &&
          user.image !== '' && { image: user.image }),
        // Let backend handle timestamps for new records
        ...(user.id &&
          user.id !== '' &&
          this.config.includeTimestamps && {
            created_at: currentTime,
            updated_at: currentTime,
          }),
      };

      // Skip validation for new users (no ID indicates creation)
      if (this.config.enableValidation && apsoUser.id) {
        this.validateApsoUser(apsoUser);
      }

      return apsoUser;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Failed to transform user to API format: ${(error as Error).message}`,
        { user, error },
        false
      );
    }
  }

  /**
   * Transform partial user update data to API format (for PATCH operations)
   * Unlike mapUserToApi, this does NOT include all fields - only fields explicitly provided
   * @param updateData - Partial user data to update
   * @returns Transformed partial data for API
   */
  mapUserPartialToApi(updateData: Partial<BetterAuthUser>): Partial<ApsoUser> {
    console.log('[EntityMapper] mapUserPartialToApi - Input:', JSON.stringify(updateData, null, 2));

    const result: Partial<ApsoUser> = {};

    // Only include fields that are explicitly provided (not undefined)
    if (updateData.email !== undefined) {
      result.email = this.config.enableEmailNormalization
        ? EmailNormalizer.normalize(updateData.email)
        : updateData.email;
    }
    if (updateData.emailVerified !== undefined) {
      result.emailVerified = updateData.emailVerified;
    }
    if (updateData.name !== undefined) {
      result.name = updateData.name;
    }
    if (updateData.image !== undefined) {
      result.image = updateData.image;
    }
    if (updateData.hashedPassword !== undefined) {
      result.password_hash = updateData.hashedPassword;
    }

    // Add updated_at timestamp
    result.updated_at = new Date();

    console.log('[EntityMapper] mapUserPartialToApi - Output:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Transform Apso API user to Better Auth format
   * @param apiUser - Apso API user entity
   * @returns Transformed Better Auth user entity
   * @throws {AdapterError} If validation fails or transformation error occurs
   */
  mapUserFromApi(apiUser: ApsoUser): BetterAuthUser {
    try {
      if (this.config.enableValidation) {
        this.validateApsoUser(apiUser);
      }

      const betterAuthUser: BetterAuthUser = {
        id: String(apiUser.id), // Convert numeric ID to string for Better Auth
        email: apiUser.email,
        emailVerified: apiUser.emailVerified,
        // Map password_hash from API back to hashedPassword for Better Auth
        ...(apiUser.password_hash !== undefined && {
          hashedPassword: apiUser.password_hash,
        }),
        ...(apiUser.name !== undefined && { name: apiUser.name }),
        ...(apiUser.image !== undefined && { image: apiUser.image }),
      };

      if (this.config.enableValidation) {
        this.validateBetterAuthUser(betterAuthUser);
      }

      return betterAuthUser;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Failed to transform user from API format: ${(error as Error).message}`,
        { apiUser, error },
        false
      );
    }
  }

  // =============================================================================
  // Session Entity Mapping
  // =============================================================================

  /**
   * Transform Better Auth session to Apso API format
   * @param session - Better Auth session entity
   * @returns Transformed Apso API session entity
   * @throws {AdapterError} If validation fails or transformation error occurs
   */
  mapSessionToApi(session: BetterAuthSession): ApsoSession {
    try {
      if (this.config.enableValidation) {
        this.validateBetterAuthSession(session);
      }

      const currentTime = new Date();
      const apsoSession: ApsoSession = {
        id: session.id,
        sessionToken: session.sessionToken,
        userId: session.userId,
        expiresAt: session.expiresAt,
        created_at: this.config.includeTimestamps ? currentTime : currentTime,
        updated_at: this.config.includeTimestamps ? currentTime : currentTime,
      };

      if (this.config.enableValidation) {
        this.validateApsoSession(apsoSession);
      }

      return apsoSession;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Failed to transform session to API format: ${(error as Error).message}`,
        { session, error },
        false
      );
    }
  }

  /**
   * Transform Apso API session to Better Auth format
   * @param apiSession - Apso API session entity
   * @returns Transformed Better Auth session entity
   * @throws {AdapterError} If validation fails or transformation error occurs
   */
  mapSessionFromApi(apiSession: ApsoSession): BetterAuthSession {
    try {
      if (this.config.enableValidation) {
        this.validateApsoSession(apiSession);
      }

      // Create Better Auth session object with required token field
      const betterAuthSession: BetterAuthSession = {
        // Better Auth requires both id AND token fields for proper cookie handling
        id: apiSession.id, // Session token as database primary key
        // Apso stores session token in 'token' field, check both for compatibility
        sessionToken: apiSession.sessionToken || (apiSession as any).token || apiSession.id,
        token: (apiSession as any).token || apiSession.id, // Better Auth uses session.token for cookie value!
        userId: apiSession.userId,
        expiresAt:
          apiSession.expiresAt instanceof Date
            ? apiSession.expiresAt
            : new Date(apiSession.expiresAt),
        ipAddress: apiSession.ipAddress || '',
        userAgent: apiSession.userAgent || '',
      };

      if (this.config.enableValidation) {
        this.validateBetterAuthSession(betterAuthSession);
      }

      return betterAuthSession;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Failed to transform session from API format: ${(error as Error).message}`,
        { apiSession, error },
        false
      );
    }
  }

  // =============================================================================
  // VerificationToken Entity Mapping
  // =============================================================================

  /**
   * Transform Better Auth verification token to Apso API format
   * @param token - Better Auth verification token entity
   * @returns Transformed Apso API verification token entity
   * @throws {AdapterError} If validation fails or transformation error occurs
   */
  mapVerificationTokenToApi(
    token: BetterAuthVerificationToken
  ): ApsoVerificationToken {
    try {
      if (this.config.enableValidation) {
        this.validateBetterAuthVerificationToken(token);
      }

      const currentTime = new Date();
      // Use value field (BetterAuth format) with token as fallback
      const tokenValue = token.value || token.token || '';
      const apsoToken: ApsoVerificationToken = {
        identifier: token.identifier,
        value: tokenValue,
        token: tokenValue, // Backward compatibility
        expiresAt: token.expiresAt,
        created_at: this.config.includeTimestamps ? currentTime : currentTime,
      };

      if (this.config.enableValidation) {
        this.validateApsoVerificationToken(apsoToken);
      }

      return apsoToken;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Failed to transform verification token to API format: ${(error as Error).message}`,
        { token, error },
        false
      );
    }
  }

  /**
   * Transform Apso API verification token to Better Auth format
   * @param apiToken - Apso API verification token entity
   * @returns Transformed Better Auth verification token entity
   * @throws {AdapterError} If validation fails or transformation error occurs
   */
  mapVerificationTokenFromApi(
    apiToken: ApsoVerificationToken
  ): BetterAuthVerificationToken {
    try {
      if (this.config.enableValidation) {
        this.validateApsoVerificationToken(apiToken);
      }

      // Use value field (BetterAuth format) with token as fallback
      const tokenValue = apiToken.value || apiToken.token || '';
      const betterAuthToken: BetterAuthVerificationToken = {
        identifier: apiToken.identifier,
        value: tokenValue,
        token: tokenValue, // Backward compatibility
        expiresAt: new Date(apiToken.expiresAt || apiToken.expires_at!),
      };
      // Only add optional fields if they have values (for exactOptionalPropertyTypes)
      if (apiToken.id) {
        betterAuthToken.id = String(apiToken.id);
      }
      if (apiToken.createdAt || apiToken.created_at) {
        betterAuthToken.createdAt = new Date(apiToken.createdAt || apiToken.created_at!);
      }
      if (apiToken.updatedAt || apiToken.updated_at) {
        betterAuthToken.updatedAt = new Date(apiToken.updatedAt || apiToken.updated_at!);
      }

      if (this.config.enableValidation) {
        this.validateBetterAuthVerificationToken(betterAuthToken);
      }

      return betterAuthToken;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Failed to transform verification token from API format: ${(error as Error).message}`,
        { apiToken, error },
        false
      );
    }
  }

  // =============================================================================
  // Account Entity Mapping (Optional)
  // =============================================================================

  /**
   * Transform Better Auth account to Apso API format
   * @param account - Better Auth account entity
   * @returns Transformed Apso API account entity
   * @throws {AdapterError} If validation fails or transformation error occurs
   */
  mapAccountToApi(
    account: BetterAuthAccount | BetterAuthAccountWithPassword
  ): ApsoAccount {
    try {
      if (this.config.enableValidation) {
        this.validateBetterAuthAccount(account);
      }

      const currentTime = new Date();
      const accountWithPassword = account as BetterAuthAccountWithPassword;

      // DEBUG: Log what Better Auth is sending us
      console.log(
        '[EntityMapper] mapAccountToApi - Received from Better Auth:'
      );
      console.log('[EntityMapper]   account.provider:', account.provider);
      console.log(
        '[EntityMapper]   account.providerAccountId:',
        account.providerAccountId
      );
      console.log('[EntityMapper]   account.userId:', account.userId);
      console.log('[EntityMapper]   account.type:', account.type);
      console.log(
        '[EntityMapper]   Full account object:',
        JSON.stringify(account, null, 2)
      );

      const apsoAccount: ApsoAccount = {
        // Only include ID if it's a meaningful value (not empty string)
        ...(account.id && account.id !== '' && { id: account.id }),
        userId: account.userId,
        type: account.type || 'credential', // Default to 'credential' for email/password auth
        providerId:
          account.provider || accountWithPassword.providerId || 'credential', // Handle providerId field
        accountId:
          account.providerAccountId ||
          accountWithPassword.accountId ||
          account.userId,
        ...(accountWithPassword.password && {
          password: accountWithPassword.password,
        }),
        ...(account.refresh_token !== undefined && {
          refresh_token: account.refresh_token,
        }),
        ...(account.access_token !== undefined && {
          access_token: account.access_token,
        }),
        ...(account.expires_at !== undefined && {
          expires_at: account.expires_at,
        }),
        ...(account.token_type !== undefined && {
          token_type: account.token_type,
        }),
        ...(account.scope !== undefined && { scope: account.scope }),
        ...(account.id_token !== undefined && { id_token: account.id_token }),
        ...(account.session_state !== undefined && {
          session_state: account.session_state,
        }),
        created_at: this.config.includeTimestamps ? currentTime : currentTime,
        updated_at: this.config.includeTimestamps ? currentTime : currentTime,
      };

      if (this.config.enableValidation) {
        this.validateApsoAccount(apsoAccount);
      }

      return apsoAccount;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Failed to transform account to API format: ${(error as Error).message}`,
        { account, error },
        false
      );
    }
  }

  /**
   * Transform partial account update data to API format (for PATCH operations)
   * Unlike mapAccountToApi, this does NOT set defaults - only includes fields that are explicitly provided
   * @param updateData - Partial account data to update
   * @returns Transformed partial data for API
   */
  mapAccountPartialToApi(updateData: Partial<BetterAuthAccount>): Partial<ApsoAccount> {
    console.log('[EntityMapper] mapAccountPartialToApi - Input:', JSON.stringify(updateData, null, 2));

    const result: Partial<ApsoAccount> = {};

    // Only include fields that are explicitly provided (not undefined)
    if (updateData.userId !== undefined) {
      result.userId = updateData.userId;
    }
    if (updateData.type !== undefined) {
      result.type = updateData.type;
    }
    if (updateData.provider !== undefined) {
      result.providerId = updateData.provider;
    }
    if ((updateData as any).providerId !== undefined) {
      result.providerId = (updateData as any).providerId;
    }
    if (updateData.providerAccountId !== undefined) {
      result.accountId = updateData.providerAccountId;
    }
    if ((updateData as any).accountId !== undefined) {
      result.accountId = (updateData as any).accountId;
    }
    if ((updateData as any).password !== undefined) {
      result.password = (updateData as any).password;
    }
    if (updateData.refresh_token !== undefined) {
      result.refresh_token = updateData.refresh_token;
    }
    if (updateData.access_token !== undefined) {
      result.access_token = updateData.access_token;
    }
    if (updateData.expires_at !== undefined) {
      result.expires_at = updateData.expires_at;
    }
    if (updateData.token_type !== undefined) {
      result.token_type = updateData.token_type;
    }
    if (updateData.scope !== undefined) {
      result.scope = updateData.scope;
    }
    if (updateData.id_token !== undefined) {
      result.id_token = updateData.id_token;
    }
    if (updateData.session_state !== undefined) {
      result.session_state = updateData.session_state;
    }

    // Add updated_at timestamp
    result.updated_at = new Date();

    console.log('[EntityMapper] mapAccountPartialToApi - Output:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Transform Apso API account to Better Auth format
   * @param apiAccount - Apso API account entity
   * @returns Transformed Better Auth account entity
   * @throws {AdapterError} If validation fails or transformation error occurs
   */
  mapAccountFromApi(apiAccount: ApsoAccount): BetterAuthAccount {
    try {
      if (this.config.enableValidation) {
        this.validateApsoAccount(apiAccount);
      }

      const betterAuthAccount: BetterAuthAccount = {
        id: String(apiAccount.id), // Convert to string for Better Auth
        userId: String(apiAccount.userId), // Convert to string for Better Auth
        type: apiAccount.type,
        provider: apiAccount.providerId,
        // CRITICAL: Better Auth runtime uses providerId (not provider) to find credential accounts!
        // See: user.accounts.find((a) => a.providerId === "credential")
        providerId: apiAccount.providerId,
        providerAccountId: apiAccount.accountId || String(apiAccount.id),
        // Map to Better Auth field names
        accountId: apiAccount.accountId || String(apiAccount.id),
        // Include password field for credential authentication
        ...(apiAccount.password !== undefined &&
          apiAccount.password !== null && {
            password: apiAccount.password,
          }),
        ...(apiAccount.refresh_token !== undefined && {
          refresh_token: apiAccount.refresh_token,
        }),
        ...(apiAccount.access_token !== undefined && {
          access_token: apiAccount.access_token,
        }),
        ...(apiAccount.expires_at !== undefined && {
          expires_at: apiAccount.expires_at,
        }),
        ...(apiAccount.token_type !== undefined && {
          token_type: apiAccount.token_type,
        }),
        ...(apiAccount.scope !== undefined && { scope: apiAccount.scope }),
        ...(apiAccount.id_token !== undefined && {
          id_token: apiAccount.id_token,
        }),
        ...(apiAccount.session_state !== undefined && {
          session_state: apiAccount.session_state,
        }),
      };

      if (this.config.enableValidation) {
        this.validateBetterAuthAccount(betterAuthAccount);
      }

      return betterAuthAccount;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Failed to transform account from API format: ${(error as Error).message}`,
        { apiAccount, error },
        false
      );
    }
  }

  // =============================================================================
  // Generic Entity Mapping
  // =============================================================================

  /**
   * Generic entity mapping function
   * @param entity - Entity to transform
   * @param entityType - Type of entity being transformed
   * @param direction - Direction of transformation ('toApi' or 'fromApi')
   * @returns Transformed entity
   * @throws {AdapterError} If unsupported entity type or transformation error occurs
   */
  mapEntity<
    T extends BetterAuthEntity | ApsoEntity,
    U extends ApsoEntity | BetterAuthEntity,
  >(entity: T, entityType: EntityType, direction: TransformationDirection): U {
    try {
      switch (entityType) {
        case EntityType.USER:
          if (direction === 'toApi') {
            return this.mapUserToApi(entity as BetterAuthUser) as U;
          } else {
            return this.mapUserFromApi(entity as ApsoUser) as U;
          }

        case EntityType.SESSION:
          if (direction === 'toApi') {
            return this.mapSessionToApi(entity as BetterAuthSession) as U;
          } else {
            return this.mapSessionFromApi(entity as ApsoSession) as U;
          }

        case EntityType.VERIFICATION_TOKEN:
          if (direction === 'toApi') {
            return this.mapVerificationTokenToApi(
              entity as BetterAuthVerificationToken
            ) as U;
          } else {
            return this.mapVerificationTokenFromApi(
              entity as ApsoVerificationToken
            ) as U;
          }

        case EntityType.ACCOUNT:
          if (direction === 'toApi') {
            return this.mapAccountToApi(entity as BetterAuthAccount) as U;
          } else {
            return this.mapAccountFromApi(entity as ApsoAccount) as U;
          }

        default:
          throw new AdapterError(
            AdapterErrorCode.VALIDATION_ERROR,
            `Unsupported entity type: ${entityType}`,
            { entityType, direction },
            false
          );
      }
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Generic entity mapping failed: ${(error as Error).message}`,
        { entity, entityType, direction, error },
        false
      );
    }
  }

  // =============================================================================
  // Validation Methods
  // =============================================================================

  /**
   * Validate an entity based on its type
   * @param entity - Entity to validate
   * @param entityType - Type of entity being validated
   * @returns True if validation passes
   * @throws {AdapterError} If validation fails
   */
  validateEntity(entity: unknown, entityType: EntityType): boolean {
    try {
      switch (entityType) {
        case EntityType.USER:
          if (this.isBetterAuthUser(entity)) {
            this.validateBetterAuthUser(entity);
          } else if (this.isApsoUser(entity)) {
            this.validateApsoUser(entity);
          } else {
            throw new AdapterError(
              AdapterErrorCode.VALIDATION_ERROR,
              'Entity is not a valid user format',
              { entity, entityType },
              false
            );
          }
          break;

        case EntityType.SESSION:
          if (this.isBetterAuthSession(entity)) {
            this.validateBetterAuthSession(entity);
          } else if (this.isApsoSession(entity)) {
            this.validateApsoSession(entity);
          } else {
            throw new AdapterError(
              AdapterErrorCode.VALIDATION_ERROR,
              'Entity is not a valid session format',
              { entity, entityType },
              false
            );
          }
          break;

        case EntityType.VERIFICATION_TOKEN:
          if (this.isBetterAuthVerificationToken(entity)) {
            this.validateBetterAuthVerificationToken(entity);
          } else if (this.isApsoVerificationToken(entity)) {
            this.validateApsoVerificationToken(entity);
          } else {
            throw new AdapterError(
              AdapterErrorCode.VALIDATION_ERROR,
              'Entity is not a valid verification token format',
              { entity, entityType },
              false
            );
          }
          break;

        case EntityType.ACCOUNT:
          if (this.isBetterAuthAccount(entity)) {
            this.validateBetterAuthAccount(entity);
          } else if (this.isApsoAccount(entity)) {
            this.validateApsoAccount(entity);
          } else {
            throw new AdapterError(
              AdapterErrorCode.VALIDATION_ERROR,
              'Entity is not a valid account format',
              { entity, entityType },
              false
            );
          }
          break;

        default:
          throw new AdapterError(
            AdapterErrorCode.VALIDATION_ERROR,
            `Unsupported entity type for validation: ${entityType}`,
            { entityType },
            false
          );
      }

      return true;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        AdapterErrorCode.UNKNOWN,
        `Entity validation failed: ${(error as Error).message}`,
        { entity, entityType, error },
        false
      );
    }
  }

  // =============================================================================
  // Private Validation Methods
  // =============================================================================

  /**
   * Validate Better Auth user entity
   * @param user - User entity to validate
   * @throws {AdapterError} If validation fails
   */
  private validateBetterAuthUser(user: BetterAuthUser): void {
    const errors: ValidationError[] = [];

    if (!user.id || typeof user.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'ID is required and must be a string',
      });
    }

    if (!user.email || typeof user.email !== 'string') {
      errors.push({
        field: 'email',
        message: 'Email is required and must be a string',
      });
    } else if (
      this.config.enableEmailNormalization &&
      !EmailNormalizer.isValidEmail(user.email)
    ) {
      errors.push({ field: 'email', message: 'Email format is invalid' });
    }

    if (typeof user.emailVerified !== 'boolean') {
      errors.push({
        field: 'emailVerified',
        message: 'EmailVerified must be a boolean',
      });
    }

    if (user.name !== undefined && typeof user.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Name must be a string if provided',
      });
    }

    if (user.image !== undefined && typeof user.image !== 'string') {
      errors.push({
        field: 'image',
        message: 'Image must be a string if provided',
      });
    }

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Better Auth user validation failed',
        { errors },
        false
      );
    }
  }

  /**
   * Validate Apso API user entity
   * @param user - User entity to validate
   * @throws {AdapterError} If validation fails
   */
  private validateApsoUser(user: ApsoUser): void {
    const errors: ValidationError[] = [];

    if (!user.id || typeof user.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'ID is required and must be a string',
      });
    }

    if (!user.email || typeof user.email !== 'string') {
      errors.push({
        field: 'email',
        message: 'Email is required and must be a string',
      });
    } else if (
      this.config.enableEmailNormalization &&
      !EmailNormalizer.isValidEmail(user.email)
    ) {
      errors.push({ field: 'email', message: 'Email format is invalid' });
    }

    if (typeof user.emailVerified !== 'boolean') {
      errors.push({
        field: 'emailVerified',
        message: 'EmailVerified must be a boolean',
      });
    }

    if (user.name !== undefined && typeof user.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Name must be a string if provided',
      });
    }

    if (user.image !== undefined && typeof user.image !== 'string') {
      errors.push({
        field: 'image',
        message: 'Image must be a string if provided',
      });
    }

    if (
      user.password_hash !== undefined &&
      typeof user.password_hash !== 'string'
    ) {
      errors.push({
        field: 'password_hash',
        message: 'password_hash must be a string if provided',
      });
    }

    if (!(user.created_at instanceof Date)) {
      errors.push({
        field: 'created_at',
        message: 'Created_at is required and must be a Date',
      });
    }

    if (!(user.updated_at instanceof Date)) {
      errors.push({
        field: 'updated_at',
        message: 'Updated_at is required and must be a Date',
      });
    }

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Apso user validation failed',
        { errors },
        false
      );
    }
  }

  /**
   * Validate Better Auth session entity
   * @param session - Session entity to validate
   * @throws {AdapterError} If validation fails
   */
  private validateBetterAuthSession(session: BetterAuthSession): void {
    const errors: ValidationError[] = [];

    if (!session.id || typeof session.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'ID is required and must be a string',
      });
    }

    if (!session.sessionToken || typeof session.sessionToken !== 'string') {
      errors.push({
        field: 'sessionToken',
        message: 'SessionToken is required and must be a string',
      });
    }

    if (!session.userId || typeof session.userId !== 'string') {
      errors.push({
        field: 'userId',
        message: 'UserId is required and must be a string',
      });
    }

    if (!(session.expiresAt instanceof Date)) {
      errors.push({
        field: 'expiresAt',
        message: 'ExpiresAt is required and must be a Date',
      });
    }

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Better Auth session validation failed',
        { errors },
        false
      );
    }
  }

  /**
   * Validate Apso API session entity
   * @param session - Session entity to validate
   * @throws {AdapterError} If validation fails
   */
  private validateApsoSession(session: ApsoSession): void {
    const errors: ValidationError[] = [];

    if (!session.id || typeof session.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'ID is required and must be a string',
      });
    }

    if (!session.sessionToken || typeof session.sessionToken !== 'string') {
      errors.push({
        field: 'sessionToken',
        message: 'SessionToken is required and must be a string',
      });
    }

    if (!session.userId || typeof session.userId !== 'string') {
      errors.push({
        field: 'userId',
        message: 'UserId is required and must be a string',
      });
    }

    if (!(session.expiresAt instanceof Date)) {
      errors.push({
        field: 'expiresAt',
        message: 'ExpiresAt is required and must be a Date',
      });
    }

    // Optional timestamp validation (relaxed for compatibility)
    if (
      session.created_at !== undefined &&
      !(session.created_at instanceof Date)
    ) {
      errors.push({
        field: 'created_at',
        message: 'Created_at must be a Date if provided',
      });
    }

    if (
      session.updated_at !== undefined &&
      !(session.updated_at instanceof Date)
    ) {
      errors.push({
        field: 'updated_at',
        message: 'Updated_at must be a Date if provided',
      });
    }

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Apso session validation failed',
        { errors },
        false
      );
    }
  }

  /**
   * Validate Better Auth verification token entity
   * @param token - Verification token entity to validate
   * @throws {AdapterError} If validation fails
   */
  private validateBetterAuthVerificationToken(
    token: BetterAuthVerificationToken
  ): void {
    const errors: ValidationError[] = [];

    if (!token.identifier || typeof token.identifier !== 'string') {
      errors.push({
        field: 'identifier',
        message: 'Identifier is required and must be a string',
      });
    }

    // Check for value OR token (value is primary, token is backward compat)
    const hasValue = token.value && typeof token.value === 'string';
    const hasToken = token.token && typeof token.token === 'string';
    if (!hasValue && !hasToken) {
      errors.push({
        field: 'value',
        message: 'Value (or token) is required and must be a string',
      });
    }

    if (!(token.expiresAt instanceof Date)) {
      errors.push({
        field: 'expiresAt',
        message: 'ExpiresAt is required and must be a Date',
      });
    }

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Better Auth verification token validation failed',
        { errors },
        false
      );
    }
  }

  /**
   * Validate Apso API verification token entity
   * @param token - Verification token entity to validate
   * @throws {AdapterError} If validation fails
   */
  private validateApsoVerificationToken(token: ApsoVerificationToken): void {
    const errors: ValidationError[] = [];

    if (token.id !== undefined && typeof token.id !== 'string') {
      errors.push({ field: 'id', message: 'ID must be a string if provided' });
    }

    if (!token.identifier || typeof token.identifier !== 'string') {
      errors.push({
        field: 'identifier',
        message: 'Identifier is required and must be a string',
      });
    }

    // Check for value OR token (value is primary, token is backward compat)
    const hasValue = token.value && typeof token.value === 'string';
    const hasToken = token.token && typeof token.token === 'string';
    if (!hasValue && !hasToken) {
      errors.push({
        field: 'value',
        message: 'Value (or token) is required and must be a string',
      });
    }

    // expiresAt can be Date or undefined (will be set from expires_at)
    if (token.expiresAt && !(token.expiresAt instanceof Date)) {
      errors.push({
        field: 'expiresAt',
        message: 'ExpiresAt must be a Date if provided',
      });
    }

    // created_at is optional for verification tokens

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Apso verification token validation failed',
        { errors },
        false
      );
    }
  }

  /**
   * Validate Better Auth account entity
   * @param account - Account entity to validate
   * @throws {AdapterError} If validation fails
   */
  private validateBetterAuthAccount(account: BetterAuthAccount): void {
    const errors: ValidationError[] = [];

    if (!account.id || typeof account.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'ID is required and must be a string',
      });
    }

    if (!account.userId || typeof account.userId !== 'string') {
      errors.push({
        field: 'userId',
        message: 'UserId is required and must be a string',
      });
    }

    if (!account.type || typeof account.type !== 'string') {
      errors.push({
        field: 'type',
        message: 'Type is required and must be a string',
      });
    }

    if (!account.provider || typeof account.provider !== 'string') {
      errors.push({
        field: 'provider',
        message: 'Provider is required and must be a string',
      });
    }

    if (
      !account.providerAccountId ||
      typeof account.providerAccountId !== 'string'
    ) {
      errors.push({
        field: 'providerAccountId',
        message: 'ProviderAccountId is required and must be a string',
      });
    }

    // Optional fields validation
    if (
      account.refresh_token !== undefined &&
      typeof account.refresh_token !== 'string'
    ) {
      errors.push({
        field: 'refresh_token',
        message: 'Refresh_token must be a string if provided',
      });
    }

    if (
      account.access_token !== undefined &&
      typeof account.access_token !== 'string'
    ) {
      errors.push({
        field: 'access_token',
        message: 'Access_token must be a string if provided',
      });
    }

    if (
      account.expires_at !== undefined &&
      typeof account.expires_at !== 'number'
    ) {
      errors.push({
        field: 'expires_at',
        message: 'Expires_at must be a number if provided',
      });
    }

    if (
      account.token_type !== undefined &&
      typeof account.token_type !== 'string'
    ) {
      errors.push({
        field: 'token_type',
        message: 'Token_type must be a string if provided',
      });
    }

    if (account.scope !== undefined && typeof account.scope !== 'string') {
      errors.push({
        field: 'scope',
        message: 'Scope must be a string if provided',
      });
    }

    if (
      account.id_token !== undefined &&
      typeof account.id_token !== 'string'
    ) {
      errors.push({
        field: 'id_token',
        message: 'Id_token must be a string if provided',
      });
    }

    if (
      account.session_state !== undefined &&
      typeof account.session_state !== 'string'
    ) {
      errors.push({
        field: 'session_state',
        message: 'Session_state must be a string if provided',
      });
    }

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Better Auth account validation failed',
        { errors },
        false
      );
    }
  }

  /**
   * Validate Apso API account entity
   * @param account - Account entity to validate
   * @throws {AdapterError} If validation fails
   */
  private validateApsoAccount(account: ApsoAccount): void {
    const errors: ValidationError[] = [];

    if (!account.id || typeof account.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'ID is required and must be a string',
      });
    }

    if (!account.userId || typeof account.userId !== 'string') {
      errors.push({
        field: 'userId',
        message: 'UserId is required and must be a string',
      });
    }

    if (!account.type || typeof account.type !== 'string') {
      errors.push({
        field: 'type',
        message: 'Type is required and must be a string',
      });
    }

    if (!account.providerId || typeof account.providerId !== 'string') {
      errors.push({
        field: 'providerId',
        message: 'ProviderId is required and must be a string',
      });
    }

    if (!account.accountId || typeof account.accountId !== 'string') {
      errors.push({
        field: 'accountId',
        message: 'AccountId is required and must be a string',
      });
    }

    if (!(account.created_at instanceof Date)) {
      errors.push({
        field: 'created_at',
        message: 'Created_at is required and must be a Date',
      });
    }

    if (!(account.updated_at instanceof Date)) {
      errors.push({
        field: 'updated_at',
        message: 'Updated_at is required and must be a Date',
      });
    }

    // Optional fields validation (same as Better Auth account)
    if (
      account.refresh_token !== undefined &&
      typeof account.refresh_token !== 'string'
    ) {
      errors.push({
        field: 'refresh_token',
        message: 'Refresh_token must be a string if provided',
      });
    }

    if (
      account.access_token !== undefined &&
      typeof account.access_token !== 'string'
    ) {
      errors.push({
        field: 'access_token',
        message: 'Access_token must be a string if provided',
      });
    }

    if (
      account.expires_at !== undefined &&
      typeof account.expires_at !== 'number'
    ) {
      errors.push({
        field: 'expires_at',
        message: 'Expires_at must be a number if provided',
      });
    }

    if (
      account.token_type !== undefined &&
      typeof account.token_type !== 'string'
    ) {
      errors.push({
        field: 'token_type',
        message: 'Token_type must be a string if provided',
      });
    }

    if (account.scope !== undefined && typeof account.scope !== 'string') {
      errors.push({
        field: 'scope',
        message: 'Scope must be a string if provided',
      });
    }

    if (
      account.id_token !== undefined &&
      typeof account.id_token !== 'string'
    ) {
      errors.push({
        field: 'id_token',
        message: 'Id_token must be a string if provided',
      });
    }

    if (
      account.session_state !== undefined &&
      typeof account.session_state !== 'string'
    ) {
      errors.push({
        field: 'session_state',
        message: 'Session_state must be a string if provided',
      });
    }

    if (errors.length > 0) {
      throw new AdapterError(
        AdapterErrorCode.VALIDATION_ERROR,
        'Apso account validation failed',
        { errors },
        false
      );
    }
  }

  // =============================================================================
  // Type Guard Methods
  // =============================================================================

  /**
   * Type guard to check if entity is a Better Auth user
   * @param entity - Entity to check
   * @returns True if entity is a Better Auth user
   */
  private isBetterAuthUser(entity: any): entity is BetterAuthUser {
    return (
      typeof entity === 'object' &&
      entity !== null &&
      typeof entity.id === 'string' &&
      typeof entity.email === 'string' &&
      typeof entity.emailVerified === 'boolean' &&
      // Optional fields
      (entity.name === undefined || typeof entity.name === 'string') &&
      (entity.image === undefined || typeof entity.image === 'string') &&
      // Absence of Apso-specific fields
      !('created_at' in entity) &&
      !('updated_at' in entity)
    );
  }

  /**
   * Type guard to check if entity is an Apso user
   * @param entity - Entity to check
   * @returns True if entity is an Apso user
   */
  private isApsoUser(entity: any): entity is ApsoUser {
    return (
      typeof entity === 'object' &&
      entity !== null &&
      typeof entity.id === 'string' &&
      typeof entity.email === 'string' &&
      typeof entity.emailVerified === 'boolean' &&
      entity.created_at instanceof Date &&
      entity.updated_at instanceof Date &&
      // Optional fields
      (entity.name === undefined || typeof entity.name === 'string') &&
      (entity.image === undefined || typeof entity.image === 'string') &&
      (entity.hashedPassword === undefined ||
        typeof entity.hashedPassword === 'string')
    );
  }

  /**
   * Type guard to check if entity is a Better Auth session
   * @param entity - Entity to check
   * @returns True if entity is a Better Auth session
   */
  private isBetterAuthSession(entity: any): entity is BetterAuthSession {
    return (
      typeof entity === 'object' &&
      entity !== null &&
      typeof entity.id === 'string' &&
      typeof entity.sessionToken === 'string' &&
      typeof entity.userId === 'string' &&
      entity.expiresAt instanceof Date &&
      // Absence of Apso-specific fields
      !('created_at' in entity) &&
      !('updated_at' in entity)
    );
  }

  /**
   * Type guard to check if entity is an Apso session
   * @param entity - Entity to check
   * @returns True if entity is an Apso session
   */
  private isApsoSession(entity: any): entity is ApsoSession {
    return (
      typeof entity === 'object' &&
      entity !== null &&
      typeof entity.id === 'string' &&
      typeof entity.sessionToken === 'string' &&
      typeof entity.userId === 'string' &&
      entity.expiresAt instanceof Date &&
      entity.created_at instanceof Date &&
      entity.updated_at instanceof Date
    );
  }

  /**
   * Type guard to check if entity is a Better Auth verification token
   * @param entity - Entity to check
   * @returns True if entity is a Better Auth verification token
   */
  private isBetterAuthVerificationToken(
    entity: any
  ): entity is BetterAuthVerificationToken {
    return (
      typeof entity === 'object' &&
      entity !== null &&
      typeof entity.identifier === 'string' &&
      typeof entity.token === 'string' &&
      entity.expiresAt instanceof Date &&
      // Absence of Apso-specific fields
      !('id' in entity) &&
      !('created_at' in entity)
    );
  }

  /**
   * Type guard to check if entity is an Apso verification token
   * @param entity - Entity to check
   * @returns True if entity is an Apso verification token
   */
  private isApsoVerificationToken(
    entity: any
  ): entity is ApsoVerificationToken {
    return (
      typeof entity === 'object' &&
      entity !== null &&
      typeof entity.identifier === 'string' &&
      typeof entity.token === 'string' &&
      entity.expiresAt instanceof Date &&
      entity.created_at instanceof Date &&
      // Optional id field
      (entity.id === undefined || typeof entity.id === 'string')
    );
  }

  /**
   * Type guard to check if entity is a Better Auth account
   * @param entity - Entity to check
   * @returns True if entity is a Better Auth account
   */
  private isBetterAuthAccount(entity: any): entity is BetterAuthAccount {
    return (
      typeof entity === 'object' &&
      entity !== null &&
      typeof entity.id === 'string' &&
      typeof entity.userId === 'string' &&
      typeof entity.type === 'string' &&
      typeof entity.provider === 'string' &&
      typeof entity.providerAccountId === 'string' &&
      // Absence of Apso-specific fields
      !('created_at' in entity) &&
      !('updated_at' in entity)
    );
  }

  /**
   * Type guard to check if entity is an Apso account
   * @param entity - Entity to check
   * @returns True if entity is an Apso account
   */
  private isApsoAccount(entity: any): entity is ApsoAccount {
    return (
      typeof entity === 'object' &&
      entity !== null &&
      typeof entity.id === 'string' &&
      typeof entity.userId === 'string' &&
      typeof entity.type === 'string' &&
      typeof entity.provider === 'string' &&
      typeof entity.providerAccountId === 'string' &&
      entity.created_at instanceof Date &&
      entity.updated_at instanceof Date
    );
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Get configuration for this mapper
   * @returns Current mapper configuration
   */
  getConfig(): EntityMapperConfig {
    return { ...this.config };
  }

  /**
   * Update configuration for this mapper
   * @param config - Partial configuration to merge with existing config
   */
  updateConfig(config: Partial<EntityMapperConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    Object.assign(this.config, DEFAULT_CONFIG);
  }

  // =============================================================================
  // Generic Adapter Interface Methods
  // =============================================================================

  /**
   * Get the API path for a given model name
   */
  getApiPath(modelName: string): string {
    // Convert model name to API endpoint path
    const pluralize = (name: string): string => {
      if (name.endsWith('s')) return name;
      if (name.endsWith('y')) return `${name.slice(0, -1)}ies`;
      return `${name}s`;
    };

    switch (modelName.toLowerCase()) {
      case 'user':
        return 'users';
      case 'session':
        return 'sessions';
      case 'verificationtoken':
        return 'verification-tokens';
      case 'account':
        return 'accounts';
      default:
        return pluralize(modelName.toLowerCase());
    }
  }

  /**
   * Transform data from Better Auth format to API format (outbound)
   */
  transformOutbound(model: string, data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    switch (model.toLowerCase()) {
      case 'user':
        return this.mapUserToApi(data as BetterAuthUser);
      case 'session':
        return this.mapSessionToApi(data as BetterAuthSession);
      case 'verificationtoken':
        return this.mapVerificationTokenToApi(
          data as BetterAuthVerificationToken
        );
      case 'account':
        return this.mapAccountToApi(data as BetterAuthAccount);
      default:
        // For unknown models, return data as-is
        return data;
    }
  }

  /**
   * Transform data from API format to Better Auth format (inbound)
   */
  transformInbound(model: string, data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    switch (model.toLowerCase()) {
      case 'user':
        return this.mapUserFromApi(data as ApsoUser);
      case 'session':
        return this.mapSessionFromApi(data as ApsoSession);
      case 'verificationtoken':
        return this.mapVerificationTokenFromApi(data as ApsoVerificationToken);
      case 'account':
        return this.mapAccountFromApi(data as ApsoAccount);
      default:
        // For unknown models, return data as-is
        return data;
    }
  }

  /**
   * Validate data for a given model
   */
  validate(
    model: string,
    data: any
  ): { valid: boolean; errors?: Array<{ field: string; message: string }> } {
    try {
      switch (model.toLowerCase()) {
        case 'user':
          if (this.isBetterAuthUser(data)) {
            this.validateBetterAuthUser(data);
          } else if (this.isApsoUser(data)) {
            this.validateApsoUser(data);
          } else {
            return {
              valid: false,
              errors: [{ field: 'data', message: 'Invalid user data format' }],
            };
          }
          break;
        case 'session':
          if (this.isBetterAuthSession(data)) {
            this.validateBetterAuthSession(data);
          } else if (this.isApsoSession(data)) {
            this.validateApsoSession(data);
          } else {
            return {
              valid: false,
              errors: [
                { field: 'data', message: 'Invalid session data format' },
              ],
            };
          }
          break;
        case 'verificationtoken':
          if (this.isBetterAuthVerificationToken(data)) {
            this.validateBetterAuthVerificationToken(data);
          } else if (this.isApsoVerificationToken(data)) {
            this.validateApsoVerificationToken(data);
          } else {
            return {
              valid: false,
              errors: [
                {
                  field: 'data',
                  message: 'Invalid verification token data format',
                },
              ],
            };
          }
          break;
        case 'account':
          if (this.isBetterAuthAccount(data)) {
            this.validateBetterAuthAccount(data);
          } else if (this.isApsoAccount(data)) {
            this.validateApsoAccount(data);
          } else {
            return {
              valid: false,
              errors: [
                { field: 'data', message: 'Invalid account data format' },
              ],
            };
          }
          break;
        default:
          // For unknown models, assume valid
          return { valid: true };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: 'data',
            message:
              error instanceof Error ? error.message : 'Validation failed',
          },
        ],
      };
    }
  }
}
