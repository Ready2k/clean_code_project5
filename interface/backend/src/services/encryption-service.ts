import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { ConnectionErrorCode } from '../types/connections.js';
import { AppError } from '../types/errors.js';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits

  private static encryptionKey: Buffer | null = null;

  /**
   * Initialize the encryption service with a master key
   */
  public static initialize(masterKey?: string): void {
    try {
      if (masterKey) {
        // Check if the key is a hex string (64 characters for 32 bytes)
        if (masterKey.length === 64 && /^[0-9a-fA-F]+$/.test(masterKey)) {
          // Use hex key directly
          this.encryptionKey = Buffer.from(masterKey, 'hex');
        } else {
          // Use provided master key - pad or truncate to correct length
          const keyBuffer = Buffer.from(masterKey, 'utf8');
          this.encryptionKey = Buffer.alloc(this.KEY_LENGTH);
          keyBuffer.copy(this.encryptionKey, 0, 0, Math.min(keyBuffer.length, this.KEY_LENGTH));
        }
      } else {
        // Generate a random key (for development/testing)
        this.encryptionKey = crypto.randomBytes(this.KEY_LENGTH);
        logger.warn('Using randomly generated encryption key. This should not be used in production.');
      }
      
      logger.info('Encryption service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize encryption service:', error);
      throw new AppError(
        'Failed to initialize encryption service',
        500,
        ConnectionErrorCode.ENCRYPTION_ERROR as any
      );
    }
  }

  /**
   * Encrypt sensitive data using AES-256-CBC
   */
  public static encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new AppError(
        'Encryption service not initialized',
        500,
        ConnectionErrorCode.ENCRYPTION_ERROR as any
      );
    }

    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Create cipher with key and IV
      const cipher = crypto.createCipheriv(this.ALGORITHM, this.encryptionKey, iv);

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const result = {
        iv: iv.toString('hex'),
        encrypted: encrypted
      };

      return JSON.stringify(result);
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new AppError(
        'Failed to encrypt data',
        500,
        ConnectionErrorCode.ENCRYPTION_ERROR as any
      );
    }
  }

  /**
   * Decrypt sensitive data using AES-256-CBC
   */
  public static decrypt(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new AppError(
        'Encryption service not initialized',
        500,
        ConnectionErrorCode.DECRYPTION_ERROR as any
      );
    }

    try {
      const data = JSON.parse(encryptedData);
      const { iv, encrypted } = data;

      // Create decipher with key and IV
      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.encryptionKey, Buffer.from(iv, 'hex'));

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new AppError(
        'Failed to decrypt data',
        500,
        ConnectionErrorCode.DECRYPTION_ERROR as any
      );
    }
  }

  /**
   * Encrypt connection configuration
   */
  public static encryptConfig(config: any): string {
    const configString = JSON.stringify(config);
    return this.encrypt(configString);
  }

  /**
   * Decrypt connection configuration
   */
  public static decryptConfig<T>(encryptedConfig: string): T {
    const configString = this.decrypt(encryptedConfig);
    return JSON.parse(configString) as T;
  }

  /**
   * Generate a secure random key for development/testing
   */
  public static generateKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
  }

  /**
   * Hash sensitive data for comparison (one-way)
   */
  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify if the encryption service is properly initialized
   */
  public static isInitialized(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Clear the encryption key (for testing purposes)
   */
  public static reset(): void {
    this.encryptionKey = null;
  }
}

// Note: Encryption service initialization is now handled in index.ts after environment variables are loaded